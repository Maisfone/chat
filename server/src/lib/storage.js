import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase()
const uploadDir = process.env.UPLOAD_DIR || 'uploads'

function ensureUploadDir() {
  try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }) } catch {}
}

function randomName(original = '') {
  const ext = path.extname(original)
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
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

export function handleUploadSingle(field) {
  if (DRIVER === 's3') {
    const s3 = createS3()
    const bucket = process.env.S3_BUCKET
    const storage = multer.memoryStorage()
    const up = multer({ storage }).single(field)
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
  const up = multer({ storage }).single(field)
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

