import { Routes, Route } from 'react-router-dom'
import { SocketProvider } from './hooks/use-socket'
import { GameProvider } from './stores/game-store'
import HomePage from './pages/home-page'
import LobbyPage from './pages/lobby-page'
import GamePage from './pages/game-page'
import GamePage3D from './pages/game-page-3d'
import ResultsPage from './pages/results-page'
import NotFoundPage from './pages/not-found-page'

function App() {
  return (
    <GameProvider>
      <SocketProvider>
        <div className="min-h-screen bg-gradient-primary">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lobby/:roomId" element={<LobbyPage />} />
            <Route path="/game/:roomId" element={<GamePage />} />
            <Route path="/game3d/:roomId" element={<GamePage3D />} />
            <Route path="/results/:roomId" element={<ResultsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </SocketProvider>
    </GameProvider>
  )
}

export default App