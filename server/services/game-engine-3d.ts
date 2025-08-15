import type {
  GameState3D,
  PlayerGameState3D,
  Position3D,
  Direction3D,
  GameSettings,
  GameResult
} from '../../shared/types.js'
import { BOARD_SIZES_3D } from '../../shared/types.js'
import { serviceManager } from './service-manager.js'

export class GameEngine3D {
  private gameStates = new Map<string, GameState3D>()
  private gameTimers = new Map<string, NodeJS.Timeout>()
  private gameStartTimes = new Map<string, number>()

  // Spiel starten
  async startGame(
    roomId: string,
    players: { id: string; name: string }[],
    gameSettings: GameSettings
  ): Promise<GameState3D> {
    // Bestehende Timer stoppen
    this.stopGame(roomId)
    
    const boardSize = BOARD_SIZES_3D[gameSettings.boardSize]
    const tileCount = boardSize.width / boardSize.gridSize
    
    // Spieler-Startpositionen generieren
    const playerGameStates: PlayerGameState3D[] = players.map((player, index) => {
      const startPosition = this.getPlayerStartPosition(index, tileCount)
      
      return {
        id: player.id,
        snake: [startPosition],
        direction: this.getPlayerStartDirection(index),
        score: 0,
        alive: true
      }
    })
    
    // Initiales Futter generieren
    const food = this.generateFood(playerGameStates, tileCount, 5)
    
    const gameState: GameState3D = {
      players: playerGameStates,
      food,
      gameStatus: 'playing'
    }
    
    this.gameStates.set(roomId, gameState)
    this.gameStartTimes.set(roomId, Date.now())
    
    // Game Loop starten
    this.startGameLoop(roomId, gameSettings)
    
    console.log(`🎮 3D-Spiel gestartet für Raum ${roomId} mit ${players.length} Spielern`)
    
    return gameState
  }

  // Spiel stoppen
  stopGame(roomId: string): void {
    const timer = this.gameTimers.get(roomId)
    if (timer) {
      clearInterval(timer)
      this.gameTimers.delete(roomId)
    }
    
    const gameState = this.gameStates.get(roomId)
    if (gameState) {
      gameState.gameStatus = 'finished'
    }
    
    console.log(`⏹️ 3D-Spiel gestoppt für Raum ${roomId}`)
  }

  // Spieler-Input verarbeiten
  async processPlayerInput(
    roomId: string,
    playerId: string,
    direction: Direction3D
  ): Promise<boolean> {
    const gameState = this.gameStates.get(roomId)
    if (!gameState || gameState.gameStatus !== 'playing') {
      return false
    }
    
    const player = gameState.players.find(p => p.id === playerId)
    if (!player || !player.alive) {
      return false
    }
    
    // Verhindere Rückwärtsbewegung
    const oppositeDirections: Record<Direction3D, Direction3D> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
      forward: 'backward',
      backward: 'forward'
    }
    
    if (player.direction === oppositeDirections[direction]) {
      return false
    }
    
    player.direction = direction
    return true
  }

  // Aktuellen Spielzustand abrufen
  getGameState(roomId: string): GameState3D | null {
    return this.gameStates.get(roomId) || null
  }

  // Spiel-Ergebnisse generieren
  getGameResults(roomId: string): GameResult[] {
    const gameState = this.gameStates.get(roomId)
    const startTime = this.gameStartTimes.get(roomId)
    
    if (!gameState || !startTime) {
      return []
    }
    
    const duration = Date.now() - startTime
    
    // Spieler nach Score sortieren
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score)
    
    return sortedPlayers.map((player, index) => ({
      playerId: player.id,
      playerName: '', // Wird vom Aufrufer gesetzt
      score: player.score,
      rank: index + 1,
      survivalTime: duration
    }))
  }

  // Private Methoden
  private startGameLoop(roomId: string, gameSettings: GameSettings): void {
    const tickRate = Math.max(150, 400 - (gameSettings.gameSpeed * 50)) // Etwas langsamer für 3D
    
    const timer = setInterval(async () => {
      await this.updateGame(roomId, gameSettings)
    }, tickRate)
    
    this.gameTimers.set(roomId, timer)
  }

  // Bot-Bewegungen verarbeiten
  private async processBotMoves(
    roomId: string,
    gameState: GameState3D,
    gameSettings: GameSettings
  ): Promise<void> {
    try {
      const botMoves = await serviceManager.getAllBotMoves3D(roomId, gameState, gameSettings)
      
      for (const [botId, direction] of botMoves.entries()) {
        await this.processPlayerInput(roomId, botId, direction)
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der 3D Bot-Bewegungen:', error)
    }
  }

  private async updateGame(roomId: string, gameSettings: GameSettings): Promise<void> {
    const gameState = this.gameStates.get(roomId)
    if (!gameState || gameState.gameStatus !== 'playing') {
      return
    }
    
    const boardSize = BOARD_SIZES_3D[gameSettings.boardSize]
    const tileCount = boardSize.width / boardSize.gridSize
    
    // Bot-Bewegungen abrufen und anwenden
    await this.processBotMoves(roomId, gameState, gameSettings)
    
    // Alle lebenden Spieler bewegen
    for (const player of gameState.players) {
      if (!player.alive) continue
      
      // Neue Kopfposition berechnen
      const head = player.snake[0]
      const newHead = this.getNextPosition(head, player.direction)
      
      // Kollisionsprüfung
      if (this.checkCollision(newHead, gameState.players, tileCount)) {
        player.alive = false
        console.log(`💀 3D-Spieler ${player.id} eliminiert`)
        continue
      }
      
      // Schlange bewegen
      player.snake.unshift(newHead)
      
      // Futter-Kollision prüfen
      const foodIndex = gameState.food.findIndex(
        food => food.x === newHead.x && food.y === newHead.y && food.z === newHead.z
      )
      
      if (foodIndex !== -1) {
        // Futter gegessen
        player.score += 10
        gameState.food.splice(foodIndex, 1)
        
        // Neues Futter generieren
        const newFood = this.generateFood(gameState.players, tileCount, 1)
        gameState.food.push(...newFood)
      } else {
        // Schwanz entfernen wenn kein Futter gegessen
        player.snake.pop()
      }
    }
    
    // Prüfen ob Spiel beendet
    const alivePlayers = gameState.players.filter(p => p.alive)
    if (alivePlayers.length <= 1) {
      gameState.gameStatus = 'finished'
      this.stopGame(roomId)
      console.log(`🏁 3D-Spiel beendet für Raum ${roomId}`)
    }
  }

  private getNextPosition(position: Position3D, direction: Direction3D): Position3D {
    const { x, y, z } = position
    
    switch (direction) {
      case 'up':
        return { x, y: y - 1, z }
      case 'down':
        return { x, y: y + 1, z }
      case 'left':
        return { x: x - 1, y, z }
      case 'right':
        return { x: x + 1, y, z }
      case 'forward':
        return { x, y, z: z + 1 }
      case 'backward':
        return { x, y, z: z - 1 }
      default:
        return position
    }
  }

  private checkCollision(
    position: Position3D,
    players: PlayerGameState3D[],
    tileCount: number
  ): boolean {
    // Wand-Kollision
    if (
      position.x < 0 || position.x >= tileCount ||
      position.y < 0 || position.y >= tileCount ||
      position.z < 0 || position.z >= tileCount
    ) {
      return true
    }
    
    // Schlangen-Kollision
    for (const player of players) {
      if (!player.alive) continue
      
      for (const segment of player.snake) {
        if (
          segment.x === position.x &&
          segment.y === position.y &&
          segment.z === position.z
        ) {
          return true
        }
      }
    }
    
    return false
  }

  private generateFood(
    players: PlayerGameState3D[],
    tileCount: number,
    count: number
  ): Position3D[] {
    const food: Position3D[] = []
    const occupiedPositions = new Set<string>()
    
    // Alle besetzten Positionen sammeln
    for (const player of players) {
      for (const segment of player.snake) {
        occupiedPositions.add(`${segment.x},${segment.y},${segment.z}`)
      }
    }
    
    // Futter generieren
    for (let i = 0; i < count; i++) {
      let attempts = 0
      let position: Position3D
      
      do {
        position = {
          x: Math.floor(Math.random() * tileCount),
          y: Math.floor(Math.random() * tileCount),
          z: Math.floor(Math.random() * tileCount)
        }
        attempts++
      } while (
        occupiedPositions.has(`${position.x},${position.y},${position.z}`) &&
        attempts < 100
      )
      
      if (attempts < 100) {
        food.push(position)
        occupiedPositions.add(`${position.x},${position.y},${position.z}`)
      }
    }
    
    return food
  }

  private getPlayerStartPosition(playerIndex: number, tileCount: number): Position3D {
    const margin = 3
    const center = Math.floor(tileCount / 2)
    
    const positions = [
      { x: margin, y: margin, z: center }, // Vorne links
      { x: tileCount - margin, y: tileCount - margin, z: center }, // Hinten rechts
      { x: tileCount - margin, y: margin, z: center }, // Vorne rechts
      { x: margin, y: tileCount - margin, z: center }, // Hinten links
      { x: center, y: margin, z: margin }, // Oben vorne
      { x: center, y: tileCount - margin, z: tileCount - margin }, // Unten hinten
      { x: center, y: margin, z: tileCount - margin }, // Oben hinten
      { x: center, y: tileCount - margin, z: margin } // Unten vorne
    ]
    
    return positions[playerIndex % positions.length]
  }

  private getPlayerStartDirection(playerIndex: number): Direction3D {
    const directions: Direction3D[] = ['right', 'left', 'left', 'right', 'down', 'up', 'forward', 'backward']
    return directions[playerIndex % directions.length]
  }

  // Cleanup
  cleanup(): void {
    for (const timer of this.gameTimers.values()) {
      clearInterval(timer)
    }
    this.gameTimers.clear()
    this.gameStates.clear()
    this.gameStartTimes.clear()
  }

  // Debug-Informationen
  getDebugInfo() {
    return {
      activeGames: this.gameStates.size,
      games: Array.from(this.gameStates.entries()).map(([roomId, state]) => ({
        roomId,
        status: state.gameStatus,
        players: state.players.length,
        alivePlayers: state.players.filter(p => p.alive).length,
        food: state.food.length
      }))
    }
  }
}