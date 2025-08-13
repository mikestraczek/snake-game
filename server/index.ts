import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { RoomManager } from './services/room-manager.js'
import { GameEngine } from './services/game-engine.js'
import { PlayerManager } from './services/player-manager.js'
import { setupSocketHandlers } from './socket-handlers.js'
import type {
  JoinRoomEvent,
  CreateRoomEvent,
  PlayerInputEvent,
  PlayerReadyEvent,
  ChatMessageEvent
} from '../shared/types.js'

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CORS_ORIGIN || 'https://your-domain.com'
      : ['http://localhost:5173', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}))
app.use(compression())
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || 'https://your-domain.com'
    : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true
}))
app.use(express.json())
app.use(express.static('dist/client'))

// Services
const roomManager = new RoomManager()
const gameEngine = new GameEngine()
const playerManager = new PlayerManager()

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.get('/api/rooms/active', async (req, res) => {
  try {
    const activeRooms = await roomManager.getActiveRooms()
    res.json({
      rooms: activeRooms,
      totalRooms: activeRooms.length
    })
  } catch (error) {
    console.error('Error fetching active rooms:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/room/:roomId/info', async (req, res) => {
  try {
    const { roomId } = req.params
    const roomInfo = await roomManager.getRoomInfo(roomId)
    
    if (!roomInfo) {
      return res.status(404).json({ error: 'Room not found' })
    }
    
    res.json(roomInfo)
  } catch (error) {
    console.error('Error fetching room info:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Fallback für SPA
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist/client' })
})

// Socket.io Event Handlers
setupSocketHandlers(io, {
  roomManager,
  gameEngine,
  playerManager
})

// Cleanup inactive rooms every 5 minutes
setInterval(async () => {
  try {
    await roomManager.cleanupInactiveRooms()
  } catch (error) {
    console.error('Error during room cleanup:', error)
  }
}, 5 * 60 * 1000)

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Multiplayer Snake Game Server läuft auf Port ${PORT}`)
  console.log(`🎮 WebSocket Server bereit für Verbindungen`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})