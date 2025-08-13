class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.3;
        
        // Initialize audio context for better browser compatibility
        this.audioContext = null;
        this.initAudioContext();
        
        this.loadSounds();
    }
    
    initAudioContext() {
        try {
            // Create audio context for better control
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    loadSounds() {
        // Try to load audio files, but use fallback if they fail
        const soundFiles = {
            eat: 'audio/eat.mp3',
            gameOver: 'audio/game-over.mp3',
            move: 'audio/move.mp3'
        };
        
        Object.keys(soundFiles).forEach(key => {
            this.sounds[key] = new Audio(soundFiles[key]);
            this.sounds[key].volume = this.volume;
            this.sounds[key].preload = 'auto';
            
            // Handle loading errors gracefully and use fallback
            this.sounds[key].addEventListener('error', () => {
                console.warn(`Could not load sound: ${soundFiles[key]}, using fallback`);
                this.sounds[key] = null; // Mark as failed
            });
        });
    }
    
    play(soundName) {
        if (!this.enabled) return;
        
        // If audio file failed to load or doesn't exist, use fallback
        if (!this.sounds[soundName] || this.sounds[soundName] === null) {
            this.playFallbackSound(soundName);
            return;
        }
        
        try {
            // Reset the audio to beginning
            this.sounds[soundName].currentTime = 0;
            
            // Play the sound
            const playPromise = this.sounds[soundName].play();
            
            // Handle play promise for better browser compatibility
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Audio play failed, using fallback:', error);
                    this.playFallbackSound(soundName);
                });
            }
        } catch (error) {
            console.warn('Error playing sound, using fallback:', error);
            this.playFallbackSound(soundName);
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
    
    // Resume audio context (needed for some browsers)
    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    // Generate simple beep sounds programmatically as fallback
    generateBeep(frequency = 440, duration = 200, type = 'sine') {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
        } catch (error) {
            console.warn('Error generating beep:', error);
        }
    }
    
    // Fallback sounds using Web Audio API
    playFallbackSound(type) {
        switch (type) {
            case 'eat':
                this.generateBeep(800, 150, 'square');
                break;
            case 'gameOver':
                this.generateBeep(200, 500, 'sawtooth');
                break;
            case 'move':
                this.generateBeep(300, 50, 'triangle');
                break;
        }
    }
}