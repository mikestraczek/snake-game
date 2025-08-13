import { createContext, useContext, ReactNode } from 'react'
import { create } from 'zustand'
import type {
  Player,
  GameState,
  GameSettings,
  GameResult,
  ChatMessageReceiveEvent
} from '../../shared/types'

type GameStore = {
  // Raum-Informationen
  roomId: string | null
  roomCode: string | null
  playerId: string | null
  isHost: boolean
  
  // Spieler-Informationen
  playerName: string
  playerColor: string
  players: Player[]
  
  // Spiel-Zustand
  gameState: GameState | null
  gameSettings: GameSettings | null
  gameResults: GameResult[]
  
  // Chat
  chatMessages: ChatMessageReceiveEvent[]
  
  // UI-Zustand
  isConnected: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  setRoomInfo: (roomId: string, roomCode: string, playerId: string, isHost: boolean) => void
  setPlayerInfo: (name: string, color: string) => void
  setPlayers: (players: Player[]) => void
  setGameState: (gameState: GameState) => void
  setGameSettings: (settings: GameSettings) => void
  setGameResults: (results: GameResult[]) => void
  addChatMessage: (message: ChatMessageReceiveEvent) => void
  clearChat: () => void
  setConnectionStatus: (connected: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  roomId: null,
  roomCode: null,
  playerId: null,
  isHost: false,
  
  playerName: '',
  playerColor: '#4ecdc4',
  players: [],
  
  gameState: null,
  gameSettings: null,
  gameResults: [],
  
  chatMessages: [],
  
  isConnected: false,
  isLoading: false,
  error: null,
  
  // Actions
  setRoomInfo: (roomId, roomCode, playerId, isHost) => {
    set({ roomId, roomCode, playerId, isHost, error: null })
  },
  
  setPlayerInfo: (name, color) => {
    set({ playerName: name, playerColor: color })
  },
  
  setPlayers: (players) => {
    set({ players })
  },
  
  setGameState: (gameState) => {
    set({ gameState })
  },
  
  setGameSettings: (settings) => {
    set({ gameSettings: settings })
  },
  
  setGameResults: (results) => {
    set({ gameResults: results })
  },
  
  addChatMessage: (message) => {
    const { chatMessages } = get()
    const newMessages = [...chatMessages, message]
    
    // Begrenze Chat-Nachrichten auf 100
    if (newMessages.length > 100) {
      newMessages.splice(0, newMessages.length - 100)
    }
    
    set({ chatMessages: newMessages })
  },
  
  clearChat: () => {
    set({ chatMessages: [] })
  },
  
  setConnectionStatus: (connected) => {
    set({ isConnected: connected })
  },
  
  setLoading: (loading) => {
    set({ isLoading: loading })
  },
  
  setError: (error) => {
    set({ error })
  },
  
  reset: () => {
    set({
      roomId: null,
      roomCode: null,
      playerId: null,
      isHost: false,
      playerName: '',
      playerColor: '#4ecdc4',
      players: [],
      gameState: null,
      gameSettings: null,
      gameResults: [],
      chatMessages: [],
      isConnected: false,
      isLoading: false,
      error: null
    })
  }
}))

// Context für bessere Performance
const GameContext = createContext<typeof useGameStore | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  return (
    <GameContext.Provider value={useGameStore}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within GameProvider')
  }
  return context()
}

// Selektoren für bessere Performance
export const useGameSelectors = {
  roomInfo: () => useGameStore(state => ({
    roomId: state.roomId,
    roomCode: state.roomCode,
    playerId: state.playerId,
    isHost: state.isHost
  })),
  
  playerInfo: () => useGameStore(state => ({
    playerName: state.playerName,
    playerColor: state.playerColor
  })),
  
  gameStatus: () => useGameStore(state => ({
    gameState: state.gameState,
    gameSettings: state.gameSettings,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error
  })),
  
  players: () => useGameStore(state => state.players),
  chatMessages: () => useGameStore(state => state.chatMessages),
  gameResults: () => useGameStore(state => state.gameResults)
}