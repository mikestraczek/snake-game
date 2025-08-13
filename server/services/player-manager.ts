import type {
  PlayerData,
  Player,
  SessionData,
  PlayerColor,
  PLAYER_COLORS
} from '../../shared/types.js'

export class PlayerManager {
  private players = new Map<string, PlayerData>()
  private sessions = new Map<string, SessionData>() // socketId -> session
  private socketToPlayer = new Map<string, string>() // socketId -> playerId

  // Spieler erstellen oder aktualisieren
  async createOrUpdatePlayer(
    playerId: string,
    socketId: string,
    name: string,
    color: string,
    roomId: string
  ): Promise<PlayerData> {
    const existingPlayer = this.players.get(playerId)
    
    const playerData: PlayerData = {
      id: playerId,
      name: name.trim(),
      color,
      roomId,
      socketId,
      ready: existingPlayer?.ready || false,
      joinedAt: existingPlayer?.joinedAt || Date.now()
    }
    
    this.players.set(playerId, playerData)
    this.socketToPlayer.set(socketId, playerId)
    
    // Session erstellen/aktualisieren
    const sessionData: SessionData = {
      playerId,
      roomId,
      connectedAt: Date.now(),
      lastSeen: Date.now()
    }
    
    this.sessions.set(socketId, sessionData)
    
    console.log(`👤 Spieler ${name} (${playerId}) erstellt/aktualisiert`)
    
    return playerData
  }

  // Spieler abrufen
  async getPlayer(playerId: string): Promise<PlayerData | null> {
    return this.players.get(playerId) || null
  }

  // Spieler über Socket-ID abrufen
  async getPlayerBySocket(socketId: string): Promise<PlayerData | null> {
    const playerId = this.socketToPlayer.get(socketId)
    if (!playerId) {
      return null
    }
    return this.getPlayer(playerId)
  }

  // Spieler-Bereitschaft aktualisieren
  async updatePlayerReady(playerId: string, ready: boolean): Promise<PlayerData | null> {
    const player = this.players.get(playerId)
    if (!player) {
      return null
    }
    
    player.ready = ready
    console.log(`🎯 Spieler ${player.name} bereit: ${ready}`)
    
    return player
  }

  // Socket-ID eines Spielers aktualisieren
  async updatePlayerSocket(playerId: string, newSocketId: string): Promise<void> {
    const player = this.players.get(playerId)
    if (!player) {
      return
    }
    
    // Alte Socket-Zuordnung entfernen
    if (player.socketId) {
      this.socketToPlayer.delete(player.socketId)
      this.sessions.delete(player.socketId)
    }
    
    // Neue Socket-Zuordnung erstellen
    player.socketId = newSocketId
    this.socketToPlayer.set(newSocketId, playerId)
    
    const sessionData: SessionData = {
      playerId,
      roomId: player.roomId,
      connectedAt: Date.now(),
      lastSeen: Date.now()
    }
    
    this.sessions.set(newSocketId, sessionData)
    
    console.log(`🔄 Socket aktualisiert für Spieler ${player.name}: ${newSocketId}`)
  }

  // Spieler entfernen
  async removePlayer(playerId: string): Promise<void> {
    const player = this.players.get(playerId)
    if (!player) {
      return
    }
    
    // Socket-Zuordnungen entfernen
    if (player.socketId) {
      this.socketToPlayer.delete(player.socketId)
      this.sessions.delete(player.socketId)
    }
    
    this.players.delete(playerId)
    
    console.log(`🗑️ Spieler ${player.name} (${playerId}) entfernt`)
  }

  // Spieler über Socket entfernen
  async removePlayerBySocket(socketId: string): Promise<string | null> {
    const playerId = this.socketToPlayer.get(socketId)
    if (!playerId) {
      return null
    }
    
    await this.removePlayer(playerId)
    return playerId
  }

  // Alle Spieler in einem Raum abrufen
  async getPlayersInRoom(roomId: string): Promise<PlayerData[]> {
    const playersInRoom: PlayerData[] = []
    
    for (const player of this.players.values()) {
      if (player.roomId === roomId) {
        playersInRoom.push(player)
      }
    }
    
    return playersInRoom
  }

  // Spieler-Liste für Client formatieren
  async getFormattedPlayersInRoom(roomId: string, hostId: string): Promise<Player[]> {
    const players = await this.getPlayersInRoom(roomId)
    
    return players.map(player => ({
      id: player.id,
      name: player.name,
      color: player.color,
      ready: player.ready,
      isHost: player.id === hostId,
      score: 0, // Wird während des Spiels aktualisiert
      alive: true // Wird während des Spiels aktualisiert
    }))
  }

  // Session aktualisieren
  async updateSession(socketId: string): Promise<void> {
    const session = this.sessions.get(socketId)
    if (session) {
      session.lastSeen = Date.now()
    }
  }

  // Session abrufen
  async getSession(socketId: string): Promise<SessionData | null> {
    return this.sessions.get(socketId) || null
  }

  // Verfügbare Farbe für neuen Spieler finden
  getAvailableColor(roomId: string, excludePlayerId?: string): string {
    const playersInRoom = Array.from(this.players.values())
      .filter(p => p.roomId === roomId && p.id !== excludePlayerId)
    
    const usedColors = new Set(playersInRoom.map(p => p.color))
    
    // Finde erste verfügbare Farbe
    for (const color of PLAYER_COLORS) {
      if (!usedColors.has(color)) {
        return color
      }
    }
    
    // Fallback: Erste Farbe wenn alle belegt
    return PLAYER_COLORS[0]
  }

  // Prüfe ob Name in Raum verfügbar ist
  isNameAvailableInRoom(roomId: string, name: string, excludePlayerId?: string): boolean {
    const trimmedName = name.trim().toLowerCase()
    
    for (const player of this.players.values()) {
      if (
        player.roomId === roomId &&
        player.id !== excludePlayerId &&
        player.name.toLowerCase() === trimmedName
      ) {
        return false
      }
    }
    
    return true
  }

  // Spieler-Name validieren
  validatePlayerName(name: string): { valid: boolean; error?: string } {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      return { valid: false, error: 'Name darf nicht leer sein' }
    }
    
    if (trimmedName.length < 2) {
      return { valid: false, error: 'Name muss mindestens 2 Zeichen lang sein' }
    }
    
    if (trimmedName.length > 20) {
      return { valid: false, error: 'Name darf maximal 20 Zeichen lang sein' }
    }
    
    // Nur Buchstaben, Zahlen und Leerzeichen erlauben
    if (!/^[a-zA-Z0-9\s]+$/.test(trimmedName)) {
      return { valid: false, error: 'Name darf nur Buchstaben, Zahlen und Leerzeichen enthalten' }
    }
    
    return { valid: true }
  }

  // Inaktive Sessions bereinigen
  async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now()
    const maxInactiveTime = 10 * 60 * 1000 // 10 Minuten
    
    for (const [socketId, session] of this.sessions.entries()) {
      if (now - session.lastSeen > maxInactiveTime) {
        await this.removePlayerBySocket(socketId)
        console.log(`🧹 Inaktive Session bereinigt: ${socketId}`)
      }
    }
  }

  // Debug-Informationen
  getDebugInfo() {
    return {
      totalPlayers: this.players.size,
      totalSessions: this.sessions.size,
      players: Array.from(this.players.values()).map(player => ({
        id: player.id,
        name: player.name,
        roomId: player.roomId,
        ready: player.ready,
        joinedAt: new Date(player.joinedAt).toISOString()
      })),
      sessions: Array.from(this.sessions.values()).map(session => ({
        playerId: session.playerId,
        roomId: session.roomId,
        connectedAt: new Date(session.connectedAt).toISOString(),
        lastSeen: new Date(session.lastSeen).toISOString()
      }))
    }
  }
}