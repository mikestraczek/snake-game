import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Users,
  Crown,
  Check,
  X,
  Send,
  Copy,
  Settings,
  Play,
  LogOut,
  MessageCircle,
  Bot,
  Plus,
  Trash2
} from 'lucide-react'
import { useSocket } from '../hooks/use-socket'
import { useGameSelectors } from '../stores/game-store'
import type { Player } from '../../shared/types'

function LobbyPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { setPlayerReady, startGame, sendChatMessage, disconnect, updateGameSettings, addBot, removeBot } = useSocket()
  
  const roomInfo = useGameSelectors.roomInfo()
  const players = useGameSelectors.players()
  const chatMessages = useGameSelectors.chatMessages()
  const { gameState, gameSettings } = useGameSelectors.gameStatus()
  
  const [isReady, setIsReady] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // Nur bei echten Fehlern zur Home navigieren (ohne Timer)
  useEffect(() => {
    // Nur navigieren wenn roomId in URL fehlt
    if (!roomId) {
      console.log('🚪 Keine roomId in URL, zurück zur Home')
      navigate('/')
    }
  }, [roomId, navigate])
  
  // Auto-scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])
  
  // Navigation zum Spiel wenn gestartet
  useEffect(() => {
    if (gameState?.gameStatus === 'playing') {
      const path = gameSettings?.is3D ? `/game3d/${roomId}` : `/game/${roomId}`
      navigate(path)
    }
  }, [gameState?.gameStatus, roomId, navigate, gameSettings?.is3D])
  
  const handleReadyToggle = () => {
    const newReady = !isReady
    setIsReady(newReady)
    setPlayerReady(newReady)
  }
  
  const handleStartGame = () => {
    const allPlayersReady = players.every(player => 
      player.id === roomInfo.playerId || player.ready
    )
    
    if (!allPlayersReady) {
      toast.error('Nicht alle Spieler sind bereit')
      return
    }
    
    if (players.length < 2) {
      toast.error('Mindestens 2 Spieler erforderlich')
      return
    }
    
    startGame()
  }
  
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!chatInput.trim()) return
    
    sendChatMessage(chatInput.trim())
    setChatInput('')
  }

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }
  
  const handleCopyRoomCode = () => {
    if (roomInfo.roomCode) {
      navigator.clipboard.writeText(roomInfo.roomCode)
      toast.success('Raum-Code kopiert!')
    }
  }
  
  const handleLeaveRoom = () => {
    disconnect()
    navigate('/')
  }

  const handleSettingsChange = (newSettings: Partial<typeof gameSettings>) => {
    if (!roomInfo.isHost || !gameSettings) return
    
    const updatedSettings = { ...gameSettings, ...newSettings }
    updateGameSettings(updatedSettings)
  }

  const handleAddBot = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!roomInfo.isHost) {
      toast.error('Nur der Host kann Bots hinzufügen')
      return
    }
    
    if (players.length >= (gameSettings?.maxPlayers || 4)) {
      toast.error('Raum ist bereits voll')
      return
    }
    
    addBot(difficulty)
  }

  const handleRemoveBot = (botId: string) => {
    if (!roomInfo.isHost) {
      toast.error('Nur der Host kann Bots entfernen')
      return
    }
    
    removeBot(botId)
  }
  
  // const currentPlayer = players.find(p => p.id === roomInfo.playerId)
  const allPlayersReady = players.every(player => 
    player.id === roomInfo.playerId || player.ready
  )
  
  // Loading-State während roomInfo geladen wird
  if (!roomInfo.roomId && roomId) {
    console.log('🔄 Warte auf roomInfo...', { roomInfo, roomId })
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-glass p-8 text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-white/80">Lade Raum-Informationen...</p>
          <p className="text-white/60 text-sm mt-2">Raum-ID: {roomId}</p>
          <button 
            onClick={() => navigate('/')}
            className="btn-glass mt-4 text-sm"
          >
            Zurück zur Startseite
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="card-glass mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                🏠 Lobby
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-white/70">Raum-Code:</span>
                <code className="bg-white/20 px-2 py-1 rounded text-white font-mono">
                  {roomInfo.roomCode}
                </code>
                <button
                  onClick={handleCopyRoomCode}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Code kopieren"
                >
                  <Copy className="w-4 h-4 text-white/70" />
                </button>
              </div>
            </div>
            
            <button
              onClick={handleLeaveRoom}
              className="btn-glass !bg-red-500/20 !border-red-500/30 hover:!bg-red-500/30 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Verlassen
            </button>
          </div>
          
          {/* Spiel-Einstellungen */}
          {gameSettings && (
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Spiel-Einstellungen
                </h3>
                {roomInfo.isHost && (
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-xs text-white/70 hover:text-white transition-colors"
                  >
                    {showSettings ? 'Weniger' : 'Bearbeiten'}
                  </button>
                )}
              </div>
              
              {roomInfo.isHost && showSettings ? (
                /* Editierbare Einstellungen für Host */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Max. Spieler</label>
                      <select
                        value={gameSettings.maxPlayers}
                        onChange={(e) => handleSettingsChange({ maxPlayers: Number(e.target.value) as 2 | 3 | 4 })}
                        className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value={2}>2 Spieler</option>
                        <option value={3}>3 Spieler</option>
                        <option value={4}>4 Spieler</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Geschwindigkeit</label>
                      <select
                        value={gameSettings.gameSpeed}
                        onChange={(e) => handleSettingsChange({ gameSpeed: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 })}
                        className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value={1}>Langsam</option>
                        <option value={2}>Gemäßigt</option>
                        <option value={3}>Normal</option>
                        <option value={4}>Schnell</option>
                        <option value={5}>Sehr schnell</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Spielfeld</label>
                      <select
                        value={gameSettings.boardSize}
                        onChange={(e) => handleSettingsChange({ boardSize: e.target.value as 'small' | 'medium' | 'large' })}
                        className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value="small">Klein</option>
                        <option value="medium">Mittel</option>
                        <option value="large">Groß</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Spielmodus</label>
                      <select
                        value={gameSettings.gameMode}
                        onChange={(e) => handleSettingsChange({ gameMode: e.target.value as 'classic' | 'battle-royale' })}
                        className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value="classic">Klassisch</option>
                        <option value="battle-royale">Battle Royale</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* 2D/3D Toggle */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={gameSettings.is3D || false}
                        onChange={(e) => handleSettingsChange({ is3D: e.target.checked })}
                        className="w-4 h-4 rounded border-white/30 bg-white/20 text-blue-500 focus:ring-blue-500"
                      />
                      3D-Modus aktivieren
                    </label>
                  </div>
                </div>
              ) : (
                /* Nur-Lese Anzeige */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-white/70">Spieler:</span>
                    <span className="ml-2 text-white">
                      {players.length}/{gameSettings.maxPlayers}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/70">Geschwindigkeit:</span>
                    <span className="ml-2 text-white">
                      {['Langsam', 'Gemäßigt', 'Normal', 'Schnell', 'Sehr schnell'][gameSettings.gameSpeed - 1]}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/70">Spielfeld:</span>
                    <span className="ml-2 text-white capitalize">
                      {gameSettings.boardSize === 'small' ? 'Klein' : 
                       gameSettings.boardSize === 'medium' ? 'Mittel' : 'Groß'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/70">Modus:</span>
                    <span className="ml-2 text-white">
                      {gameSettings.gameMode === 'classic' ? 'Klassisch' : 'Battle Royale'}
                      {gameSettings.is3D && <span className="ml-1 text-blue-300">(3D)</span>}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* Spielerliste */}
          <div className="md:col-span-2">
            <div className="card-glass animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-white" />
                <h2 className="text-xl font-semibold text-white">
                  Spieler ({players.length}/{gameSettings?.maxPlayers || 4})
                </h2>
              </div>
              
              <div className="space-y-3">
                {players.map((player: Player) => (
                  <div
                    key={player.id}
                    className="bg-white/10 rounded-lg p-4 flex items-center justify-between"
                  >
                      <div className="flex items-center gap-3">
                      {/* Spieler-Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold relative"
                        style={{ backgroundColor: player.color }}
                      >
                        {player.isBot ? (
                          <Bot className="w-5 h-5" />
                        ) : (
                          player.name.charAt(0).toUpperCase()
                        )}
                        {player.isBot && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                            <Bot className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Spieler-Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {player.name}
                            {player.isBot && (
                              <span className="ml-1 text-xs text-purple-300">(Bot)</span>
                            )}
                          </span>
                          {player.isHost && (
                            <Crown className="w-4 h-4 text-yellow-400" />
                          )}
                          {player.id === roomInfo.playerId && (
                            <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-1 rounded">
                              Du
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Bereitschafts-Status und Bot-Aktionen */}
                    <div className="flex items-center gap-2">
                      {player.isBot && roomInfo.isHost ? (
                        <button
                          onClick={() => handleRemoveBot(player.id)}
                          className="p-1 hover:bg-red-500/20 rounded transition-colors"
                          title="Bot entfernen"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      ) : null}
                      
                      {player.ready ? (
                        <div className="flex items-center gap-1 text-green-400">
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Bereit</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-400">
                          <X className="w-4 h-4" />
                          <span className="text-sm">Nicht bereit</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Bot-Hinzufügen (nur für Host) */}
                {roomInfo.isHost && players.length < (gameSettings?.maxPlayers || 4) && (
                  <div className="bg-purple-500/10 border-2 border-dashed border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-400" />
                        <span className="text-white font-medium">Bot hinzufügen</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddBot('easy')}
                          className="btn-glass !bg-green-500/20 !border-green-500/30 hover:!bg-green-500/30 text-xs px-3 py-1"
                          title="Einfacher Bot"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Einfach
                        </button>
                        <button
                          onClick={() => handleAddBot('medium')}
                          className="btn-glass !bg-yellow-500/20 !border-yellow-500/30 hover:!bg-yellow-500/30 text-xs px-3 py-1"
                          title="Mittlerer Bot"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Mittel
                        </button>
                        <button
                          onClick={() => handleAddBot('hard')}
                          className="btn-glass !bg-red-500/20 !border-red-500/30 hover:!bg-red-500/30 text-xs px-3 py-1"
                          title="Schwerer Bot"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Schwer
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-white/60 mt-2">
                      Füge KI-Bots mit verschiedenen Schwierigkeitsgraden hinzu
                    </p>
                  </div>
                )}
                
                {/* Leere Plätze */}
                {Array.from({ length: Math.max(0, (gameSettings?.maxPlayers || 4) - players.length - (roomInfo.isHost ? 1 : 0)) }).map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="bg-white/5 border-2 border-dashed border-white/20 rounded-lg p-4 flex items-center justify-center"
                  >
                    <span className="text-white/50">Warte auf Spieler...</span>
                  </div>
                ))}
              </div>
              
              {/* Aktions-Buttons */}
              <div className="mt-6 flex gap-3">
                {/* Bereitschafts-Button */}
                <button
                  onClick={handleReadyToggle}
                  className={`btn-glass flex-1 flex items-center justify-center gap-2 ${
                    isReady
                      ? '!bg-green-500/20 !border-green-500/30 hover:!bg-green-500/30'
                      : '!bg-red-500/20 !border-red-500/30 hover:!bg-red-500/30'
                  }`}
                >
                  {isReady ? (
                    <>
                      <Check className="w-4 h-4" />
                      Bereit
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Nicht bereit
                    </>
                  )}
                </button>
                
                {/* Start-Button (nur für Host) */}
                {roomInfo.isHost && (
                  <button
                    onClick={handleStartGame}
                    disabled={!allPlayersReady || players.length < 2}
                    className="btn-glass flex-1 flex items-center justify-center gap-2 !bg-green-500/20 !border-green-500/30 hover:!bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    Spiel starten
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Chat */}
          <div className="md:col-span-1">
            <div className="card-glass h-96 flex flex-col animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-white" />
                <h2 className="text-xl font-semibold text-white">Chat</h2>
              </div>
              
              {/* Chat-Nachrichten */}
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 mb-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`chat-bubble ${
                      message.playerId === 'system' ? 'system' : ''
                    }`}
                  >
                    {message.playerId !== 'system' && (
                      <div className="text-xs text-white/70 mb-1">
                        {message.playerName}
                      </div>
                    )}
                    <div className="text-sm text-white">
                      {message.message}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              {/* Chat-Input */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Nachricht eingeben..."
                  className="input-glass flex-1 text-sm"
                  maxLength={200}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="btn-glass !px-3 !py-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LobbyPage