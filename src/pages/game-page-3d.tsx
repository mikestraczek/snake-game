import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Volume2, VolumeX, Users, Trophy, Eye, RotateCcw } from 'lucide-react'
import { useSocket } from '../hooks/use-socket'
import { useGameSelectors } from '../stores/game-store'
import { useAudio } from '../hooks/use-audio'
import { useThree } from '../hooks/use-three'
import { BOARD_SIZES_3D } from '../../shared/types'
import type { Direction3D, GameState3D } from '../../shared/types'

function GamePage3D() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { sendGameInput } = useSocket()
  
  const roomInfo = useGameSelectors.roomInfo()
  const players = useGameSelectors.players()
  const { gameState, gameSettings } = useGameSelectors.gameStatus()
  
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSpectator, setIsSpectator] = useState(false)
  const { playSound, settings, updateSettings } = useAudio()
  const previousGameStateRef = useRef<typeof gameState>(null)
  
  // 3D-spezifische Zustände
  const [showControls, setShowControls] = useState(true)
  const [cameraMode, setCameraMode] = useState<'free' | 'follow'>('free')
  
  // Konvertiere 2D GameState zu 3D (temporär für Demo)
  const gameState3D: GameState3D | null = gameState ? {
    players: gameState.players.map(player => ({
      ...player,
      snake: player.snake.map(pos => ({ ...pos, z: 0 })), // Z-Koordinate hinzufügen
      direction: player.direction as Direction3D // Erweiterte Richtung
    })),
    food: gameState.food.map(pos => ({ ...pos, z: 0 })), // Z-Koordinate hinzufügen
    gameStatus: gameState.gameStatus,
    timeRemaining: gameState.timeRemaining
  } : null
  
  const boardSize3D = gameSettings ? BOARD_SIZES_3D[gameSettings.boardSize] : BOARD_SIZES_3D.medium
  
  // Three.js Hook
  const { isInitialized } = useThree({
    containerRef,
    boardSize: boardSize3D,
    gameState: gameState3D,
    players
  })
  
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
  
  // 3D-Tastatur-Steuerung
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isSpectator) return
      
      let direction: Direction3D | null = null
      
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
        case 'q':
        case 'pageup':
          direction = 'forward'
          break
        case 'e':
        case 'pagedown':
          direction = 'backward'
          break
        case 'h':
          setShowControls(!showControls)
          break
        case 'c':
          setCameraMode(prev => prev === 'free' ? 'follow' : 'free')
          break
      }
      
      if (direction) {
        e.preventDefault()
        // Sende echte 3D-Richtung
        sendGameInput(direction as any)
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [sendGameInput, isSpectator, showControls])
  
  const handleDirectionClick = (direction: Direction3D) => {
    if (!isSpectator) {
      // Sende echte 3D-Richtung
      sendGameInput(direction as any)
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
    <div className="min-h-screen p-4 relative">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Hauptspielbereich */}
          <div className="lg:col-span-3">
            {/* Game Header */}
            <div className="card-glass mb-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h1 className="text-xl font-bold text-white">
                    🎮 3D Snake Game
                  </h1>
                  
                  {isSpectator && (
                    <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1">
                      <Eye className="w-4 h-4 text-red-300" />
                      <span className="text-red-300 text-sm font-medium">
                        Zuschauer-Modus
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-lg px-3 py-1">
                    <span className="text-blue-300 text-sm font-medium">
                      Kamera: {cameraMode === 'free' ? 'Frei' : 'Verfolgung'}
                    </span>
                  </div>
                </div>
                
                {/* Audio-Steuerung */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowControls(!showControls)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Steuerung anzeigen/verstecken (H)"
                  >
                    <RotateCcw className="w-5 h-5 text-white" />
                  </button>
                  
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
            
            {/* 3D-Spielfeld */}
            <div className="card-glass relative animate-slide-up">
              <div 
                ref={containerRef}
                className="w-full h-[600px] rounded-lg overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}
              >
                {!isInitialized && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="spinner w-8 h-8 mx-auto mb-4" />
                      <p className="text-white/70">3D-Szene wird geladen...</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 3D-Steuerungshinweise */}
              {showControls && (
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white text-sm">
                  <h3 className="font-bold mb-2">🎮 3D-Steuerung</h3>
                  <div className="space-y-1">
                    <div><kbd className="bg-white/20 px-1 rounded">WASD</kbd> / <kbd className="bg-white/20 px-1 rounded">Pfeiltasten</kbd> - Bewegung</div>
                    <div><kbd className="bg-white/20 px-1 rounded">Q/E</kbd> - Hoch/Runter</div>
                    <div><kbd className="bg-white/20 px-1 rounded">H</kbd> - Hilfe ein/aus</div>
                    <div><kbd className="bg-white/20 px-1 rounded">C</kbd> - Kamera-Modus</div>
                    <div className="text-xs text-white/60 mt-2">
                      Maus: Kamera drehen & zoomen
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Mobile 3D-Controls */}
            <div className="mt-4 flex justify-center md:hidden">
              <div className="grid grid-cols-3 gap-2 max-w-xs">
                {/* Erste Reihe */}
                <div></div>
                <button
                  onClick={() => handleDirectionClick('forward')}
                  className="btn-glass p-3 text-white font-bold"
                  disabled={isSpectator}
                >
                  ↗️ Vor
                </button>
                <div></div>
                
                {/* Zweite Reihe */}
                <button
                  onClick={() => handleDirectionClick('left')}
                  className="btn-glass p-3 text-white font-bold"
                  disabled={isSpectator}
                >
                  ← Links
                </button>
                <button
                  onClick={() => handleDirectionClick('up')}
                  className="btn-glass p-3 text-white font-bold"
                  disabled={isSpectator}
                >
                  ↑ Hoch
                </button>
                <button
                  onClick={() => handleDirectionClick('right')}
                  className="btn-glass p-3 text-white font-bold"
                  disabled={isSpectator}
                >
                  → Rechts
                </button>
                
                {/* Dritte Reihe */}
                <div></div>
                <button
                  onClick={() => handleDirectionClick('down')}
                  className="btn-glass p-3 text-white font-bold"
                  disabled={isSpectator}
                >
                  ↓ Runter
                </button>
                <div></div>
                
                {/* Vierte Reihe */}
                <div></div>
                <button
                  onClick={() => handleDirectionClick('backward')}
                  className="btn-glass p-3 text-white font-bold"
                  disabled={isSpectator}
                >
                  ↙️ Zurück
                </button>
                <div></div>
              </div>
            </div>
          </div>
          
          {/* Seitenleiste */}
          <div className="space-y-4">
            {/* Spieler-Status */}
            <div className="card-glass animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold text-white">Spieler</h2>
                <span className="text-sm text-white/60">({alivePlayers.length}/{gameState.players.length})</span>
              </div>
              
              <div className="space-y-3">
                {sortedPlayers.map((player, index) => {
                  const playerInfo = players.find(p => p.id === player.id)
                  const isCurrentPlayer = player.id === roomInfo.playerId
                  
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        isCurrentPlayer ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5'
                      } ${
                        !player.alive ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-white/60 w-6">
                          #{index + 1}
                        </div>
                        
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white/30"
                          style={{ backgroundColor: playerInfo?.color || '#4ecdc4' }}
                        >
                          {playerInfo?.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {playerInfo?.name}
                          </span>
                          {isCurrentPlayer && (
                            <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-1 rounded">
                              Du
                            </span>
                          )}
                          {!player.alive && (
                            <span className="text-xs bg-red-500/30 text-red-200 px-2 py-1 rounded">
                              💀
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-white/70">
                          {player.score} Punkte
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Spiel-Info */}
            <div className="card-glass animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-bold text-white">Spiel-Info</h2>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/70">Modus:</span>
                  <span className="text-white font-medium">3D Snake</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-white/70">Spielfeld:</span>
                  <span className="text-white font-medium">
                    {gameSettings.boardSize === 'small' ? 'Klein' : 
                     gameSettings.boardSize === 'medium' ? 'Mittel' : 'Groß'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-white/70">Geschwindigkeit:</span>
                  <span className="text-white font-medium">
                    {gameSettings.gameSpeed}/5
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-white/70">Lebende Spieler:</span>
                  <span className="text-white font-medium">
                    {alivePlayers.length}
                  </span>
                </div>
                
                {currentPlayer && (
                  <div className="pt-2 border-t border-white/20">
                    <div className="flex justify-between">
                      <span className="text-white/70">Deine Punkte:</span>
                      <span className="text-white font-bold text-lg">
                        {currentPlayer.score}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-white/70">Schlangenlänge:</span>
                      <span className="text-white font-medium">
                        {currentPlayer.snake.length}
                      </span>
                    </div>
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

export default GamePage3D