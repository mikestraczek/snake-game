import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

function NotFoundPage() {
  const navigate = useNavigate()
  
  const handleGoHome = () => {
    navigate('/')
  }
  
  const handleGoBack = () => {
    navigate(-1)
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* 404 Animation */}
        <div className="mb-8 animate-bounce">
          <div className="text-8xl mb-4">🐍</div>
          <div className="text-6xl font-bold text-white/90 mb-2">404</div>
        </div>
        
        {/* Error Message */}
        <div className="card-glass animate-fade-in">
          <h1 className="text-2xl font-bold text-white mb-4">
            Seite nicht gefunden
          </h1>
          
          <p className="text-white/80 mb-6">
            Die Schlange hat sich verirrt! Die gesuchte Seite existiert nicht oder wurde verschoben.
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGoHome}
              className="btn-glass flex items-center justify-center gap-2 !bg-green-500/20 !border-green-500/30 hover:!bg-green-500/30"
            >
              <Home className="w-4 h-4" />
              Zum Hauptmenü
            </button>
            
            <button
              onClick={handleGoBack}
              className="btn-glass flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
          </div>
        </div>
        
        {/* Fun Facts */}
        <div className="mt-8 text-white/60 text-sm animate-slide-up">
          <p>💡 Wusstest du schon?</p>
          <p className="mt-1">
            Schlangen können bis zu 30 km/h schnell werden!
          </p>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage