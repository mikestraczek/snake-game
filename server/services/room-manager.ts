import { randomBytes } from 'crypto'
import type {
  RoomData,
  PlayerData,
  GameSettings,
  RoomInfo,
  Player
} from '../../shared/types.js'

export class RoomManager {
  private rooms = new Map<string, RoomData>()
  private roomCodes = new Map<string, string>() // code -> roomId
  private playerRooms = new Map<string, string>() // playerId -> roomId

  // Erstelle einen neuen Raum
  async createRoom(hostId: string, gameSettings: GameSettings): Promise<{ roomId: string; roomCode: string }> {
    const roomId = this.generateRoomId()
    const roomCode = this.generateRoomCode()
    
    const roomData: RoomData = {
      id: roomId,
      code: roomCode,
      hostId,
      players: [hostId],
      gameSettings,
      status: 'waiting',
      createdAt: Date.now(),
      lastActivity: Date.now()
    }
    
    this.rooms.set(roomId, roomData)
    this.roomCodes.set(roomCode, roomId)
    this.playerRooms.set(hostId, roomId)
    
    console.log(`🏠 Raum erstellt: ${roomCode} (${roomId}) von ${hostId}`)
    
    return { roomId, roomCode }
  }

  // Spieler zu Raum hinzufügen
  async joinRoom(playerId: string, roomCode: string): Promise<RoomData | null> {
    const roomId = this.roomCodes.get(roomCode)
    if (!roomId) {
      console.log(`❌ Raum-Code nicht gefunden: ${roomCode}`)
      return null
    }
    
    const room = this.rooms.get(roomId)
    if (!room) {
      console.log(`❌ Raum nicht gefunden: ${roomId}`)
      return null
    }
    
    if (room.status !== 'waiting') {
      console.log(`❌ Raum ${roomCode} ist nicht im Wartezustand`)
      return null
    }
    
    if (room.players.length >= room.gameSettings.maxPlayers) {
      console.log(`❌ Raum ${roomCode} ist voll`)
      return null
    }
    
    if (room.players.includes(playerId)) {
      console.log(`⚠️ Spieler ${playerId} ist bereits in Raum ${roomCode}`)
      return room
    }
    
    room.players.push(playerId)
    room.lastActivity = Date.now()
    this.playerRooms.set(playerId, roomId)
    
    console.log(`✅ Spieler ${playerId} ist Raum ${roomCode} beigetreten`)
    
    return room
  }

  // Spieler aus Raum entfernen
  async leaveRoom(playerId: string): Promise<{ roomId: string; shouldDeleteRoom: boolean } | null> {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) {
      return null
    }
    
    const room = this.rooms.get(roomId)
    if (!room) {
      this.playerRooms.delete(playerId)
      return null
    }
    
    room.players = room.players.filter(id => id !== playerId)
    room.lastActivity = Date.now()
    this.playerRooms.delete(playerId)
    
    console.log(`👋 Spieler ${playerId} hat Raum ${room.code} verlassen`)
    
    // Wenn Raum leer ist, lösche ihn
    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      this.roomCodes.delete(room.code)
      console.log(`🗑️ Leerer Raum ${room.code} wurde gelöscht`)
      return { roomId, shouldDeleteRoom: true }
    }
    
    // Wenn Host verlassen hat, neuen Host bestimmen
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0]
      console.log(`👑 Neuer Host für Raum ${room.code}: ${room.hostId}`)
    }
    
    return { roomId, shouldDeleteRoom: false }
  }

  // Raum-Informationen abrufen
  async getRoomInfo(roomId: string): Promise<RoomInfo | null> {
    const room = this.rooms.get(roomId)
    if (!room) {
      return null
    }
    
    return {
      roomId: room.id,
      playerCount: room.players.length,
      maxPlayers: room.gameSettings.maxPlayers,
      gameStatus: room.status,
      gameSettings: room.gameSettings
    }
  }

  // Raum-Daten abrufen
  async getRoom(roomId: string): Promise<RoomData | null> {
    return this.rooms.get(roomId) || null
  }

  // Raum-Status aktualisieren
  async updateRoomStatus(roomId: string, status: RoomData['status']): Promise<void> {
    const room = this.rooms.get(roomId)
    if (room) {
      room.status = status
      room.lastActivity = Date.now()
      console.log(`🔄 Raum ${room.code} Status: ${status}`)
    }
  }

  // Spieler-Bereitschaft aktualisieren
  async updatePlayerReady(playerId: string, ready: boolean): Promise<string | null> {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) {
      return null
    }
    
    const room = this.rooms.get(roomId)
    if (room) {
      room.lastActivity = Date.now()
    }
    
    return roomId
  }

  // Aktive Räume abrufen
  async getActiveRooms(): Promise<RoomInfo[]> {
    const activeRooms: RoomInfo[] = []
    
    for (const room of this.rooms.values()) {
      if (room.status === 'waiting' && room.players.length < room.gameSettings.maxPlayers) {
        activeRooms.push({
          roomId: room.id,
          playerCount: room.players.length,
          maxPlayers: room.gameSettings.maxPlayers,
          gameStatus: room.status,
          gameSettings: room.gameSettings
        })
      }
    }
    
    return activeRooms
  }

  // Inaktive Räume bereinigen
  async cleanupInactiveRooms(): Promise<void> {
    const now = Date.now()
    const maxInactiveTime = 30 * 60 * 1000 // 30 Minuten
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivity > maxInactiveTime) {
        // Entferne alle Spieler aus dem Raum
        for (const playerId of room.players) {
          this.playerRooms.delete(playerId)
        }
        
        this.rooms.delete(roomId)
        this.roomCodes.delete(room.code)
        console.log(`🧹 Inaktiver Raum ${room.code} wurde bereinigt`)
      }
    }
  }

  // Spieler-Raum-Zuordnung abrufen
  getPlayerRoom(playerId: string): string | undefined {
    return this.playerRooms.get(playerId)
  }

  // Prüfe ob Spieler Host ist
  isPlayerHost(playerId: string, roomId: string): boolean {
    const room = this.rooms.get(roomId)
    return room?.hostId === playerId || false
  }

  // Alle Spieler in einem Raum abrufen
  getRoomPlayers(roomId: string): string[] {
    const room = this.rooms.get(roomId)
    return room?.players || []
  }

  // Private Hilfsmethoden
  private generateRoomId(): string {
    return randomBytes(16).toString('hex')
  }

  private generateRoomCode(): string {
    // Generiere einen 6-stelligen Code aus Großbuchstaben und Zahlen
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    
    do {
      code = ''
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
    } while (this.roomCodes.has(code))
    
    return code
  }

  // Debug-Informationen
  getDebugInfo() {
    return {
      totalRooms: this.rooms.size,
      totalPlayers: this.playerRooms.size,
      rooms: Array.from(this.rooms.values()).map(room => ({
        code: room.code,
        players: room.players.length,
        status: room.status,
        lastActivity: new Date(room.lastActivity).toISOString()
      }))
    }
  }
}