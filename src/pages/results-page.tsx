import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Trophy, Medal, Award, Home, Users, RotateCcw } from 'lucide-react'
import { useGameSelectors } from '../stores/game-store'
import { useSocket } from '../hooks/use-socket'
import { useAudio } from '../hooks/use-audio'

function ResultsPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { disconnect, restartGame } = useSocket()
  const { playSound } = useAudio()
  
  const roomInfo = useGameSelectors.roomInfo()
  const players = useGameSelectors.players()
  const gameResults = useGameSelectors.gameResults()
  const { gameState } = useGameSelectors.gameStatus()
  
  const [showConfetti, setShowConfetti] = useState(false)
  
  // Redirect wenn nicht in Raum
  useEffect(() => {
    if (!roomInfo.roomId || roomInfo.roomId !== roomId) {
      navigate('/')
      return
    }
  }, [roomInfo.roomId, roomId, navigate])
  
  // Konfetti-Animation für Gewinner und Sound-Effekte
  useEffect(() => {
    if (gameResults.length > 0) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      
      // Spiele entsprechenden Sound basierend auf Platzierung
      const currentPlayerResult = gameResults.find(result => {
        const player = players.find(p => p.name === result.playerName)
        return player?.id === roomInfo.playerId
      })
      
      if (currentPlayerResult) {
        if (currentPlayerResult.rank === 1) {
          playSound('victory')
        } else {
          playSound('gameEnd')
        }
      }
      
      return () => clearTimeout(timer)
    }
  }, [gameResults, players, roomInfo.playerId, playSound])
  
  // Navigation zur Lobby wenn Spiel neu gestartet wird
  useEffect(() => {
    if (gameState?.gameStatus === 'waiting') {
      navigate(`/lobby/${roomId}`)
    }
  }, [gameState?.gameStatus, roomId, navigate])
  
  const handleBackToLobby = () => {
    navigate(`/lobby/${roomId}`)
  }
  
  const handleBackToHome = () => {
    disconnect()
    navigate('/')
  }
  
  const handleRestartGame = () => {
    // Spiel auf Server neu starten
    restartGame()
    // Zur Lobby navigieren
    navigate(`/lobby/${roomId}`)
  }
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-400" />
      case 2:
        return <Medal className="w-8 h-8 text-gray-300" />
      case 3:
        return <Award className="w-8 h-8 text-amber-600" />
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
            {rank}
          </div>
        )
    }
  }
  
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400/20 to-yellow-600/20 border-yellow-400/30'
      case 2:
        return 'from-gray-300/20 to-gray-500/20 border-gray-300/30'
      case 3:
        return 'from-amber-600/20 to-amber-800/20 border-amber-600/30'
      default:
        return 'from-white/10 to-white/5 border-white/20'
    }
  }
  
  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${remainingSeconds}s`
  }
  
  const currentPlayerResult = gameResults.find(result => {
    return result.playerId === roomInfo.playerId
  })
  
  if (!gameResults.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-white/70">Lade Ergebnisse...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      {/* Konfetti-Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            🏁 Spiel beendet!
          </h1>
          
          {currentPlayerResult && (
            <div className="text-xl text-white/90 mb-2">
              {currentPlayerResult.rank === 1 ? (
                <span className="text-yellow-400 font-bold">🎉 Glückwunsch! Du hast gewonnen! 🎉</span>
              ) : (
                <span>Du hast Platz {currentPlayerResult.rank} erreicht!</span>
              )}
            </div>
          )}
          
          <p className="text-white/70">
            Hier sind die finalen Ergebnisse
          </p>
        </div>
        
        {/* Podium für Top 3 */}
        <div className="mb-8 animate-slide-up">
          <div className="flex justify-center items-end gap-4 mb-8">
            {gameResults.slice(0, 3).map((result, index) => {
              const player = players.find(p => p.id === result.playerId || p.name === result.playerName)
              const heights = ['h-32', 'h-40', 'h-28'] // 2nd, 1st, 3rd
              const orders = [1, 0, 2] // Reihenfolge für Podium-Darstellung
              const actualIndex = orders.indexOf(index)
              
              return (
                <div
                  key={result.playerId}
                  className={`flex flex-col items-center ${heights[actualIndex]} justify-end`}
                  style={{ order: orders[index] }}
                >
                  {/* Spieler-Avatar */}
                  <div className="mb-2">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl border-4 border-white/30"
                      style={{ backgroundColor: player?.color || '#4ecdc4' }}
                    >
                      {result.playerName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  
                  {/* Podium */}
                  <div className={`w-24 bg-gradient-to-t ${getRankColor(result.rank)} border rounded-t-lg flex flex-col items-center justify-center p-4`}>
                    <div className="mb-2">
                      {getRankIcon(result.rank)}
                    </div>
                    <div className="text-white font-bold text-sm text-center">
                      {result.playerName}
                    </div>
                    <div className="text-white/80 text-xs">
                      {result.score} Punkte
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Detaillierte Rangliste */}
        <div className="card-glass mb-8 animate-slide-up">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">Finale Rangliste</h2>
          </div>
          
          <div className="space-y-3">
            {gameResults.map((result) => {
              const player = players.find(p => p.id === result.playerId || p.name === result.playerName)
              const isCurrentPlayer = player?.id === roomInfo.playerId
              
              return (
                <div
                  key={result.playerId}
                  className={`bg-gradient-to-r ${getRankColor(result.rank)} border rounded-xl p-4 ${
                    isCurrentPlayer ? 'ring-2 ring-white/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Rang */}
                      <div className="flex-shrink-0">
                        {getRankIcon(result.rank)}
                      </div>
                      
                      {/* Spieler-Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold border-2 border-white/30"
                          style={{ backgroundColor: player?.color || '#4ecdc4' }}
                        >
                          {result.playerName.charAt(0).toUpperCase()}
                        </div>
                        
                        <div>
                          <div className="text-white font-bold text-lg">
                            {result.playerName}
                            {isCurrentPlayer && (
                              <span className="ml-2 text-sm bg-blue-500/30 text-blue-200 px-2 py-1 rounded">
                                Du
                              </span>
                            )}
                          </div>
                          <div className="text-white/70 text-sm">
                            Überlebenszeit: {formatTime(result.survivalTime)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Score */}
                    <div className="text-right">
                      <div className="text-white font-bold text-2xl">
                        {result.score}
                      </div>
                      <div className="text-white/70 text-sm">
                        Punkte
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Aktions-Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
          <button
            onClick={handleRestartGame}
            className="btn-glass flex items-center justify-center gap-2 !bg-blue-500/20 !border-blue-500/30 hover:!bg-blue-500/30"
          >
            <RotateCcw className="w-5 h-5" />
            Neues Spiel
          </button>
          
          <button
            onClick={handleBackToLobby}
            className="btn-glass flex items-center justify-center gap-2 !bg-green-500/20 !border-green-500/30 hover:!bg-green-500/30"
          >
            <Users className="w-5 h-5" />
            Zurück zur Lobby
          </button>
          
          <button
            onClick={handleBackToHome}
            className="btn-glass flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Hauptmenü
          </button>
        </div>
        
        {/* Statistiken */}
        <div className="mt-8 grid md:grid-cols-3 gap-4 animate-slide-up">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {Math.max(...gameResults.map(r => r.score))}
            </div>
            <div className="text-white/70 text-sm">Höchste Punktzahl</div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {formatTime(Math.max(...gameResults.map(r => r.survivalTime)))}
            </div>
            <div className="text-white/70 text-sm">Längste Überlebenszeit</div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {gameResults.length}
            </div>
            <div className="text-white/70 text-sm">Teilnehmer</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultsPage