import { PlayerManager } from './player-manager.js'
import { RoomManager } from './room-manager.js'
import { BotManager } from './bot-manager.js'
import type {
  BotDifficulty,
  Player,
  GameState,
  GameState3D,
  GameSettings,
  Direction,
  Direction3D
} from '../../shared/types.js'

export class ServiceManager {
  public playerManager: PlayerManager
  public roomManager: RoomManager
  public botManager: BotManager

  constructor() {
    this.playerManager = new PlayerManager()
    this.roomManager = new RoomManager()
    this.botManager = new BotManager()
  }

  // Bot zu Raum hinzufügen
  async addBotToRoom(roomId: string, difficulty: BotDifficulty): Promise<Player | null> {
    try {
      // Prüfe ob Raum existiert
      const room = await this.roomManager.getRoom(roomId)
      if (!room) {
        console.log(`❌ Raum ${roomId} nicht gefunden`)
        return null
      }

      // Prüfe ob Raum voll ist
      if (room.players.length >= room.gameSettings.maxPlayers) {
        console.log(`❌ Raum ${roomId} ist bereits voll`)
        return null
      }

      // Hole verwendete Farben
      const playersInRoom = await this.playerManager.getPlayersInRoom(roomId)
      const usedColors = playersInRoom.map(p => p.color)

      // Erstelle Bot
      const botData = await this.botManager.addBot(roomId, difficulty, usedColors)
      
      // Füge Bot als Spieler hinzu
      const playerData = await this.playerManager.addBotAsPlayer(botData)
      
      // Füge Bot zur Raum-Spielerliste hinzu
      room.players.push(botData.id)
      
      // Formatiere für Client
      const formattedPlayer: Player = {
        id: playerData.id,
        name: playerData.name,
        color: playerData.color,
        ready: playerData.ready,
        isHost: false,
        score: 0,
        alive: true,
        isBot: true
      }

      console.log(`✅ Bot ${botData.name} zu Raum ${roomId} hinzugefügt`)
      return formattedPlayer
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Bots:', error)
      return null
    }
  }

  // Bot aus Raum entfernen
  async removeBotFromRoom(roomId: string, botId: string): Promise<boolean> {
    try {
      // Entferne Bot aus Bot-Manager
      const botRemoved = await this.botManager.removeBot(botId)
      if (!botRemoved) {
        return false
      }

      // Entferne Bot aus Player-Manager
      await this.playerManager.removePlayer(botId)

      // Entferne Bot aus Raum
      const room = await this.roomManager.getRoom(roomId)
      if (room) {
        room.players = room.players.filter(id => id !== botId)
      }

      console.log(`✅ Bot ${botId} aus Raum ${roomId} entfernt`)
      return true
    } catch (error) {
      console.error('Fehler beim Entfernen des Bots:', error)
      return false
    }
  }

  // Alle Bots aus Raum entfernen
  async removeAllBotsFromRoom(roomId: string): Promise<void> {
    try {
      const bots = await this.playerManager.getBotsInRoom(roomId)
      
      for (const bot of bots) {
        await this.removeBotFromRoom(roomId, bot.id)
      }

      console.log(`✅ Alle Bots aus Raum ${roomId} entfernt`)
    } catch (error) {
      console.error('Fehler beim Entfernen aller Bots:', error)
    }
  }

  // Bot-Bewegung für 2D-Spiel abrufen
  async getBotMove2D(botId: string, gameState: GameState, gameSettings: GameSettings): Promise<Direction | null> {
    return this.botManager.getBotMove(botId, gameState, gameSettings)
  }

  // Bot-Bewegung für 3D-Spiel abrufen
  async getBotMove3D(botId: string, gameState: GameState3D, gameSettings: GameSettings): Promise<Direction3D | null> {
    return this.botManager.getBotMove3D(botId, gameState, gameSettings)
  }

  // Alle Bot-Bewegungen für aktuellen Game State abrufen
  async getAllBotMoves2D(roomId: string, gameState: GameState, gameSettings: GameSettings): Promise<Map<string, Direction>> {
    const botMoves = new Map<string, Direction>()
    const bots = await this.playerManager.getBotsInRoom(roomId)

    for (const bot of bots) {
      const move = await this.getBotMove2D(bot.id, gameState, gameSettings)
      if (move) {
        botMoves.set(bot.id, move)
      }
    }

    return botMoves
  }

  // Alle Bot-Bewegungen für 3D-Spiel abrufen
  async getAllBotMoves3D(roomId: string, gameState: GameState3D, gameSettings: GameSettings): Promise<Map<string, Direction3D>> {
    const botMoves = new Map<string, Direction3D>()
    const bots = await this.playerManager.getBotsInRoom(roomId)

    for (const bot of bots) {
      const move = await this.getBotMove3D(bot.id, gameState, gameSettings)
      if (move) {
        botMoves.set(bot.id, move)
      }
    }

    return botMoves
  }

  // Prüfe ob Spieler ein Bot ist
  async isPlayerBot(playerId: string): Promise<boolean> {
    const player = await this.playerManager.getPlayer(playerId)
    return player?.isBot || false
  }

  // Hole Bot-Anzahl in Raum
  async getBotCountInRoom(roomId: string): Promise<number> {
    const bots = await this.playerManager.getBotsInRoom(roomId)
    return bots.length
  }

  // Hole echte Spieler-Anzahl in Raum
  async getRealPlayerCountInRoom(roomId: string): Promise<number> {
    const realPlayers = await this.playerManager.getRealPlayersInRoom(roomId)
    return realPlayers.length
  }

  // Cleanup beim Raum löschen
  async cleanupRoomBots(roomId: string): Promise<void> {
    await this.removeAllBotsFromRoom(roomId)
    await this.botManager.removeAllBotsInRoom(roomId)
  }

  // Debug-Informationen
  getDebugInfo() {
    return {
      players: this.playerManager.getDebugInfo(),
      rooms: this.roomManager.getDebugInfo(),
      bots: this.botManager.getDebugInfo()
    }
  }
}

// Singleton-Instanz
export const serviceManager = new ServiceManager()