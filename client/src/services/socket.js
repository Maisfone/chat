import { io } from 'socket.io-client'

let socket
export function ioClient() {
  if (!socket) socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001')
  return socket
}
