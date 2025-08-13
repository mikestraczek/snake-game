import { Server, Socket } from 'socket.io'
import { randomBytes } from 'crypto'
import type { RoomManager } from './services/room-manager.js'
import type { GameEngine } from './services/game-engine.js'
import type { PlayerManager } from './services/player-manager.js'
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
  ChatMessageReceiveEvent
} from '../shared/types.js'

type Services = {
  roomManager: RoomManager
  gameEngine: GameEngine
  playerManager: PlayerManager
}

export function setupSocketHandlers(io: Server, services: Services) {
  const { roomManager, gameEngine, playerManager } = services

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client verbunden: ${socket.id}`)

    // Raum erstellen
    socket.on('create-room', async (data: CreateRoomEvent) => {
      try {
        const playerId = generatePlayerId()
        
        // Spieler-Name validieren
        const nameValidation = playerManager.validatePlayerName(data.playerName)
        if (!nameValidation.valid) {
          socket.emit('error', { message: nameValidation.error })
          return
        }
        
        // Verfügbare Farbe finden
        const availableColor = data.playerColor || playerManager.getAvailableColor('temp')
        
        // Raum erstellen
        const { roomId, roomCode } = await roomManager.createRoom(playerId, data.gameSettings)
        
        // Spieler erstellen
        await playerManager.createOrUpdatePlayer(
          playerId,
          socket.id,
          data.playerName,
          availableColor,
          roomId
        )
        
        // Socket zu Raum hinzufügen
        await socket.join(roomId)
        
        // Erfolgreiche Raum-Erstellung bestätigen
        const response: RoomJoinedEvent = {
          roomId,
          playerId,
          isHost: true,
          gameSettings: data.gameSettings
        }
        
        socket.emit('room-joined', response)
        socket.emit('room-code', { code: roomCode })
        
        // Spielerliste aktualisieren
        await updatePlayerList(roomId, io, roomManager, playerManager)
        
        console.log(`🏠 Raum ${roomCode} erstellt von ${data.playerName}`)
        
      } catch (error) {
        console.error('Fehler beim Erstellen des Raums:', error)
        socket.emit('error', { message: 'Fehler beim Erstellen des Raums' })
      }
    })

    // Raum beitreten
    socket.on('join-room', async (data: JoinRoomEvent) => {
      try {
        const playerId = generatePlayerId()
        
        // Spieler-Name validieren
        const nameValidation = playerManager.validatePlayerName(data.playerName)
        if (!nameValidation.valid) {
          socket.emit('error', { message: nameValidation.error })
          return
        }
        
        // Raum beitreten
        const room = await roomManager.joinRoom(playerId, data.roomCode.toUpperCase())
        if (!room) {
          socket.emit('error', { message: 'Raum nicht gefunden oder voll' })
          return
        }
        
        // Name-Verfügbarkeit prüfen
        if (!playerManager.isNameAvailableInRoom(room.id, data.playerName)) {
          socket.emit('error', { message: 'Name bereits vergeben' })
          return
        }
        
        // Verfügbare Farbe finden
        const availableColor = data.playerColor || playerManager.getAvailableColor(room.id)
        
        // Spieler erstellen
        await playerManager.createOrUpdatePlayer(
          playerId,
          socket.id,
          data.playerName,
          availableColor,
          room.id
        )
        
        // Socket zu Raum hinzufügen
        await socket.join(room.id)
        
        // Erfolgreichen Beitritt bestätigen
        const response: RoomJoinedEvent = {
          roomId: room.id,
          playerId,
          isHost: false,
          gameSettings: room.gameSettings
        }
        
        socket.emit('room-joined', response)
        
        // Spielerliste aktualisieren
        await updatePlayerList(room.id, io, roomManager, playerManager)
        
        // Chat-Nachricht: Spieler beigetreten
        const joinMessage: ChatMessageReceiveEvent = {
          playerId: 'system',
          playerName: 'System',
          message: `${data.playerName} ist dem Raum beigetreten`,
          timestamp: Date.now()
        }
        
        io.to(room.id).emit('chat-message', joinMessage)
        
        console.log(`👋 ${data.playerName} ist Raum ${data.roomCode} beigetreten`)
        
      } catch (error) {
        console.error('Fehler beim Beitreten des Raums:', error)
        socket.emit('error', { message: 'Fehler beim Beitreten des Raums' })
      }
    })

    // Spieler-Bereitschaft
    socket.on('player-ready', async (data: PlayerReadyEvent) => {
      try {
        const player = await playerManager.getPlayerBySocket(socket.id)
        if (!player) {
          socket.emit('error', { message: 'Spieler nicht gefunden' })
          return
        }
        
        await playerManager.updatePlayerReady(player.id, data.ready)
        await roomManager.updatePlayerReady(player.id, data.ready)
        
        // Spielerliste aktualisieren
        await updatePlayerList(player.roomId, io, roomManager, playerManager)
        
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Bereitschaft:', error)
        socket.emit('error', { message: 'Fehler beim Aktualisieren der Bereitschaft' })
      }
    })

    // Spiel starten
    socket.on('start-game', async () => {
      try {
        const player = await playerManager.getPlayerBySocket(socket.id)
        if (!player) {
          socket.emit('error', { message: 'Spieler nicht gefunden' })
          return
        }
        
        const room = await roomManager.getRoom(player.roomId)
        if (!room) {
          socket.emit('error', { message: 'Raum nicht gefunden' })
          return
        }
        
        // Nur Host kann Spiel starten
        if (!roomManager.isPlayerHost(player.id, player.roomId)) {
          socket.emit('error', { message: 'Nur der Host kann das Spiel starten' })
          return
        }
        
        // Alle Spieler müssen bereit sein
        const playersInRoom = await playerManager.getPlayersInRoom(player.roomId)
        const allReady = playersInRoom.every(p => p.ready)
        
        if (!allReady) {
          socket.emit('error', { message: 'Nicht alle Spieler sind bereit' })
          return
        }
        
        if (playersInRoom.length < 2) {
          socket.emit('error', { message: 'Mindestens 2 Spieler erforderlich' })
          return
        }
        
        // Raum-Status aktualisieren
        await roomManager.updateRoomStatus(player.roomId, 'playing')
        
        // Spiel starten
        const gameState = await gameEngine.startGame(
          player.roomId,
          playersInRoom.map(p => ({ id: p.id, name: p.name })),
          room.gameSettings
        )
        
        // Spiel-Start an alle Spieler senden
        io.to(player.roomId).emit('game-started', { gameState })
        
        // Game State Updates starten
        startGameStateUpdates(player.roomId, io, gameEngine)
        
        console.log(`🚀 Spiel gestartet in Raum ${room.code}`)
        
      } catch (error) {
        console.error('Fehler beim Starten des Spiels:', error)
        socket.emit('error', { message: 'Fehler beim Starten des Spiels' })
      }
    })

    // Spiel neu starten
    socket.on('restart-game', async (data: RestartGameEvent) => {
      try {
        const player = await playerManager.getPlayerBySocket(socket.id)
        if (!player) {
          socket.emit('error', { message: 'Spieler nicht gefunden' })
          return
        }
        
        const room = await roomManager.getRoom(player.roomId)
        if (!room) {
          socket.emit('error', { message: 'Raum nicht gefunden' })
          return
        }
        
        // Nur Host kann Spiel neu starten
        if (!roomManager.isPlayerHost(player.id, player.roomId)) {
          socket.emit('error', { message: 'Nur der Host kann das Spiel neu starten' })
          return
        }
        
        // Aktuelles Spiel stoppen falls es läuft
        gameEngine.stopGame(player.roomId)
        
        // Raum-Status zurück auf 'waiting' setzen
        await roomManager.updateRoomStatus(player.roomId, 'waiting')
        
        // Alle Spieler auf 'nicht bereit' setzen
        const playersInRoom = await playerManager.getPlayersInRoom(player.roomId)
        for (const roomPlayer of playersInRoom) {
          await playerManager.updatePlayerReady(roomPlayer.id, false)
          await roomManager.updatePlayerReady(roomPlayer.id, false)
        }
        
        // Spielerliste aktualisieren
        await updatePlayerList(player.roomId, io, roomManager, playerManager)
        
        // Chat-Nachricht: Spiel neu gestartet
        const restartMessage: ChatMessageReceiveEvent = {
          playerId: 'system',
          playerName: 'System',
          message: 'Das Spiel wurde neu gestartet. Alle Spieler müssen sich erneut bereit machen.',
          timestamp: Date.now()
        }
        
        io.to(player.roomId).emit('chat-message', restartMessage)
        
        console.log(`🔄 Spiel neu gestartet in Raum ${room.code}`)
        
      } catch (error) {
        console.error('Fehler beim Neustarten des Spiels:', error)
        socket.emit('error', { message: 'Fehler beim Neustarten des Spiels' })
      }
    })

    // Spieler-Input
    socket.on('game-input', async (data: PlayerInputEvent) => {
      try {
        const player = await playerManager.getPlayerBySocket(socket.id)
        if (!player) {
          return
        }
        
        await gameEngine.processPlayerInput(player.roomId, player.id, data.direction)
        
      } catch (error) {
        console.error('Fehler beim Verarbeiten des Spieler-Inputs:', error)
      }
    })

    // Chat-Nachricht
    socket.on('chat-message', async (data: ChatMessageEvent) => {
      try {
        const player = await playerManager.getPlayerBySocket(socket.id)
        if (!player) {
          socket.emit('error', { message: 'Spieler nicht gefunden' })
          return
        }
        
        // Nachricht validieren
        const message = data.message.trim()
        if (!message || message.length > 200) {
          socket.emit('error', { message: 'Ungültige Nachricht' })
          return
        }
        
        const chatMessage: ChatMessageReceiveEvent = {
          playerId: player.id,
          playerName: player.name,
          message,
          timestamp: Date.now()
        }
        
        io.to(player.roomId).emit('chat-message', chatMessage)
        
      } catch (error) {
        console.error('Fehler beim Senden der Chat-Nachricht:', error)
        socket.emit('error', { message: 'Fehler beim Senden der Nachricht' })
      }
    })

    // Verbindung getrennt
    socket.on('disconnect', async () => {
      try {
        console.log(`🔌 Client getrennt: ${socket.id}`)
        
        const playerId = await playerManager.removePlayerBySocket(socket.id)
        if (!playerId) {
          return
        }
        
        const result = await roomManager.leaveRoom(playerId)
        if (!result) {
          return
        }
        
        const { roomId, shouldDeleteRoom } = result
        
        if (!shouldDeleteRoom) {
          // Spielerliste aktualisieren
          await updatePlayerList(roomId, io, roomManager, playerManager)
          
          // Spiel stoppen falls es läuft
          const gameState = gameEngine.getGameState(roomId)
          if (gameState && gameState.gameStatus === 'playing') {
            gameEngine.stopGame(roomId)
            await roomManager.updateRoomStatus(roomId, 'waiting')
            io.to(roomId).emit('game-ended', { results: [], duration: 0 })
          }
        }
        
      } catch (error) {
        console.error('Fehler beim Trennen der Verbindung:', error)
      }
    })
  })
}

// Hilfsfunktionen
function generatePlayerId(): string {
  return randomBytes(8).toString('hex')
}

async function updatePlayerList(
  roomId: string,
  io: Server,
  roomManager: RoomManager,
  playerManager: PlayerManager
) {
  const room = await roomManager.getRoom(roomId)
  if (!room) return
  
  const players = await playerManager.getFormattedPlayersInRoom(roomId, room.hostId)
  
  const update: PlayerListUpdateEvent = { players }
  io.to(roomId).emit('player-list-update', update)
}

function startGameStateUpdates(roomId: string, io: Server, gameEngine: GameEngine) {
  const updateInterval = setInterval(() => {
    const gameState = gameEngine.getGameState(roomId)
    if (!gameState) {
      clearInterval(updateInterval)
      return
    }
    
    if (gameState.gameStatus === 'finished') {
      clearInterval(updateInterval)
      
      // Spiel-Ergebnisse senden
      const results = gameEngine.getGameResults(roomId)
      const gameEndedEvent: GameEndedEvent = {
        results,
        duration: 0 // Wird von der Game Engine berechnet
      }
      
      io.to(roomId).emit('game-ended', gameEndedEvent)
      return
    }
    
    // Game State Update senden
    const update: GameStateUpdateEvent = {
      gameState,
      timestamp: Date.now()
    }
    
    io.to(roomId).emit('game-state-update', update)
  }, 1000 / 60) // 60 FPS
}