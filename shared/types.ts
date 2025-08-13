// Gemeinsame Typen für Frontend und Backend

export type Direction = 'up' | 'down' | 'left' | 'right'
export type Direction3D = 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward'

export type Position = {
  x: number
  y: number
}

export type Position3D = {
  x: number
  y: number
  z: number
}

export type GameSettings = {
  maxPlayers: number // 2-4
  gameSpeed: number // 1-5
  boardSize: 'small' | 'medium' | 'large'
  gameMode: 'classic' | 'battle-royale'
  is3D?: boolean // Neues Flag für 3D-Modus
}

export type Player = {
  id: string
  name: string
  color: string
  ready: boolean
  isHost: boolean
  score: number
  alive: boolean
}

export type PlayerGameState = {
  id: string
  snake: Position[]
  direction: Direction
  score: number
  alive: boolean
}

export type PlayerGameState3D = {
  id: string
  snake: Position3D[]
  direction: Direction3D
  score: number
  alive: boolean
}

export type GameState = {
  players: PlayerGameState[]
  food: Position[]
  gameStatus: 'waiting' | 'playing' | 'finished'
  timeRemaining?: number
}

export type GameState3D = {
  players: PlayerGameState3D[]
  food: Position3D[]
  gameStatus: 'waiting' | 'playing' | 'finished'
  timeRemaining?: number
}

export type GameResult = {
  playerId: string
  playerName: string
  score: number
  rank: number
  survivalTime: number
}

// WebSocket Events - Client → Server
export type JoinRoomEvent = {
  roomCode: string
  playerName: string
  playerColor: string
}

export type CreateRoomEvent = {
  playerName: string
  playerColor: string
  gameSettings: GameSettings
}

export type PlayerInputEvent = {
  direction: Direction
  timestamp: number
}

export type PlayerInputEvent3D = {
  direction: Direction3D
  timestamp: number
}

export type PlayerReadyEvent = {
  ready: boolean
}

export type ChatMessageEvent = {
  message: string
  timestamp: number
}

export type RestartGameEvent = {
  // Keine zusätzlichen Daten erforderlich
}

export type UpdateGameSettingsEvent = {
  gameSettings: GameSettings
}

// WebSocket Events - Server → Client
export type RoomJoinedEvent = {
  roomId: string
  playerId: string
  isHost: boolean
  gameSettings: GameSettings
}

export type PlayerListUpdateEvent = {
  players: Player[]
}

export type GameStateUpdateEvent = {
  gameState: GameState
  timestamp: number
}

export type GameEndedEvent = {
  results: GameResult[]
  duration: number
}

export type ChatMessageReceiveEvent = {
  playerId: string
  playerName: string
  message: string
  timestamp: number
}

export type GameSettingsUpdatedEvent = {
  gameSettings: GameSettings
}

// REST API Types
export type RoomInfo = {
  roomId: string
  playerCount: number
  maxPlayers: number
  gameStatus: 'waiting' | 'playing' | 'finished'
  gameSettings: GameSettings
}

export type ActiveRoomsResponse = {
  rooms: RoomInfo[]
  totalRooms: number
}

// Redis Data Structures
export type RoomData = {
  id: string
  code: string
  hostId: string
  players: string[] // Player IDs
  gameSettings: GameSettings
  status: 'waiting' | 'playing' | 'finished'
  createdAt: number
  lastActivity: number
}

export type PlayerData = {
  id: string
  name: string
  color: string
  roomId: string
  socketId: string
  ready: boolean
  joinedAt: number
}

export type GameData = {
  roomId: string
  state: GameState
  startedAt: number
  lastUpdate: number
}

export type SessionData = {
  playerId: string
  roomId: string
  connectedAt: number
  lastSeen: number
}

// Utility Types
export type BoardSize = {
  width: number
  height: number
  gridSize: number
}

export type BoardSize3D = {
  width: number
  height: number
  depth: number
  gridSize: number
}

export const BOARD_SIZES: Record<GameSettings['boardSize'], BoardSize> = {
  small: { width: 400, height: 400, gridSize: 20 },
  medium: { width: 600, height: 600, gridSize: 20 },
  large: { width: 800, height: 800, gridSize: 20 }
}

export const BOARD_SIZES_3D: Record<GameSettings['boardSize'], BoardSize3D> = {
  small: { width: 400, height: 400, depth: 400, gridSize: 20 },
  medium: { width: 600, height: 600, depth: 600, gridSize: 20 },
  large: { width: 800, height: 800, depth: 800, gridSize: 20 }
}

export const PLAYER_COLORS = [
  '#4ecdc4', // Türkis
  '#ff6b6b', // Rot
  '#ffd93d', // Gelb
  '#6bcf7f'  // Grün
] as const

export type PlayerColor = typeof PLAYER_COLORS[number]