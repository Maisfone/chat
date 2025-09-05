import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import morgan from 'morgan'

import authRoutes from './routes/auth.js'
import groupRoutes from './routes/groups.js'
import messageRoutes from './routes/messages.js'
import userRoutes from './routes/users.js'
import dmRoutes from './routes/dm.js'
import phoneRoutes from './routes/phone.js'
import meetingRoutes from './routes/meetings.js'

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] }
})

// Disponibiliza io nas rotas
app.use((req, res, next) => { req.io = io; next() })

app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use(morgan('dev'))

// Arquivos estáticos (uploads)
const uploadDir = process.env.UPLOAD_DIR || 'uploads'
app.use('/' + uploadDir, express.static(uploadDir))

// Healthcheck e ping
app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }))

// Rotas
app.use('/api/auth', authRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/users', userRoutes)
app.use('/api/dm', dmRoutes)
app.use('/api/phone', phoneRoutes)
app.use('/api/meetings', meetingRoutes)

// Socket rooms
io.on('connection', (socket) => {
  socket.on('group:join', (groupId) => socket.join(groupId))
  socket.on('group:leave', (groupId) => socket.leave(groupId))

  // WebRTC signaling via rooms
  socket.on('webrtc:join', (room) => {
    try { socket.join('webrtc:' + room) } catch {}
  })
  socket.on('webrtc:leave', (room) => {
    try { socket.leave('webrtc:' + room) } catch {}
  })
  socket.on('webrtc:signal', ({ room, data }) => {
    try { socket.to('webrtc:' + room).emit('webrtc:signal', data) } catch {}
  })
  socket.on('webrtc:room:count', (room, cb) => {
    try {
      const full = 'webrtc:' + room
      const r = io.sockets.adapter.rooms.get(full)
      cb?.({ count: r ? r.size : 0 })
    } catch {
      cb?.({ count: 0 })
    }
  })

  // SIP registration status broadcast (app-level)
  socket.on('sip:reg', (payload) => {
    try { socket.broadcast.emit('sip:reg', payload) } catch {}
  })
})

// 404 para APIs
app.use('/api', (req, res, next) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

// Handler de erros JSON (dev-friendly)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  const payload = {
    error: err.message || 'Erro interno',
  }
  // Detalhes somente fora de produção
  if (process.env.NODE_ENV !== 'production') {
    payload.details = err.stack
  }
  console.error('API error:', err)
  res.status(status).json(payload)
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`API on http://localhost:${PORT}`))

// Captura falhas não tratadas para log útil
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
