import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { useGame, useGameStore } from '../stores/game-store'
import type {
  JoinRoomEvent,
  CreateRoomEvent,
  PlayerInputEvent,
  PlayerReadyEvent,
  ChatMessageEvent,
  RestartGameEvent,
  RoomJoinedEvent,
  PlayerListUpdateEvent,
  GameStateUpdateEvent,
  GameEndedEvent,
  ChatMessageReceiveEvent,
  GameSettings
} from '../../shared/types'

type SocketContextType = {
  socket: Socket | null
  isConnected: boolean
  createRoom: (data: CreateRoomEvent) => void
  joinRoom: (data: JoinRoomEvent) => void
  setPlayerReady: (ready: boolean) => void
  startGame: () => void
  restartGame: () => void
  sendGameInput: (direction: PlayerInputEvent['direction']) => void
  sendChatMessage: (message: string) => void
  updateGameSettings: (gameSettings: GameSettings) => void
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | null>(null)

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  const {
    setRoomInfo,
    setPlayers,
    setGameState,
    setGameSettings,
    setGameResults,
    addChatMessage,
    setConnectionStatus,
    setLoading,
    setError,
    reset
  } = useGame()

  useEffect(() => {
    // Socket.io Verbindung erstellen
    const newSocket = io({
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    })

    // Verbindungs-Events
    newSocket.on('connect', () => {
      console.log('🔌 Mit Server verbunden:', newSocket.id)
      setIsConnected(true)
      setConnectionStatus(true)
      setError(null)
      toast.success('Mit Server verbunden')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Verbindung getrennt:', reason)
      setIsConnected(false)
      setConnectionStatus(false)
      
      if (reason === 'io server disconnect') {
        toast.error('Server hat Verbindung getrennt')
      } else {
        toast.warning('Verbindung zum Server verloren')
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('🔌 Verbindungsfehler:', error)
      setError('Verbindung zum Server fehlgeschlagen')
      toast.error('Verbindung zum Server fehlgeschlagen')
    })

    // Raum-Events
    newSocket.on('room-joined', (data: RoomJoinedEvent) => {
      console.log('🏠 Raum beigetreten:', data)
      setRoomInfo(data.roomId, '', data.playerId, data.isHost)
      setGameSettings(data.gameSettings)
      setLoading(false) // Loading beenden nach erfolgreichem Raum-Beitritt
      console.log('📝 RoomInfo gesetzt (ohne Code):', { roomId: data.roomId, playerId: data.playerId, isHost: data.isHost })
      toast.success(data.isHost ? 'Raum erstellt!' : 'Raum beigetreten!')
    })

    newSocket.on('room-code', (data: { code: string }) => {
      console.log('🔑 Raum-Code erhalten:', data.code)
      // Update room code in store
      const currentState = useGameStore.getState()
      if (currentState.roomId) {
        console.log('📝 RoomInfo aktualisiert mit Code:', { roomId: currentState.roomId, code: data.code })
        setRoomInfo(currentState.roomId, data.code, currentState.playerId!, currentState.isHost)
      } else {
        console.warn('⚠️ Raum-Code erhalten, aber keine roomId im State:', currentState)
      }
    })

    newSocket.on('player-list-update', (data: PlayerListUpdateEvent) => {
      console.log('👥 Spielerliste aktualisiert:', data.players)
      setPlayers(data.players)
    })

    newSocket.on('game-settings-updated', (data: { gameSettings: GameSettings }) => {
      console.log('⚙️ Spiel-Einstellungen aktualisiert:', data.gameSettings)
      setGameSettings(data.gameSettings)
      toast.success('Einstellungen aktualisiert!')
    })

    // Spiel-Events
    newSocket.on('game-started', (data: { gameState: any }) => {
      console.log('🚀 Spiel gestartet')
      setGameState(data.gameState)
      toast.success('Spiel gestartet!')
    })

    newSocket.on('game-state-update', (data: GameStateUpdateEvent) => {
      setGameState(data.gameState)
    })

    newSocket.on('game-ended', (data: GameEndedEvent) => {
      console.log('🏁 Spiel beendet:', data)
      setGameResults(data.results)
      
      // GameState auf 'finished' setzen für Navigation zur Results-Page
      const currentState = useGameStore.getState()
      if (currentState.gameState) {
        setGameState({
          ...currentState.gameState,
          gameStatus: 'finished'
        })
      }
      
      toast.info('Spiel beendet!')
    })

    // Chat-Events
    newSocket.on('chat-message', (data: ChatMessageReceiveEvent) => {
      console.log('💬 Chat-Nachricht:', data)
      addChatMessage(data)
      
      // Toast für System-Nachrichten
      if (data.playerId === 'system') {
        toast.info(data.message)
      }
    })

    // Fehler-Events
    newSocket.on('error', (data: { message: string }) => {
      console.error('❌ Server-Fehler:', data.message)
      setError(data.message)
      setLoading(false) // Loading beenden bei Fehlern
      toast.error(data.message)
    })

    setSocket(newSocket)

    // Cleanup
    return () => {
      console.log('🔌 Socket-Verbindung wird geschlossen')
      newSocket.close()
    }
  }, [])

  // Socket-Aktionen
  const createRoom = (data: CreateRoomEvent) => {
    if (!socket) {
      toast.error('Keine Verbindung zum Server')
      return
    }
    
    console.log('🏠 Erstelle Raum:', data)
    setLoading(true) // Loading starten beim Raum erstellen
    socket.emit('create-room', data)
  }

  const joinRoom = (data: JoinRoomEvent) => {
    if (!socket) {
      toast.error('Keine Verbindung zum Server')
      return
    }
    
    console.log('🚪 Trete Raum bei:', data)
    setLoading(true) // Loading starten beim Raum beitreten
    socket.emit('join-room', data)
  }

  const setPlayerReady = (ready: boolean) => {
    if (!socket) {
      toast.error('Keine Verbindung zum Server')
      return
    }
    
    console.log('✅ Spieler bereit:', ready)
    const data: PlayerReadyEvent = { ready }
    socket.emit('player-ready', data)
  }

  const startGame = () => {
    if (!socket) {
      toast.error('Keine Verbindung zum Server')
      return
    }
    
    console.log('🚀 Starte Spiel')
    socket.emit('start-game')
  }

  const restartGame = () => {
    if (!socket) {
      toast.error('Keine Verbindung zum Server')
      return
    }
    
    console.log('🔄 Starte Spiel neu')
    const data: RestartGameEvent = {}
    socket.emit('restart-game', data)
  }

  const sendGameInput = (direction: PlayerInputEvent['direction']) => {
    if (!socket) return
    
    const data: PlayerInputEvent = {
      direction,
      timestamp: Date.now()
    }
    
    socket.emit('game-input', data)
  }

  const sendChatMessage = (message: string) => {
    if (!socket) {
      toast.error('Keine Verbindung zum Server')
      return
    }
    
    if (!message.trim()) return
    
    const data: ChatMessageEvent = {
      message: message.trim(),
      timestamp: Date.now()
    }
    
    console.log('💬 Sende Chat-Nachricht:', data)
    socket.emit('chat-message', data)
  }

  const updateGameSettings = (gameSettings: GameSettings) => {
    if (!socket) {
      toast.error('Keine Verbindung zum Server')
      return
    }
    
    console.log('⚙️ Aktualisiere Spiel-Einstellungen:', gameSettings)
    socket.emit('update-game-settings', { gameSettings })
  }

  const disconnect = () => {
    if (socket) {
      socket.close()
    }
    reset()
  }

  const value: SocketContextType = {
    socket,
    isConnected,
    createRoom,
    joinRoom,
    setPlayerReady,
    startGame,
    restartGame,
    sendGameInput,
    sendChatMessage,
    updateGameSettings,
    disconnect
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider')
  }
  return context
}