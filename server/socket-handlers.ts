import { Server, Socket } from 'socket.io'
import { randomBytes } from 'crypto'
import type { RoomManager } from './services/room-manager.js'
import type { GameEngine } from './services/game-engine.js'
import type { GameEngine3D } from './services/game-engine-3d.js'
import type { PlayerManager } from './services/player-manager.js'
import { serviceManager } from './services/service-manager.js'
import type {
  JoinRoomEvent,
  CreateRoomEvent,
  PlayerInputEvent,
  PlayerInputEvent3D,
  PlayerReadyEvent,
  ChatMessageEvent,
  RestartGameEvent,
  UpdateGameSettingsEvent,
  AddBotEvent,
  RemoveBotEvent,
  RoomJoinedEvent,
  PlayerListUpdateEvent,
  GameStateUpdateEvent,
  GameEndedEvent,
  ChatMessageReceiveEvent,
  GameSettingsUpdatedEvent,
  BotAddedEvent,
  BotRemovedEvent
} from '../shared/types.js'

type Services = {
  roomManager: RoomManager
  gameEngine: GameEngine
  gameEngine3D: GameEngine3D
  playerManager: PlayerManager
}

export function setupSocketHandlers(io: Server, services: Services) {
  const { roomManager, gameEngine, gameEngine3D, playerManager } = services

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
        
        // Automatische Farbzuweisung
        const availableColor = playerManager.getAvailableColor('temp')
        
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
        
        // Automatische Farbzuweisung
        const availableColor = playerManager.getAvailableColor(room.id)
        
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
        
        // Spiel starten (2D oder 3D basierend auf Einstellungen)
        const gameState = room.gameSettings.is3D
          ? await gameEngine3D.startGame(
              player.roomId,
              playersInRoom.map(p => ({ id: p.id, name: p.name })),
              room.gameSettings
            )
          : await gameEngine.startGame(
              player.roomId,
              playersInRoom.map(p => ({ id: p.id, name: p.name })),
              room.gameSettings
            )
        
        // Spiel-Start an alle Spieler senden
        io.to(player.roomId).emit('game-started', { gameState })
        
        // Game State Updates starten
        if (room.gameSettings.is3D) {
          startGameStateUpdates3D(player.roomId, io, gameEngine3D, playerManager)
        } else {
          startGameStateUpdates(player.roomId, io, gameEngine, playerManager)
        }
        
        console.log(`🚀 Spiel gestartet in Raum ${room.code}`)
        
      } catch (error) {
        console.error('Fehler beim Starten des Spiels:', error)
        socket.emit('error', { message: 'Fehler beim Starten des Spiels' })
      }
    })

    // Spiel neu starten
    socket.on('restart-game', async (_data: RestartGameEvent) => {
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
        gameEngine3D.stopGame(player.roomId)
        
        // Raum-Status zurück auf 'waiting' setzen
        await roomManager.updateRoomStatus(player.roomId, 'waiting')
        
        // Alle Spieler auf 'nicht bereit' setzen, aber Bots automatisch wieder bereit machen
        const playersInRoom = await playerManager.getPlayersInRoom(player.roomId)
        for (const roomPlayer of playersInRoom) {
          await playerManager.updatePlayerReady(roomPlayer.id, false)
          await roomManager.updatePlayerReady(roomPlayer.id, false)
          
          // Bots automatisch wieder bereit machen
          if (roomPlayer.isBot) {
            await playerManager.updatePlayerReady(roomPlayer.id, true)
            await roomManager.updatePlayerReady(roomPlayer.id, true)
          }
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

    // Spieler-Input (2D)
    socket.on('game-input', async (data: PlayerInputEvent) => {
      try {
        const player = await playerManager.getPlayerBySocket(socket.id)
        if (!player) {
          return
        }
        
        await gameEngine.processPlayerInput(player.roomId, player.id, data.direction)
        
      } catch (error) {
        console.error('Fehler beim Verarbeiten des 2D Spieler-Inputs:', error)
      }
    })

    // Spieler-Input (3D)
    socket.on('game-input-3d', async (data: PlayerInputEvent3D) => {
      try {
        const player = await playerManager.getPlayerBySocket(socket.id)
        if (!player) {
          return
        }
        
        await gameEngine3D.processPlayerInput(player.roomId, player.id, data.direction)
        
      } catch (error) {
        console.error('Fehler beim Verarbeiten des 3D Spieler-Inputs:', error)
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

    // Bot hinzufügen
    socket.on('add-bot', async (data: AddBotEvent) => {
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
        
        // Nur Host kann Bots hinzufügen
        if (!roomManager.isPlayerHost(player.id, player.roomId)) {
          socket.emit('error', { message: 'Nur der Host kann Bots hinzufügen' })
          return
        }
        
        // Bots nur hinzufügbar wenn Spiel nicht läuft
        if (room.status === 'playing') {
          socket.emit('error', { message: 'Bots können nicht während des Spiels hinzugefügt werden' })
          return
        }
        
        // Bot hinzufügen
        const bot = await serviceManager.addBotToRoom(player.roomId, data.difficulty)
        if (!bot) {
          socket.emit('error', { message: 'Bot konnte nicht hinzugefügt werden' })
          return
        }
        
        // Bot-hinzugefügt Event senden
        const botAddedEvent: BotAddedEvent = { bot }
        io.to(player.roomId).emit('bot-added', botAddedEvent)
        
        // Spielerliste aktualisieren
        await updatePlayerList(player.roomId, io, roomManager, playerManager)
        
        // Chat-Nachricht: Bot hinzugefügt
        const botMessage: ChatMessageReceiveEvent = {
          playerId: 'system',
          playerName: 'System',
          message: `Bot ${bot.name} (${data.difficulty}) wurde hinzugefügt`,
          timestamp: Date.now()
        }
        
        io.to(player.roomId).emit('chat-message', botMessage)
        
        console.log(`🤖 Bot ${bot.name} zu Raum ${room.code} hinzugefügt`)
        
      } catch (error) {
        console.error('Fehler beim Hinzufügen des Bots:', error)
        socket.emit('error', { message: 'Fehler beim Hinzufügen des Bots' })
      }
    })

    // Bot entfernen
    socket.on('remove-bot', async (data: RemoveBotEvent) => {
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
        
        // Nur Host kann Bots entfernen
        if (!roomManager.isPlayerHost(player.id, player.roomId)) {
          socket.emit('error', { message: 'Nur der Host kann Bots entfernen' })
          return
        }
        
        // Bots nur entfernbar wenn Spiel nicht läuft
        if (room.status === 'playing') {
          socket.emit('error', { message: 'Bots können nicht während des Spiels entfernt werden' })
          return
        }
        
        // Bot-Namen für Chat-Nachricht abrufen
        const botPlayer = await playerManager.getPlayer(data.botId)
        const botName = botPlayer?.name || 'Unbekannt'
        
        // Bot entfernen
        const success = await serviceManager.removeBotFromRoom(player.roomId, data.botId)
        if (!success) {
          socket.emit('error', { message: 'Bot konnte nicht entfernt werden' })
          return
        }
        
        // Bot-entfernt Event senden
        const botRemovedEvent: BotRemovedEvent = { botId: data.botId }
        io.to(player.roomId).emit('bot-removed', botRemovedEvent)
        
        // Spielerliste aktualisieren
        await updatePlayerList(player.roomId, io, roomManager, playerManager)
        
        // Chat-Nachricht: Bot entfernt
        const botMessage: ChatMessageReceiveEvent = {
          playerId: 'system',
          playerName: 'System',
          message: `Bot ${botName} wurde entfernt`,
          timestamp: Date.now()
        }
        
        io.to(player.roomId).emit('chat-message', botMessage)
        
        console.log(`🗑️ Bot ${botName} aus Raum ${room.code} entfernt`)
        
      } catch (error) {
        console.error('Fehler beim Entfernen des Bots:', error)
        socket.emit('error', { message: 'Fehler beim Entfernen des Bots' })
      }
    })

    // Spieleinstellungen aktualisieren
    socket.on('update-game-settings', async (data: UpdateGameSettingsEvent) => {
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
        
        // Nur Host kann Einstellungen ändern
        if (!roomManager.isPlayerHost(player.id, player.roomId)) {
          socket.emit('error', { message: 'Nur der Host kann die Einstellungen ändern' })
          return
        }
        
        // Einstellungen nur änderbar wenn Spiel nicht läuft
        if (room.status === 'playing') {
          socket.emit('error', { message: 'Einstellungen können nicht während des Spiels geändert werden' })
          return
        }
        
        // Einstellungen validieren und aktualisieren
        const updatedSettings = {
          ...room.gameSettings,
          ...data.gameSettings
        }
        
        // Validierung der Einstellungen
        if (updatedSettings.maxPlayers < 2 || updatedSettings.maxPlayers > 4) {
          socket.emit('error', { message: 'Maximale Spieleranzahl muss zwischen 2 und 4 liegen' })
          return
        }
        
        if (updatedSettings.gameSpeed < 1 || updatedSettings.gameSpeed > 5) {
           socket.emit('error', { message: 'Ungültige Spielgeschwindigkeit' })
           return
         }
        
        if (!['small', 'medium', 'large'].includes(updatedSettings.boardSize)) {
          socket.emit('error', { message: 'Ungültige Spielfeldgröße' })
          return
        }
        
        if (!['classic', 'battle-royale'].includes(updatedSettings.gameMode)) {
           socket.emit('error', { message: 'Ungültiger Spielmodus' })
           return
         }
        
        // Einstellungen im Raum aktualisieren
        await roomManager.updateGameSettings(player.roomId, updatedSettings)
        
        // Aktualisierte Einstellungen an alle Spieler senden
        const settingsUpdate: GameSettingsUpdatedEvent = {
          gameSettings: updatedSettings
        }
        
        io.to(player.roomId).emit('game-settings-updated', settingsUpdate)
        
        console.log(`⚙️ Spieleinstellungen aktualisiert in Raum ${room.code}`)
        
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Spieleinstellungen:', error)
        socket.emit('error', { message: 'Fehler beim Aktualisieren der Einstellungen' })
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
          
          // Spiel stoppen falls es läuft (2D oder 3D)
          const gameState = gameEngine.getGameState(roomId)
          const gameState3D = gameEngine3D.getGameState(roomId)
          
          if (gameState && gameState.gameStatus === 'playing') {
            gameEngine.stopGame(roomId)
            await roomManager.updateRoomStatus(roomId, 'waiting')
            io.to(roomId).emit('game-ended', { results: [], duration: 0 })
          }
          
          if (gameState3D && gameState3D.gameStatus === 'playing') {
            gameEngine3D.stopGame(roomId)
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

function startGameStateUpdates(roomId: string, io: Server, gameEngine: GameEngine, playerManager: PlayerManager) {
  const updateInterval = setInterval(async () => {
    const gameState = gameEngine.getGameState(roomId)
    if (!gameState) {
      clearInterval(updateInterval)
      return
    }
    
    if (gameState.gameStatus === 'finished') {
      clearInterval(updateInterval)
      
      // Spiel-Ergebnisse mit Spielernamen abrufen
      const results = gameEngine.getGameResults(roomId)
      
      // Spielernamen zu den Results hinzufügen
      const resultsWithNames = await Promise.all(
        results.map(async (result) => {
          const player = await playerManager.getPlayer(result.playerId)
          return {
            ...result,
            playerName: player?.name || 'Unbekannt'
          }
        })
      )
      
      const gameEndedEvent: GameEndedEvent = {
        results: resultsWithNames,
        duration: 0 // Wird von der Game Engine berechnet
      }
      
      io.to(roomId).emit('game-ended', gameEndedEvent)
      return
    }
    
    // Game State Update senden
    const update: GameStateUpdateEvent = {
      gameState: gameState as any, // 3D GameState wird als 2D behandelt für Kompatibilität
      timestamp: Date.now()
    }
    
    io.to(roomId).emit('game-state-update', update)
  }, 1000 / 60) // 60 FPS
}

function startGameStateUpdates3D(roomId: string, io: Server, gameEngine3D: GameEngine3D, playerManager: PlayerManager) {
  const updateInterval = setInterval(async () => {
    const gameState = gameEngine3D.getGameState(roomId)
    if (!gameState) {
      clearInterval(updateInterval)
      return
    }
    
    if (gameState.gameStatus === 'finished') {
      clearInterval(updateInterval)
      
      // Spiel-Ergebnisse mit Spielernamen abrufen
      const results = gameEngine3D.getGameResults(roomId)
      
      // Spielernamen zu den Results hinzufügen
      const resultsWithNames = await Promise.all(
        results.map(async (result) => {
          const player = await playerManager.getPlayer(result.playerId)
          return {
            ...result,
            playerName: player?.name || 'Unbekannt'
          }
        })
      )
      
      const gameEndedEvent: GameEndedEvent = {
        results: resultsWithNames,
        duration: 0 // Wird von der Game Engine berechnet
      }
      
      io.to(roomId).emit('game-ended', gameEndedEvent)
      return
    }
    
    // Game State Update senden
    const update: GameStateUpdateEvent = {
      gameState: gameState as any, // 3D GameState wird als 2D behandelt für Kompatibilität
      timestamp: Date.now()
    }
    
    io.to(roomId).emit('game-state-update', update)
  }, 1000 / 60) // 60 FPS
}