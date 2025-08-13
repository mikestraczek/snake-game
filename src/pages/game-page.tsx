import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Volume2, VolumeX, Users, Trophy, Eye } from 'lucide-react'
import { useSocket } from '../hooks/use-socket'
import { useGame, useGameSelectors } from '../stores/game-store'
import { useAudio } from '../hooks/use-audio'
import { BOARD_SIZES } from '../../shared/types'
import type { Direction, Position, PlayerGameState } from '../../shared/types'

function GamePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { sendGameInput } = useSocket()
  
  const roomInfo = useGameSelectors.roomInfo()
  const players = useGameSelectors.players()
  const { gameState, gameSettings } = useGameSelectors.gameStatus()
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSpectator, setIsSpectator] = useState(false)
  const { playSound, settings, updateSettings } = useAudio()
  const previousGameStateRef = useRef<typeof gameState>(null)
  
  // Redirect wenn nicht in Raum oder Spiel nicht läuft
  useEffect(() => {
    if (!roomInfo.roomId || roomInfo.roomId !== roomId) {
      navigate('/')
      return
    }
    
    if (gameState?.gameStatus === 'finished') {
      navigate(`/results/${roomId}`)
      return
    }
    
    if (!gameState || gameState.gameStatus !== 'playing') {
      navigate(`/lobby/${roomId}`)
      return
    }
  }, [roomInfo.roomId, roomId, gameState?.gameStatus, navigate])
  
  // Prüfe ob Spieler noch lebt und spiele Sound-Effekte
  useEffect(() => {
    if (gameState && roomInfo.playerId) {
      const currentPlayer = gameState.players.find(p => p.id === roomInfo.playerId)
      const wasSpectator = isSpectator
      const isNowSpectator = !currentPlayer?.alive
      
      setIsSpectator(isNowSpectator)
      
      // Spiele Tod-Sound wenn Spieler gerade gestorben ist
      if (!wasSpectator && isNowSpectator && currentPlayer) {
        playSound('death')
      }
    }
  }, [gameState, roomInfo.playerId, isSpectator, playSound])
  
  // Sound-Effekte für Spiel-Events
  useEffect(() => {
    if (!gameState || !previousGameStateRef.current) {
      previousGameStateRef.current = gameState
      return
    }
    
    const prevState = previousGameStateRef.current
    const currentState = gameState
    
    // Spiel gestartet
    if (prevState.gameStatus !== 'playing' && currentState.gameStatus === 'playing') {
      playSound('gameStart')
    }
    
    // Spiel beendet
    if (prevState.gameStatus === 'playing' && currentState.gameStatus === 'finished') {
      // Prüfe ob aktueller Spieler gewonnen hat
      const currentPlayer = currentState.players.find(p => p.id === roomInfo.playerId)
      const alivePlayers = currentState.players.filter(p => p.alive)
      
      if (currentPlayer?.alive && alivePlayers.length === 1) {
        playSound('victory')
      } else {
        playSound('gameEnd')
      }
    }
    
    // Futter gegessen (Score-Änderung)
    if (roomInfo.playerId) {
      const prevPlayer = prevState.players.find(p => p.id === roomInfo.playerId)
      const currentPlayer = currentState.players.find(p => p.id === roomInfo.playerId)
      
      if (prevPlayer && currentPlayer && currentPlayer.score > prevPlayer.score) {
        playSound('eat')
      }
    }
    
    previousGameStateRef.current = gameState
  }, [gameState, roomInfo.playerId, playSound])
  
  // Tastatur-Steuerung
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isSpectator) return
      
      let direction: Direction | null = null
      
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          direction = 'up'
          break
        case 'arrowdown':
        case 's':
          direction = 'down'
          break
        case 'arrowleft':
        case 'a':
          direction = 'left'
          break
        case 'arrowright':
        case 'd':
          direction = 'right'
          break
      }
      
      if (direction) {
        e.preventDefault()
        sendGameInput(direction)
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [sendGameInput, isSpectator])
  
  // Canvas-Rendering
  useEffect(() => {
    if (!gameState || !gameSettings || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const boardSize = BOARD_SIZES[gameSettings.boardSize]
    const gridSize = boardSize.gridSize
    const tileCount = boardSize.width / gridSize
    
    // Canvas-Größe setzen
    canvas.width = boardSize.width
    canvas.height = boardSize.height
    
    // Canvas leeren
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Gitter zeichnen (subtil)
    ctx.strokeStyle = '#e9ecef'
    ctx.lineWidth = 1
    for (let i = 0; i <= tileCount; i++) {
      ctx.beginPath()
      ctx.moveTo(i * gridSize, 0)
      ctx.lineTo(i * gridSize, canvas.height)
      ctx.stroke()
      
      ctx.beginPath()
      ctx.moveTo(0, i * gridSize)
      ctx.lineTo(canvas.width, i * gridSize)
      ctx.stroke()
    }
    
    // Schlangen zeichnen
    gameState.players.forEach((player, playerIndex) => {
      if (!player.alive) return
      
      const playerColor = players.find(p => p.id === player.id)?.color || '#4ecdc4'
      
      player.snake.forEach((segment, segmentIndex) => {
        if (segmentIndex === 0) {
          // Schlangenkopf
          ctx.fillStyle = playerColor
          ctx.fillRect(
            segment.x * gridSize + 1,
            segment.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
          )
          
          // Augen zeichnen
          ctx.fillStyle = '#ffffff'
          const eyeSize = 3
          
          if (player.direction === 'right') {
            ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 5, eyeSize, eyeSize)
            ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 12, eyeSize, eyeSize)
          } else if (player.direction === 'left') {
            ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 5, eyeSize, eyeSize)
            ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 12, eyeSize, eyeSize)
          } else if (player.direction === 'up') {
            ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 5, eyeSize, eyeSize)
            ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 5, eyeSize, eyeSize)
          } else if (player.direction === 'down') {
            ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 12, eyeSize, eyeSize)
            ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 12, eyeSize, eyeSize)
          }
        } else {
          // Schlangenkörper
          ctx.fillStyle = playerColor
          ctx.globalAlpha = 0.8
          ctx.fillRect(
            segment.x * gridSize + 2,
            segment.y * gridSize + 2,
            gridSize - 4,
            gridSize - 4
          )
          ctx.globalAlpha = 1
        }
      })
    })
    
    // Futter zeichnen
    gameState.food.forEach(food => {
      ctx.fillStyle = '#ff6b6b'
      ctx.beginPath()
      ctx.arc(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        (gridSize - 4) / 2,
        0,
        2 * Math.PI
      )
      ctx.fill()
      
      // Glow-Effekt
      ctx.shadowColor = '#ff6b6b'
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0
    })
    
  }, [gameState, gameSettings, players])
  
  const handleDirectionClick = (direction: Direction) => {
    if (!isSpectator) {
      sendGameInput(direction)
    }
  }
  
  if (!gameState || !gameSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-8 h-8" />
      </div>
    )
  }
  
  const currentPlayer = gameState.players.find(p => p.id === roomInfo.playerId)
  const alivePlayers = gameState.players.filter(p => p.alive)
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score)
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Hauptspielbereich */}
          <div className="lg:col-span-3">
            {/* Game Header */}
            <div className="card-glass mb-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h1 className="text-xl font-bold text-white">
                    🎮 Multiplayer Snake
                  </h1>
                  
                  {isSpectator && (
                    <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1">
                      <Eye className="w-4 h-4 text-red-300" />
                      <span className="text-red-300 text-sm font-medium">
                        Zuschauer-Modus
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Audio-Steuerung */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateSettings({ enabled: !settings.enabled })}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Sound an/aus"
                  >
                    {settings.enabled ? (
                      <Volume2 className="w-5 h-5 text-white" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-white/60" />
                    )}
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.volume * 100}
                    onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
                    className="w-20 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    title="Lautstärke"
                  />
                </div>
              </div>
            </div>
            
            {/* Spielfeld */}
            <div className="card-glass flex justify-center animate-slide-up">
              <canvas
                ref={canvasRef}
                className="game-canvas max-w-full h-auto"
              />
            </div>
            
            {/* Mobile Controls */}
            <div className="mt-4 flex justify-center md:hidden">
              <div className="grid grid-cols-3 gap-2 w-32">
                <div></div>
                <button
                  onClick={() => handleDirectionClick('up')}
                  className="control-btn"
                  disabled={isSpectator}
                >
                  ↑
                </button>
                <div></div>
                
                <button
                  onClick={() => handleDirectionClick('left')}
                  className="control-btn"
                  disabled={isSpectator}
                >
                  ←
                </button>
                <button
                  onClick={() => handleDirectionClick('down')}
                  className="control-btn"
                  disabled={isSpectator}
                >
                  ↓
                </button>
                <button
                  onClick={() => handleDirectionClick('right')}
                  className="control-btn"
                  disabled={isSpectator}
                >
                  →
                </button>
              </div>
            </div>
          </div>
          
          {/* Sidebar mit Scoreboard */}
          <div className="lg:col-span-1">
            {/* Live Scoreboard */}
            <div className="scoreboard mb-6 animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">Live Scoreboard</h2>
              </div>
              
              <div className="space-y-2">
                {sortedPlayers.map((player, index) => {
                  const playerInfo = players.find(p => p.id === player.id)
                  const isCurrentPlayer = player.id === roomInfo.playerId
                  
                  return (
                    <div
                      key={player.id}
                      className={`bg-white/10 rounded-lg p-3 border ${
                        isCurrentPlayer
                          ? 'border-white/40 bg-white/20'
                          : 'border-white/20'
                      } ${
                        !player.alive ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-white/70 font-mono text-sm w-6">
                            #{index + 1}
                          </div>
                          
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: playerInfo?.color || '#4ecdc4' }}
                          >
                            {playerInfo?.name.charAt(0).toUpperCase()}
                          </div>
                          
                          <div>
                            <div className="text-white text-sm font-medium">
                              {playerInfo?.name}
                              {isCurrentPlayer && (
                                <span className="ml-1 text-xs text-blue-300">(Du)</span>
                              )}
                            </div>
                            <div className="text-white/60 text-xs">
                              {player.alive ? (
                                <span className="text-green-400">Lebendig</span>
                              ) : (
                                <span className="text-red-400">Eliminiert</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-white font-bold">
                            {player.score}
                          </div>
                          <div className="text-white/60 text-xs">
                            Länge: {player.snake.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Spiel-Info */}
            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-medium mb-3">Spiel-Info</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Lebende Spieler:</span>
                  <span className="text-white">{alivePlayers.length}/{gameState.players.length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-white/70">Futter:</span>
                  <span className="text-white">{gameState.food.length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-white/70">Spielfeld:</span>
                  <span className="text-white capitalize">
                    {gameSettings.boardSize === 'small' ? 'Klein' :
                     gameSettings.boardSize === 'medium' ? 'Mittel' : 'Groß'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-white/70">Modus:</span>
                  <span className="text-white">
                    {gameSettings.gameMode === 'classic' ? 'Klassisch' : 'Battle Royale'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Steuerung-Hinweise */}
            <div className="bg-white/10 rounded-xl p-4 mt-4">
              <h3 className="text-white font-medium mb-3">Steuerung</h3>
              
              <div className="space-y-1 text-sm text-white/70">
                <div>WASD oder Pfeiltasten</div>
                <div>zum Steuern verwenden</div>
                {isSpectator && (
                  <div className="text-red-300 mt-2">
                    Du bist eliminiert und
                    schaust zu.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GamePage