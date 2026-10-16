import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase()
const uploadDir = process.env.UPLOAD_DIR || 'uploads'

function ensureUploadDir() {
  try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }) } catch {}
}

const MAX_MB = Number(process.env.UPLOAD_MAX_MB) > 0 ? Number(process.env.UPLOAD_MAX_MB) : 50

// Tipos que o navegador executaria como página/script se abertos direto da URL
const BLOCKED_EXT = new Set(['.html', '.htm', '.xhtml', '.shtml', '.svg', '.svgz', '.xml', '.xsl', '.js', '.mjs', '.php'])
const BLOCKED_MIME = /(html|svg|xml|javascript|ecmascript)/i

function fileExt(original = '') {
  const ext = path.extname(original).toLowerCase()
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ''
}

function randomName(original = '') {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExt(original)}`
}

function uploadError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

// accept: 'any' (bloqueia só tipos perigosos), 'image' ou 'audio'
function makeFileFilter(accept) {
  return (req, file, cb) => {
    const ext = fileExt(file.originalname)
    const mime = String(file.mimetype || '')
    if (BLOCKED_EXT.has(ext) || BLOCKED_MIME.test(mime)) {
      return cb(uploadError(415, 'Tipo de arquivo não permitido'))
    }
    if (accept === 'image' && !mime.startsWith('image/')) {
      return cb(uploadError(415, 'Envie uma imagem'))
    }
    if (accept === 'audio' && !mime.startsWith('audio/')) {
      return cb(uploadError(415, 'Envie um arquivo de áudio'))
    }
    cb(null, true)
  }
}

// Converte erros do multer em respostas JSON amigáveis
function wrapMulter(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next()
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `Arquivo muito grande (máximo ${MAX_MB} MB)` })
      }
      if (err.status) return res.status(err.status).json({ error: err.message })
      return res.status(400).json({ error: 'Falha no upload' })
    })
  }
}

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`
}

function createS3() {
  const region = process.env.S3_REGION || 'us-east-1'
  const endpoint = process.env.S3_ENDPOINT || undefined
  const forcePathStyle = /^true$/i.test(process.env.S3_FORCE_PATH_STYLE || '')
  const creds = (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)
    ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } }
    : {}
  return new S3Client({ region, endpoint, forcePathStyle, ...creds })
}

export function handleUploadSingle(field, { accept = 'any' } = {}) {
  const limits = { fileSize: MAX_MB * 1024 * 1024, files: 1 }
  const fileFilter = makeFileFilter(accept)
  if (DRIVER === 's3') {
    const s3 = createS3()
    const bucket = process.env.S3_BUCKET
    const storage = multer.memoryStorage()
    const up = wrapMulter(multer({ storage, limits, fileFilter }).single(field))
    return [
      up,
      async (req, res, next) => {
        try {
          if (!req.file) return next()
          if (!bucket) return res.status(500).json({ error: 'S3_BUCKET ausente' })
          const key = `${uploadDir}/${randomName(req.file.originalname)}`
          await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype || 'application/octet-stream',
            ACL: process.env.S3_OBJECT_ACL || 'public-read',
          }))
          const endpoint = process.env.S3_PUBLIC_BASE || process.env.S3_ENDPOINT
          let url
          if (endpoint) {
            const clean = endpoint.replace(/\/$/, '')
            const pathStyle = /^true$/i.test(process.env.S3_FORCE_PATH_STYLE || '')
            url = pathStyle ? `${clean}/${bucket}/${key}` : `${clean}/${key}`
          } else {
            const region = process.env.S3_REGION || 'us-east-1'
            url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
          }
          req.file.url = url
          next()
        } catch (e) {
          next(e)
        }
      }
    ]
  }

  // LOCAL
  ensureUploadDir()
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, randomName(file.originalname)),
  })
  const up = wrapMulter(multer({ storage, limits, fileFilter }).single(field))
  return [
    up,
    (req, res, next) => {
      try {
        if (req.file) {
          const base = getBaseUrl(req)
          req.file.url = `${base}/${uploadDir}/${req.file.filename}`
        }
      } catch {}
      next()
    }
  ]
}

