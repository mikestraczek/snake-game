import { useCallback, useRef, useState } from 'react'

type SoundType = 'eat' | 'death' | 'gameStart' | 'gameEnd' | 'victory' | 'move'

type AudioSettings = {
  enabled: boolean
  volume: number
}

export function useAudio() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const [settings, setSettings] = useState<AudioSettings>({
    enabled: true,
    volume: 0.3
  })

  // Audio Context initialisieren
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  // Basis-Oszillator erstellen
  const createOscillator = useCallback((frequency: number, type: OscillatorType = 'sine') => {
    const audioContext = getAudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
    oscillator.type = type
    gainNode.gain.setValueAtTime(settings.volume, audioContext.currentTime)
    
    return { oscillator, gainNode, audioContext }
  }, [settings.volume, getAudioContext])

  // Futter-Essen Sound (kurzer, hoher Ton)
  const playEatSound = useCallback(() => {
    if (!settings.enabled) return
    
    try {
      const { oscillator, gainNode, audioContext } = createOscillator(800, 'square')
      
      // Kurzer Ton mit schnellem Fade-out
      gainNode.gain.setValueAtTime(settings.volume, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }, [settings.enabled, settings.volume, createOscillator])

  // Tod Sound (tiefer, fallender Ton)
  const playDeathSound = useCallback(() => {
    if (!settings.enabled) return
    
    try {
      const { oscillator, gainNode, audioContext } = createOscillator(200, 'sawtooth')
      
      // Fallender Ton
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5)
      
      gainNode.gain.setValueAtTime(settings.volume, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }, [settings.enabled, settings.volume, createOscillator])

  // Spiel-Start Sound (aufsteigender Ton)
  const playGameStartSound = useCallback(() => {
    if (!settings.enabled) return
    
    try {
      const { oscillator, gainNode, audioContext } = createOscillator(400, 'triangle')
      
      // Aufsteigender Ton
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3)
      
      gainNode.gain.setValueAtTime(settings.volume, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }, [settings.enabled, settings.volume, createOscillator])

  // Spiel-Ende Sound (neutraler Ton)
  const playGameEndSound = useCallback(() => {
    if (!settings.enabled) return
    
    try {
      const { oscillator, gainNode, audioContext } = createOscillator(300, 'sine')
      
      gainNode.gain.setValueAtTime(settings.volume, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.4)
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }, [settings.enabled, settings.volume, createOscillator])

  // Sieg Sound (triumphaler Akkord)
  const playVictorySound = useCallback(() => {
    if (!settings.enabled) return
    
    try {
      const audioContext = getAudioContext()
      const frequencies = [523, 659, 784] // C, E, G Akkord
      
      frequencies.forEach((freq, index) => {
        const { oscillator, gainNode } = createOscillator(freq, 'triangle')
        
        gainNode.gain.setValueAtTime(settings.volume * 0.3, audioContext.currentTime + index * 0.1)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8 + index * 0.1)
        
        oscillator.start(audioContext.currentTime + index * 0.1)
        oscillator.stop(audioContext.currentTime + 0.8 + index * 0.1)
      })
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }, [settings.enabled, settings.volume, createOscillator, getAudioContext])

  // Bewegungs-Sound (sehr leiser Klick)
  const playMoveSound = useCallback(() => {
    if (!settings.enabled) return
    
    try {
      const { oscillator, gainNode, audioContext } = createOscillator(1000, 'square')
      
      gainNode.gain.setValueAtTime(settings.volume * 0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.05)
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }, [settings.enabled, settings.volume, createOscillator])

  // Sound abspielen basierend auf Typ
  const playSound = useCallback((type: SoundType) => {
    switch (type) {
      case 'eat':
        playEatSound()
        break
      case 'death':
        playDeathSound()
        break
      case 'gameStart':
        playGameStartSound()
        break
      case 'gameEnd':
        playGameEndSound()
        break
      case 'victory':
        playVictorySound()
        break
      case 'move':
        playMoveSound()
        break
    }
  }, [playEatSound, playDeathSound, playGameStartSound, playGameEndSound, playVictorySound, playMoveSound])

  // Audio-Einstellungen aktualisieren
  const updateSettings = useCallback((newSettings: Partial<AudioSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  // Audio Context aufräumen
  const cleanup = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  return {
    playSound,
    settings,
    updateSettings,
    cleanup,
    // Einzelne Sound-Funktionen für direkten Zugriff
    playEatSound,
    playDeathSound,
    playGameStartSound,
    playGameEndSound,
    playVictorySound,
    playMoveSound
  }
}

export type { SoundType, AudioSettings }