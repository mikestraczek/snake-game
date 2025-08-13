# 🐍 Snake Game

Ein klassisches Snake-Spiel, entwickelt mit HTML5 Canvas, CSS3 und Vanilla JavaScript.

## Features

- **Responsive Design**: Funktioniert auf Desktop und Mobile
- **Touch Controls**: Mobile-freundliche Steuerung mit Buttons
- **High Score System**: Speichert den besten Score im Browser
- **Moderne UI**: Glasmorphism-Design mit schönen Animationen
- **Progressive Schwierigkeit**: Das Spiel wird schneller mit höherem Score
- **Keyboard Support**: WASD oder Pfeiltasten
- **Sound Effects**: Immersive Audio-Erfahrung mit Web Audio API
- **Audio Controls**: Lautstärke-Regler und Sound-Toggle

## Steuerung

### Desktop
- **Pfeiltasten** oder **WASD** zum Bewegen der Schlange
- **Klick** oder **beliebige Taste** zum Starten

### Mobile
- **Touch-Buttons** zum Steuern
- **Tap auf Canvas** zum Starten

### Audio
- **Sound-Toggle Button** (🔊/🔇) zum Ein-/Ausschalten der Sounds
- **Lautstärke-Regler** für individuelle Lautstärke-Anpassung
- **Automatische Fallback-Sounds** falls Audio-Dateien nicht verfügbar sind

## Spielregeln

1. Steuere die Schlange mit den Pfeiltasten oder WASD
2. Sammle das rote Futter, um zu wachsen und Punkte zu erhalten
3. Vermeide die Wände und deinen eigenen Körper
4. Das Spiel wird schneller, je mehr Punkte du sammelst
5. Versuche den High Score zu knacken!

## Technische Details

- **HTML5 Canvas** für das Spiel-Rendering
- **CSS3** mit Glasmorphism-Effekten und Responsive Design
- **Vanilla JavaScript** mit objektorientierter Programmierung
- **LocalStorage** für High Score Persistierung
- **Mobile-First** Responsive Design
- **Web Audio API** für Sound-Effekte und Fallback-Sounds
- **AudioManager** Klasse für optimales Audio-Management

## Installation

1. Klone oder lade das Projekt herunter
2. Öffne `index.html` in einem modernen Browser
3. Oder starte einen lokalen Server:
   ```bash
   python3 -m http.server 8000
   ```
4. Öffne `http://localhost:8000` im Browser

## Browser-Kompatibilität

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Entwickelt von

Mike Straczek - Ein modernes Snake-Spiel mit Liebe zum Detail 💚