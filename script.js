class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('high-score');
        this.gameOverElement = document.getElementById('gameOver');
        this.finalScoreElement = document.getElementById('finalScore');
        this.restartBtn = document.getElementById('restartBtn');
        this.soundToggle = document.getElementById('soundToggle');
        this.volumeSlider = document.getElementById('volumeSlider');
        
        // Initialize audio manager
        this.audioManager = new AudioManager();
        
        // Game settings
        this.gridSize = 20;
        this.tileCount = this.canvas.width / this.gridSize;
        
        // Game state
        this.snake = [
            { x: 10, y: 10 }
        ];
        this.food = { x: 15, y: 15 };
        this.dx = 0;
        this.dy = 0;
        this.score = 0;
        this.gameRunning = false;
        this.gameStarted = false;
        
        // Load high score from localStorage
        this.highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
        this.highScoreElement.textContent = this.highScore;
        
        this.setupEventListeners();
        this.setupAudioControls();
        this.generateFood();
        this.gameLoop();
    }
    
    setupAudioControls() {
        // Sound toggle button
        this.soundToggle.addEventListener('click', () => {
            const enabled = this.audioManager.toggle();
            this.soundToggle.textContent = enabled ? '🔊' : '🔇';
            this.soundToggle.classList.toggle('muted', !enabled);
            
            // Resume audio context on user interaction
            this.audioManager.resumeContext();
        });
        
        // Volume slider
        this.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.audioManager.setVolume(volume);
        });
        
        // Initialize volume
        this.audioManager.setVolume(this.volumeSlider.value / 100);
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (!this.gameRunning && !this.gameStarted) {
                this.startGame();
            }
            this.handleKeyPress(e);
        });
        
        // Mobile controls
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.gameRunning && !this.gameStarted) {
                    this.startGame();
                }
                this.handleDirection(btn.dataset.direction);
            });
        });
        
        // Restart button
        this.restartBtn.addEventListener('click', () => {
            this.resetGame();
            this.startGame();
        });
        
        // Canvas click to start
        this.canvas.addEventListener('click', () => {
            if (!this.gameRunning && !this.gameStarted) {
                this.startGame();
            }
            // Resume audio context on user interaction
            this.audioManager.resumeContext();
        });
    }
    
    handleKeyPress(e) {
        const key = e.key;
        
        // Prevent default behavior for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            e.preventDefault();
        }
        
        switch (key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.handleDirection('up');
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.handleDirection('down');
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.handleDirection('left');
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.handleDirection('right');
                break;
        }
    }
    
    handleDirection(direction) {
        if (!this.gameRunning) return;
        
        switch (direction) {
            case 'up':
                if (this.dy !== 1) {
                    this.dx = 0;
                    this.dy = -1;
                }
                break;
            case 'down':
                if (this.dy !== -1) {
                    this.dx = 0;
                    this.dy = 1;
                }
                break;
            case 'left':
                if (this.dx !== 1) {
                    this.dx = -1;
                    this.dy = 0;
                }
                break;
            case 'right':
                if (this.dx !== -1) {
                    this.dx = 1;
                    this.dy = 0;
                }
                break;
        }
    }
    
    startGame() {
        this.gameRunning = true;
        this.gameStarted = true;
        this.gameOverElement.classList.remove('show');
        
        // Start moving right
        this.dx = 1;
        this.dy = 0;
        
        // Resume audio context
        this.audioManager.resumeContext();
    }
    
    resetGame() {
        this.snake = [{ x: 10, y: 10 }];
        this.dx = 0;
        this.dy = 0;
        this.score = 0;
        this.gameRunning = false;
        this.gameStarted = false;
        this.scoreElement.textContent = this.score;
        this.gameOverElement.classList.remove('show');
        this.generateFood();
    }
    
    generateFood() {
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
        } while (this.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
        
        this.food = newFood;
    }
    
    update() {
        if (!this.gameRunning) return;
        
        // Move snake head
        const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
        
        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this.gameOver();
            return;
        }
        
        // Check self collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.gameOver();
            return;
        }
        
        this.snake.unshift(head);
        
        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.scoreElement.textContent = this.score;
            this.generateFood();
            
            // Play eat sound
            this.audioManager.play('eat');
            
            // Add pulse animation to score
            this.scoreElement.parentElement.style.animation = 'pulse 0.3s ease-in-out';
            setTimeout(() => {
                this.scoreElement.parentElement.style.animation = '';
            }, 300);
        } else {
            this.snake.pop();
        }
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid (subtle)
        this.ctx.strokeStyle = '#e9ecef';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.tileCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.gridSize);
            this.ctx.lineTo(this.canvas.width, i * this.gridSize);
            this.ctx.stroke();
        }
        
        // Draw snake
        this.snake.forEach((segment, index) => {
            if (index === 0) {
                // Snake head
                this.ctx.fillStyle = '#2d6a4f';
                this.ctx.fillRect(
                    segment.x * this.gridSize + 1,
                    segment.y * this.gridSize + 1,
                    this.gridSize - 2,
                    this.gridSize - 2
                );
                
                // Eyes
                this.ctx.fillStyle = '#ffffff';
                const eyeSize = 3;
                const eyeOffset = 5;
                
                if (this.dx === 1) { // Moving right
                    this.ctx.fillRect(segment.x * this.gridSize + 12, segment.y * this.gridSize + 5, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + 12, segment.y * this.gridSize + 12, eyeSize, eyeSize);
                } else if (this.dx === -1) { // Moving left
                    this.ctx.fillRect(segment.x * this.gridSize + 5, segment.y * this.gridSize + 5, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + 5, segment.y * this.gridSize + 12, eyeSize, eyeSize);
                } else if (this.dy === -1) { // Moving up
                    this.ctx.fillRect(segment.x * this.gridSize + 5, segment.y * this.gridSize + 5, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + 12, segment.y * this.gridSize + 5, eyeSize, eyeSize);
                } else if (this.dy === 1) { // Moving down
                    this.ctx.fillRect(segment.x * this.gridSize + 5, segment.y * this.gridSize + 12, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + 12, segment.y * this.gridSize + 12, eyeSize, eyeSize);
                }
            } else {
                // Snake body
                this.ctx.fillStyle = '#4ecdc4';
                this.ctx.fillRect(
                    segment.x * this.gridSize + 2,
                    segment.y * this.gridSize + 2,
                    this.gridSize - 4,
                    this.gridSize - 4
                );
            }
        });
        
        // Draw food
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2,
            this.food.y * this.gridSize + this.gridSize / 2,
            (this.gridSize - 4) / 2,
            0,
            2 * Math.PI
        );
        this.ctx.fill();
        
        // Add glow effect to food
        this.ctx.shadowColor = '#ff6b6b';
        this.ctx.shadowBlur = 10;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // Draw start message
        if (!this.gameStarted) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Klicke oder drücke eine Taste', this.canvas.width / 2, this.canvas.height / 2 - 10);
            this.ctx.fillText('um zu starten!', this.canvas.width / 2, this.canvas.height / 2 + 20);
        }
    }
    
    gameOver() {
        this.gameRunning = false;
        this.finalScoreElement.textContent = this.score;
        
        // Play game over sound
        this.audioManager.play('gameOver');
        
        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreElement.textContent = this.highScore;
            localStorage.setItem('snakeHighScore', this.highScore.toString());
        }
        
        this.gameOverElement.classList.add('show');
    }
    
    gameLoop() {
        this.update();
        this.draw();
        
        // Game speed increases with score
        const speed = Math.max(100, 200 - Math.floor(this.score / 50) * 10);
        setTimeout(() => this.gameLoop(), speed);
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new SnakeGame();
});

// Prevent scrolling with arrow keys
window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
});