import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Users, Plus, LogIn, Settings, Volume2 } from 'lucide-react'
import { useSocket } from '../hooks/use-socket'
import { useGame, useGameSelectors } from '../stores/game-store'
import { PLAYER_COLORS } from '../../shared/types'
import type { GameSettings } from '../../shared/types'

function HomePage() {
  const navigate = useNavigate()
  const { createRoom, joinRoom, isConnected } = useSocket()
  const { setPlayerInfo, isLoading, error } = useGame()
  
  const [playerName, setPlayerName] = useState('')
  const [playerColor, setPlayerColor] = useState(PLAYER_COLORS[0])
  const [roomCode, setRoomCode] = useState('')
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    maxPlayers: 4,
    gameSpeed: 3,
    boardSize: 'medium',
    gameMode: 'classic'
  })

  const handleCreateRoom = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!playerName.trim()) {
      toast.error('Bitte gib einen Spielernamen ein')
      return
    }
    
    if (playerName.trim().length < 2) {
      toast.error('Name muss mindestens 2 Zeichen lang sein')
      return
    }
    
    setPlayerInfo(playerName.trim(), playerColor)
    
    createRoom({
      playerName: playerName.trim(),
      playerColor,
      gameSettings
    })
  }

  const handleJoinRoom = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!playerName.trim()) {
      toast.error('Bitte gib einen Spielernamen ein')
      return
    }
    
    if (!roomCode.trim()) {
      toast.error('Bitte gib einen Raum-Code ein')
      return
    }
    
    if (roomCode.trim().length !== 6) {
      toast.error('Raum-Code muss 6 Zeichen lang sein')
      return
    }
    
    setPlayerInfo(playerName.trim(), playerColor)
    
    joinRoom({
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
      playerColor
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent, action: 'create' | 'join') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (action === 'create') {
        handleCreateRoom()
      } else {
        handleJoinRoom()
      }
    }
  }

  // Store beim Laden der Home-Page zurücksetzen
  const { reset } = useGame()
  
  useEffect(() => {
    // Store zurücksetzen um alte roomId-Werte zu entfernen
    console.log('🏠 Home-Page geladen, setze Store zurück')
    reset()
  }, [reset])
  
  // Navigation erfolgt nur nach erfolgreicher Socket-Antwort
  const roomInfo = useGameSelectors.roomInfo()
  
  useEffect(() => {
    // Für Hosts: Warten auf roomId UND roomCode (da sie den room-code Event erhalten)
    // Für beitretende Spieler: Nur auf roomId warten (sie erhalten keinen roomCode)
    const shouldNavigate = roomInfo.roomId && !isLoading && (
      roomInfo.isHost ? roomInfo.roomCode : true // Host braucht Code, Beitretende nicht
    )
    
    if (shouldNavigate) {
      console.log('🏠 Navigiere zur Lobby nach erfolgreicher Raum-Aktion:', {
        roomId: roomInfo.roomId,
        isHost: roomInfo.isHost,
        hasCode: !!roomInfo.roomCode
      })
      navigate(`/lobby/${roomInfo.roomId}`)
    }
  }, [roomInfo.roomId, roomInfo.roomCode, roomInfo.isHost, isLoading, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            🐍 Snake Game
          </h1>
          <p className="text-white/80 text-lg">
            Multiplayer für 2-4 Spieler
          </p>
          
          {/* Verbindungsstatus */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className="text-sm text-white/70">
              {isConnected ? 'Verbunden' : 'Nicht verbunden'}
            </span>
          </div>
          
          {/* Debug-Button für Store Reset */}
          {roomInfo.roomId && (
            <div className="mt-2">
              <button
                onClick={() => {
                  console.log('🔄 Manueller Store Reset')
                  reset()
                }}
                className="text-xs text-white/50 hover:text-white/80 underline"
              >
                Store zurücksetzen (Debug)
              </button>
            </div>
          )}
        </div>

        {/* Hauptkarte */}
        <div className="card-glass animate-slide-up">
          {/* Spieler-Setup */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Dein Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, showCreateRoom ? 'create' : 'join')}
              placeholder="Spielername eingeben..."
              className="input-glass w-full"
              maxLength={20}
              disabled={isLoading}
            />
          </div>

          {/* Farb-Auswahl */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Deine Farbe
            </label>
            <div className="flex gap-2">
              {PLAYER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setPlayerColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                    playerColor === color
                      ? 'border-white scale-110'
                      : 'border-white/30 hover:border-white/60'
                  }`}
                  style={{ backgroundColor: color }}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          {/* Fehler-Anzeige */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
              {error}
            </div>
          )}

          {/* Aktionen */}
          <div className="space-y-3">
            {/* Raum erstellen */}
            <button
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="btn-glass w-full flex items-center justify-center gap-2"
              disabled={isLoading || !isConnected}
            >
              <Plus className="w-5 h-5" />
              Raum erstellen
            </button>

            {/* Erweiterte Einstellungen */}
            {showCreateRoom && (
              <div className="bg-white/10 rounded-xl p-4 space-y-4 animate-slide-up">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      Max. Spieler
                    </label>
                    <select
                      value={gameSettings.maxPlayers}
                      onChange={(e) => setGameSettings(prev => ({
                        ...prev,
                        maxPlayers: Number(e.target.value) as 2 | 3 | 4
                      }))}
                      className="input-glass w-full text-sm"
                    >
                      <option value={2}>2 Spieler</option>
                      <option value={3}>3 Spieler</option>
                      <option value={4}>4 Spieler</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      Geschwindigkeit
                    </label>
                    <select
                      value={gameSettings.gameSpeed}
                      onChange={(e) => setGameSettings(prev => ({
                        ...prev,
                        gameSpeed: Number(e.target.value) as 1 | 2 | 3 | 4 | 5
                      }))}
                      className="input-glass w-full text-sm"
                    >
                      <option value={1}>Langsam</option>
                      <option value={2}>Gemäßigt</option>
                      <option value={3}>Normal</option>
                      <option value={4}>Schnell</option>
                      <option value={5}>Sehr schnell</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      Spielfeld
                    </label>
                    <select
                      value={gameSettings.boardSize}
                      onChange={(e) => setGameSettings(prev => ({
                        ...prev,
                        boardSize: e.target.value as 'small' | 'medium' | 'large'
                      }))}
                      className="input-glass w-full text-sm"
                    >
                      <option value="small">Klein</option>
                      <option value="medium">Mittel</option>
                      <option value="large">Groß</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      Spielmodus
                    </label>
                    <select
                      value={gameSettings.gameMode}
                      onChange={(e) => setGameSettings(prev => ({
                        ...prev,
                        gameMode: e.target.value as 'classic' | 'battle-royale'
                      }))}
                      className="input-glass w-full text-sm"
                    >
                      <option value="classic">Klassisch</option>
                      <option value="battle-royale">Battle Royale</option>
                    </select>
                  </div>
                </div>
                
                <form onSubmit={handleCreateRoom}>
                  <button
                    type="submit"
                    className="btn-glass w-full"
                    disabled={isLoading || !isConnected}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="spinner w-4 h-4" />
                        Erstelle Raum...
                      </div>
                    ) : (
                      'Raum jetzt erstellen'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Trennlinie */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/60 text-sm">oder</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Raum beitreten */}
            <form onSubmit={handleJoinRoom} className="space-y-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => handleKeyDown(e, 'join')}
                placeholder="Raum-Code eingeben (z.B. ABC123)"
                className="input-glass w-full"
                maxLength={6}
                disabled={isLoading}
              />
              
              <button
                type="submit"
                className="btn-glass w-full flex items-center justify-center gap-2"
                disabled={isLoading || !isConnected}
              >
                <LogIn className="w-5 h-5" />
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="spinner w-4 h-4" />
                    Trete bei...
                  </div>
                ) : (
                  'Raum beitreten'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-white/60 text-sm">
          <p>Verwende WASD oder Pfeiltasten zum Steuern</p>
          <p className="mt-1">Sammle Futter und vermeide Kollisionen!</p>
        </div>
      </div>
    </div>
  )
}

export default HomePage