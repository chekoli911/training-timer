// Telegram Mini App Game: Krushka - Knight Rider
// A pixel-art endless runner with 5 themed levels

// ==================== DEVICE DETECTION ====================
function isMobileDevice() {
    // Check if it's a mobile device by user agent
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Also check screen size - if width <= 768 and height > width, it's mobile
    const isMobileSize = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
    
    // For large screens (desktop), always use horizontal mode
    const isLargeScreen = window.innerWidth > 768;
    
    // Mobile only if mobile UA AND (small screen OR portrait orientation)
    return isMobileUA && (isMobileSize || (!isLargeScreen && window.innerHeight > window.innerWidth));
}

function getOptimalCanvasSize() {
    const isMobile = isMobileDevice();
    const screenWidth = window.innerWidth || 1920;
    const screenHeight = window.innerHeight || 1080;
    
    // Mobile: vertical mode
    if (isMobile) {
        return { width: 400, height: 800 };
    }
    
    // Desktop/Large screens: horizontal mode (landscape)
    // Base size for 1920x1080, scale up for 4K
    const baseWidth = 800;
    const baseHeight = 450;
    
    // For 4K and larger monitors, increase base size
    if (screenWidth >= 2560) {
        // 4K and above: use larger base size
        const scale = Math.min(screenWidth / 2560, screenHeight / 1440);
        return {
            width: Math.floor(baseWidth * Math.min(scale, 1.5)), // Max 1.5x for very large screens
            height: Math.floor(baseHeight * Math.min(scale, 1.5))
        };
    }
    
    // Standard desktop: horizontal mode
    return { width: baseWidth, height: baseHeight };
}

// ==================== CONFIGURATION ====================
// Get initial size (will be recalculated on resize)
const initialSize = getOptimalCanvasSize();
const CONFIG = {
    // Will be set based on device and screen size
    CANVAS_WIDTH: initialSize.width,
    CANVAS_HEIGHT: initialSize.height,
    GRAVITY: 0.8,
    JUMP_STRENGTH_MIN: -15,
    JUMP_STRENGTH_MAX: -28,
    JUMP_CHARGE_RATE: 0.02, // How fast jump power charges per frame (at 60fps, takes ~0.8 seconds to max)
    JUMP_CHARGE_DIRECTION: 1, // 1 for increasing, -1 for decreasing
    // Ground and player sizes (will be recalculated if needed)
    GROUND_Y: isMobileDevice() ? 700 : 350,
    PLAYER_WIDTH: isMobileDevice() ? 35 : 40,
    PLAYER_HEIGHT: isMobileDevice() ? 45 : 50,
    PLAYER_START_X: isMobileDevice() ? 30 : 100,
    BASE_SPEED: 3,
    OBSTACLE_WIDTH: isMobileDevice() ? 35 : 40,
    OBSTACLE_HEIGHT: isMobileDevice() ? 35 : 40,
    PIT_WIDTH: isMobileDevice() ? 70 : 80,
    PIT_HEIGHT: isMobileDevice() ? 90 : 100,
    GROUND_TEXTURE_SIZE: 20, // Size of ground texture pattern
    AI_JUMP_DISTANCE_PIT: 180, // Distance before pit to jump (AI) - need more distance for pits
    AI_JUMP_DISTANCE_FIRE: 120, // Distance before fire to jump (AI) - less distance for fires
    AI_JUMP_CHARGE_MIN: 0.4, // Minimum jump charge for AI
    AI_JUMP_CHARGE_MAX: 0.9, // Maximum jump charge for AI
};

// ==================== LEVEL CONFIGURATIONS ====================
const LEVELS = [
    {
        name: 'Morning',
        skyColor: '#87CEEB',
        skyColor2: '#E0F6FF',
        groundColor: '#8B7355',
        speed: CONFIG.BASE_SPEED,
        spawnRate: 0.008,
        targetDistance: 2000,
        backgroundImage: 'assets/background_morning.png'
    },
    {
        name: 'Day',
        skyColor: '#4A90E2',
        skyColor2: '#87CEEB',
        groundColor: '#9B7D5F',
        speed: CONFIG.BASE_SPEED * 1.2,
        spawnRate: 0.01,
        targetDistance: 2500,
        backgroundImage: 'assets/background_day.png'
    },
    {
        name: 'Sunrise',
        skyColor: '#FF6B35',
        skyColor2: '#FFB347',
        groundColor: '#A0826D',
        speed: CONFIG.BASE_SPEED * 1.4,
        spawnRate: 0.012,
        targetDistance: 3000,
        backgroundImage: 'assets/background_sunrise.png'
    },
    {
        name: 'Sunset',
        skyColor: '#8B0000',
        skyColor2: '#FF4500',
        groundColor: '#8B6F47',
        speed: CONFIG.BASE_SPEED * 1.6,
        spawnRate: 0.015,
        targetDistance: 3500,
        backgroundImage: 'assets/background_sunset.png'
    },
    {
        name: 'Night',
        skyColor: '#191970',
        skyColor2: '#4B0082',
        groundColor: '#5C4A37',
        speed: CONFIG.BASE_SPEED * 1.8,
        spawnRate: 0.018,
        targetDistance: 4000,
        backgroundImage: 'assets/background_night.png'
    }
];

// ==================== GAME STATES ====================
const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_COMPLETE: 'levelComplete',
    GAME_OVER: 'gameOver',
    ALL_COMPLETE: 'allComplete'
};

// ==================== PLAYER CLASS ====================
class Player {
    constructor() {
        // Position player based on device type
        if (isMobileDevice()) {
            this.x = 30; // Close to left edge on mobile
        } else {
            this.x = CONFIG.CANVAS_WIDTH / 2 - CONFIG.PLAYER_WIDTH / 2; // Centered on desktop
        }
        this.y = CONFIG.GROUND_Y;
        this.width = CONFIG.PLAYER_WIDTH;
        this.height = CONFIG.PLAYER_HEIGHT;
        this.velocityY = 0;
        this.isJumping = false;
        this.onGround = true;
        this.image = null;
        this.jumpCharging = false;
        this.jumpChargePower = 0; // 0 to 1, where 1 is max jump
        this.jumpChargeDirection = 1; // 1 for increasing, -1 for decreasing
        this.loadImage();
    }

    loadImage() {
        this.image = new Image();
        this.image.src = 'assets/knight.png';
        this.image.onerror = () => {
            // Image not found, will use drawn sprite
            this.image = null;
        };
    }

    startJumpCharge() {
        if (this.onGround && !this.isJumping) {
            this.jumpCharging = true;
            this.jumpChargePower = 0;
            this.jumpChargeDirection = 1; // Start increasing
        }
    }

    updateJumpCharge() {
        if (this.jumpCharging && this.onGround && !this.isJumping) {
            // Update charge power based on direction
            this.jumpChargePower += CONFIG.JUMP_CHARGE_RATE * this.jumpChargeDirection;
            
            // Reverse direction when reaching limits
            if (this.jumpChargePower >= 1) {
                this.jumpChargePower = 1;
                this.jumpChargeDirection = -1; // Start decreasing
            } else if (this.jumpChargePower <= 0) {
                this.jumpChargePower = 0;
                this.jumpChargeDirection = 1; // Start increasing
            }
        } else if (!this.jumpCharging) {
            // Reset charge if not charging
            this.jumpChargePower = 0;
            this.jumpChargeDirection = 1;
        }
    }

    releaseJump() {
        // Always allow jump if on ground, even if not charging
        if (this.onGround && !this.isJumping) {
            // Use current charge power (even if small, it will affect jump height)
            const jumpPower = Math.max(0, Math.min(1, this.jumpChargePower));
            
            // Calculate jump strength based on charge (0 = min, 1 = max)
            // If no charge (quick tap), use minimum; if full charge, use maximum
            const jumpStrength = CONFIG.JUMP_STRENGTH_MIN + 
                                (CONFIG.JUMP_STRENGTH_MAX - CONFIG.JUMP_STRENGTH_MIN) * jumpPower;
            
            this.velocityY = jumpStrength;
            this.isJumping = true;
            this.onGround = false;
            this.jumpCharging = false;
            this.jumpChargePower = 0;
            this.jumpChargeDirection = 1;
        } else if (this.jumpCharging) {
            // Cancel charging if not on ground
            this.jumpCharging = false;
            this.jumpChargePower = 0;
            this.jumpChargeDirection = 1;
        }
    }

    update() {
        // Update jump charge if charging (only reset if not charging)
        this.updateJumpCharge();
        
        // Apply gravity
        this.velocityY += CONFIG.GRAVITY;
        this.y += this.velocityY;

        // Ground collision
        if (this.y >= CONFIG.GROUND_Y) {
            this.y = CONFIG.GROUND_Y;
            this.velocityY = 0;
            this.isJumping = false;
            this.onGround = true;
            // Don't reset charging here - let it continue if space is still pressed
            // Only reset if player is not charging
            if (!this.jumpCharging) {
                this.jumpChargePower = 0;
                this.jumpChargeDirection = 1;
            }
        }
    }

    draw(ctx) {
        if (this.image && this.image.complete) {
            ctx.drawImage(this.image, this.x, this.y - this.height, this.width, this.height);
        } else {
            // Draw simple knight sprite (pixel-art style)
            ctx.fillStyle = '#2C3E50';
            // Body
            ctx.fillRect(this.x + 10, this.y - this.height + 20, 20, 20);
            // Head
            ctx.fillStyle = '#FFDBAC';
            ctx.fillRect(this.x + 12, this.y - this.height + 5, 16, 16);
            // Helmet
            ctx.fillStyle = '#34495E';
            ctx.fillRect(this.x + 10, this.y - this.height, 20, 10);
            // Horse body
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y - 20, 40, 20);
            // Legs
            ctx.fillRect(this.x + 5, this.y - 5, 8, 5);
            ctx.fillRect(this.x + 27, this.y - 5, 8, 5);
        }
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y - this.height,
            width: this.width,
            height: this.height
        };
    }
}

// ==================== OBSTACLE CLASS ====================
class Obstacle {
    constructor(x, type, level) {
        this.x = x;
        this.type = type; // 'pit' or 'fire'
        this.level = level;
        
        if (type === 'pit') {
            this.width = CONFIG.PIT_WIDTH;
            this.height = CONFIG.PIT_HEIGHT;
            // Pit starts at ground level and goes down
            this.y = CONFIG.GROUND_Y;
        } else {
            this.width = CONFIG.OBSTACLE_WIDTH;
            this.height = CONFIG.OBSTACLE_HEIGHT;
            this.y = CONFIG.GROUND_Y - this.height;
        }
        
        this.image = null;
        this.loadImage();
    }

    loadImage() {
        this.image = new Image();
        if (this.type === 'pit') {
            this.image.src = 'assets/pit.png';
        } else {
            this.image.src = 'assets/fire.png';
        }
        this.image.onerror = () => {
            this.image = null;
        };
    }

    update(speed) {
        this.x -= speed;
    }

    draw(ctx, levelConfig) {
        if (this.type === 'pit') {
            // Draw pit - it's a hole in the ground, so draw it going down from GROUND_Y
            if (this.image && this.image.complete) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            } else {
                // Draw pit as a dark hole in the ground
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = '#000';
                ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
                // Draw edges of the pit
                ctx.fillStyle = '#4a4a4a';
                ctx.fillRect(this.x, this.y, this.width, 3);
            }
        } else {
            // Draw fire
            if (this.image && this.image.complete) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            } else {
                // Animated fire effect
                const time = Date.now() * 0.01;
                ctx.fillStyle = `hsl(${20 + Math.sin(time) * 10}, 100%, ${50 + Math.sin(time * 2) * 20}%)`;
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = `hsl(${30 + Math.sin(time * 1.5) * 10}, 100%, ${60 + Math.sin(time * 3) * 15}%)`;
                ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
            }
        }
    }

    getBounds() {
        if (this.type === 'pit') {
            // Pit collision: check if player is over the pit and below ground level
            return {
                x: this.x,
                y: this.y, // Start at ground level
                width: this.width,
                height: this.height // Goes down from ground
            };
        } else {
            return {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height
            };
        }
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }
}

// ==================== GAME CLASS ====================
class Game {
    constructor(canvas) {
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        if (!this.ctx) {
            console.error('Could not get 2d context from canvas!');
            return;
        }
        
        this.state = GAME_STATE.MENU;
        this.currentLevel = 0;
        this.score = 0;
        this.distance = 0;
        this.lives = 3; // Player lives (reduced to 3)
        this.player = null;
        this.obstacles = [];
        this.lastSpawnTime = 0;
        this.frameCount = 0;
        this.animationId = null;
        this.backgroundImages = {};
        this.groundOffset = 0; // For moving ground texture
        this.demoMode = false; // CPU control mode
        this.isMobile = isMobileDevice();
        this.demoTimer = null; // Timer for auto-demo
        this.lastInteractionTime = Date.now(); // Track last user interaction
        this.lastObstacleX = -1000; // Track last obstacle position for spacing
        
        this.setupCanvas();
        this.setupTelegram();
        this.setupControls();
        this.loadBackgroundImages();
        this.start();
    }

    setupCanvas() {
        const resize = () => {
            const container = document.getElementById('game-container');
            if (!container) {
                console.error('Game container not found!');
                return;
            }
            
            const containerWidth = container.clientWidth || window.innerWidth;
            const containerHeight = container.clientHeight || window.innerHeight;
            
            // Recalculate optimal size on resize (for window resizing and 4K support)
            const optimalSize = getOptimalCanvasSize();
            const canvasWidth = optimalSize.width;
            const canvasHeight = optimalSize.height;
            
            // Update CONFIG dynamically
            CONFIG.CANVAS_WIDTH = canvasWidth;
            CONFIG.CANVAS_HEIGHT = canvasHeight;
            
            // For mobile devices, use full screen
            if (this.isMobile) {
                this.canvas.width = canvasWidth;
                this.canvas.height = canvasHeight;
                this.canvas.style.width = '100vw';
                this.canvas.style.height = '100vh';
            } else {
                // For desktop, calculate scale to fit screen while maintaining aspect ratio
                const scaleX = containerWidth / canvasWidth;
                const scaleY = containerHeight / canvasHeight;
                const scale = Math.min(scaleX, scaleY) || 1;
                
                // For very large screens (4K+), use full scale but limit to reasonable size
                const maxScale = Math.min(scale, 1.5);
                
                this.canvas.width = canvasWidth;
                this.canvas.height = canvasHeight;
                
                // Scale to fit screen while maintaining aspect ratio
                const scaledWidth = canvasWidth * maxScale;
                const scaledHeight = canvasHeight * maxScale;
                
                this.canvas.style.width = scaledWidth + 'px';
                this.canvas.style.height = scaledHeight + 'px';
            }
        };
        
        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', () => {
            setTimeout(resize, 100); // Delay to allow orientation change
        });
    }

    setupTelegram() {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            
            // Use theme colors if available
            const theme = window.Telegram.WebApp.themeParams;
            if (theme.bg_color) {
                document.body.style.background = theme.bg_color;
            }
        }
    }

    setupControls() {
        // Track if space is currently pressed
        this.spacePressed = false;
        this.touchActive = false;

        // Make canvas focusable for keyboard events
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.style.outline = 'none';

        // Keyboard - keydown (use window to catch all events)
        const keydownHandler = (e) => {
            // Reset demo timer on any key press
            this.resetDemoTimer();
            
            const isSpace = e.code === 'Space' || e.key === ' ' || e.keyCode === 32;
            if (isSpace && !this.spacePressed) {
                e.preventDefault();
                e.stopPropagation();
                this.spacePressed = true;
                this.handleJumpStart();
            }
        };

        // Keyboard - keyup
        const keyupHandler = (e) => {
            const isSpace = e.code === 'Space' || e.key === ' ' || e.keyCode === 32;
            if (isSpace) {
                e.preventDefault();
                e.stopPropagation();
                if (this.spacePressed) {
                    this.spacePressed = false;
                    this.handleJumpRelease();
                }
            }
        };

        // Add listeners to both window and document
        // Use capture phase to catch events early
        window.addEventListener('keydown', keydownHandler, true);
        window.addEventListener('keyup', keyupHandler, true);
        document.addEventListener('keydown', keydownHandler, true);
        document.addEventListener('keyup', keyupHandler, true);
        this.canvas.addEventListener('keydown', keydownHandler);
        this.canvas.addEventListener('keyup', keyupHandler);
        
        // Also add a simple test handler to debug
        const testHandler = (e) => {
            if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
                console.log('Space detected!', {
                    state: this.state,
                    hasPlayer: !!this.player,
                    playerOnGround: this.player?.onGround,
                    playerJumping: this.player?.isJumping
                });
            }
        };
        window.addEventListener('keydown', testHandler);

        // Mouse/Touch - start
        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.focusCanvas();
            this.resetDemoTimer(); // Reset timer on interaction
            this.touchActive = true;
            this.handleJumpStart();
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.focusCanvas();
            this.resetDemoTimer(); // Reset timer on interaction
            this.touchActive = true;
            this.handleJumpStart();
        });

        // Also focus on click
        this.canvas.addEventListener('click', (e) => {
            this.focusCanvas();
            // Reset demo timer on any click
            this.resetDemoTimer();
            
            // Handle pause button click
            if (this.state === GAME_STATE.PLAYING && this.pauseButtonBounds) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Scale coordinates to canvas coordinates
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const canvasX = x * scaleX;
                const canvasY = y * scaleY;
                
                // Check if clicked on pause button
                if (canvasX >= this.pauseButtonBounds.x &&
                    canvasX <= this.pauseButtonBounds.x + this.pauseButtonBounds.width &&
                    canvasY >= this.pauseButtonBounds.y &&
                    canvasY <= this.pauseButtonBounds.y + this.pauseButtonBounds.height) {
                    this.togglePause();
                    return;
                }
            }
            
            // Handle pause/unpause on click during paused state
            if (this.state === GAME_STATE.PAUSED) {
                this.togglePause();
                return;
            }
        });

        // Mouse/Touch - end
        this.canvas.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.touchActive = false;
            this.handleJumpRelease();
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchActive = false;
            this.handleJumpRelease();
        });

        // Also handle mouse/touch leave
        this.canvas.addEventListener('mouseleave', () => {
            this.touchActive = false;
            this.handleJumpRelease();
        });

        this.canvas.addEventListener('touchcancel', () => {
            this.touchActive = false;
            this.handleJumpRelease();
        });
    }

    handleJumpStart() {
        if (this.state === GAME_STATE.PLAYING && this.player && !this.demoMode) {
            this.player.startJumpCharge();
        } else if (this.state === GAME_STATE.PLAYING && this.demoMode) {
            // Stop demo mode on click/tap
            this.stopDemo();
        } else if (this.state === GAME_STATE.MENU) {
            this.startLevel(false); // Normal mode
        } else if (this.state === GAME_STATE.LEVEL_COMPLETE) {
            this.nextLevel();
        } else if (this.state === GAME_STATE.GAME_OVER) {
            this.restartLevel();
        } else if (this.state === GAME_STATE.ALL_COMPLETE) {
            this.restartGame();
        }
    }

    handleDemoStart() {
        if (this.state === GAME_STATE.MENU) {
            this.startLevel(true); // Demo mode
        }
    }

    handleJumpRelease() {
        if (this.state === GAME_STATE.PLAYING && this.player) {
            this.player.releaseJump();
        }
    }

    // Fallback: quick jump on space press (for testing)
    handleQuickJump() {
        if (this.state === GAME_STATE.PLAYING && this.player && this.player.onGround && !this.player.isJumping) {
            this.player.velocityY = CONFIG.JUMP_STRENGTH_MIN;
            this.player.isJumping = true;
            this.player.onGround = false;
        }
    }

    // Focus canvas when clicking on it to enable keyboard input
    focusCanvas() {
        try {
            if (this.canvas && document.activeElement !== this.canvas) {
                this.canvas.focus();
            }
        } catch (e) {
            // Ignore focus errors
        }
    }

    loadBackgroundImages() {
        LEVELS.forEach((level, index) => {
            const img = new Image();
            img.src = level.backgroundImage;
            this.backgroundImages[index] = img;
        });
    }

    start() {
        this.state = GAME_STATE.MENU;
        // Draw immediately to show menu
        this.draw();
        // Start game loop
        this.gameLoop();
        // Focus canvas after a short delay to enable keyboard input
        setTimeout(() => this.focusCanvas(), 100);
        // Start demo timer
        this.startDemoTimer();
    }
    
    startDemoTimer() {
        // Clear any existing timer
        if (this.demoTimer) {
            clearTimeout(this.demoTimer);
        }
        
        // Reset interaction time
        this.lastInteractionTime = Date.now();
        
        // Start timer for 30 seconds
        this.demoTimer = setTimeout(() => {
            if (this.state === GAME_STATE.MENU) {
                // Auto-start demo mode after 30 seconds of inactivity
                this.handleDemoStart();
            }
        }, 30000); // 30 seconds
    }
    
    resetDemoTimer() {
        // Reset timer on any user interaction
        this.lastInteractionTime = Date.now();
        if (this.state === GAME_STATE.MENU) {
            this.startDemoTimer();
        }
    }

    startLevel(demoMode = false) {
        // Clear demo timer when starting game
        if (this.demoTimer) {
            clearTimeout(this.demoTimer);
            this.demoTimer = null;
        }
        
        this.state = GAME_STATE.PLAYING;
        this.currentLevel = 0;
        this.score = 0;
        this.distance = 0;
        this.lives = 3; // Reset lives to 3
        this.player = new Player();
        this.obstacles = [];
        this.lastSpawnTime = 0;
        this.frameCount = 0;
        this.demoMode = demoMode;
        this.lastObstacleX = -1000; // Reset obstacle tracking
    }

    nextLevel() {
        if (this.demoMode) {
            // In demo mode, always loop levels
            this.currentLevel++;
            if (this.currentLevel >= LEVELS.length) {
                this.currentLevel = 0; // Loop back to level 1
            }
            this.distance = 0;
            this.obstacles = [];
            this.lastSpawnTime = 0;
            this.lastObstacleX = -1000;
            this.player = new Player();
            this.state = GAME_STATE.PLAYING;
        } else {
            this.currentLevel++;
            if (this.currentLevel >= LEVELS.length) {
                this.state = GAME_STATE.ALL_COMPLETE;
            } else {
                this.distance = 0;
                this.obstacles = [];
                this.lastSpawnTime = 0;
                this.lastObstacleX = -1000;
                this.player = new Player();
                this.state = GAME_STATE.PLAYING;
            }
        }
    }

    restartLevel() {
        this.distance = 0;
        this.obstacles = [];
        this.lastSpawnTime = 0;
        this.lastObstacleX = -1000;
        this.player = new Player();
        this.state = GAME_STATE.PLAYING;
        // Keep demo mode and lives if it was active
    }

    restartGame() {
        this.currentLevel = 0;
        this.score = 0;
        this.distance = 0;
        this.obstacles = [];
        this.lastSpawnTime = 0;
        this.player = new Player();
        this.state = GAME_STATE.PLAYING;
        this.demoMode = false; // Reset demo mode
    }
    
    stopDemo() {
        // Stop demo and return to menu
        this.demoMode = false;
        this.state = GAME_STATE.MENU;
        // Restart demo timer
        this.startDemoTimer();
    }
    
    togglePause() {
        if (this.state === GAME_STATE.PLAYING) {
            this.state = GAME_STATE.PAUSED;
        } else if (this.state === GAME_STATE.PAUSED) {
            this.state = GAME_STATE.PLAYING;
        }
    }

    spawnObstacle() {
        const levelConfig = LEVELS[this.currentLevel];
        const x = CONFIG.CANVAS_WIDTH;
        
        // Calculate minimum safe distance between obstacles
        // Player max jump distance is approximately 250-300px
        const minDistance = 280; // Minimum distance between obstacles
        const safeDistance = 320; // Safe distance for comfortable gameplay
        const fireSequenceDistance = 200; // Distance for fire sequences (jumpable)
        
        // Check if we can spawn obstacle (enough distance from last one)
        const distanceFromLast = x - this.lastObstacleX;
        if (distanceFromLast < minDistance) {
            return; // Don't spawn if too close
        }
        
        // Smart obstacle generation with fire sequences
        let type;
        const lastObstacle = this.obstacles.length > 0 ? this.obstacles[this.obstacles.length - 1] : null;
        const secondLastObstacle = this.obstacles.length > 1 ? this.obstacles[this.obstacles.length - 2] : null;
        const thirdLastObstacle = this.obstacles.length > 2 ? this.obstacles[this.obstacles.length - 3] : null;
        
        // Check if we're in a fire sequence pattern
        const inFireSequence = lastObstacle && secondLastObstacle && 
                               lastObstacle.type === 'fire' && secondLastObstacle.type === 'fire';
        
        // 40% chance to create fire sequence, 30% chance for pit (more obstacles)
        if (!inFireSequence && Math.random() < 0.4 && distanceFromLast >= fireSequenceDistance) {
            // Start fire sequence
            type = 'fire';
        } else if (!inFireSequence && Math.random() < 0.3 && distanceFromLast >= minDistance) {
            // Add more pits
            type = 'pit';
        }
        // Continue fire sequence if we're in one
        else if (inFireSequence && distanceFromLast >= fireSequenceDistance) {
            type = 'fire'; // Continue sequence
        }
        // Check for problematic patterns - prevent 3+ of same type in a row (except fire sequences)
        else if (lastObstacle && secondLastObstacle && thirdLastObstacle) {
            // If last three were same type, force opposite
            if (lastObstacle.type === 'pit' && secondLastObstacle.type === 'pit' && thirdLastObstacle.type === 'pit') {
                type = 'fire'; // Force fire after 3 pits
            } else if (lastObstacle.type === 'fire' && secondLastObstacle.type === 'fire' && thirdLastObstacle.type === 'fire') {
                type = 'pit'; // Force pit after 3 fires (end sequence)
            } else if (lastObstacle.type === 'pit' && secondLastObstacle.type === 'pit') {
                type = 'fire'; // Avoid 3rd pit
            } else {
                // Alternate pattern
                type = lastObstacle.type === 'pit' ? 'fire' : 'pit';
            }
        }
        // Check for problematic patterns with 2 obstacles
        else if (lastObstacle && secondLastObstacle) {
            // If last two were pits, next must be fire (avoid 3 pits in a row)
            if (lastObstacle.type === 'pit' && secondLastObstacle.type === 'pit') {
                type = 'fire';
            }
            // If last two were fires (not in sequence), next must be pit
            else if (lastObstacle.type === 'fire' && secondLastObstacle.type === 'fire' && distanceFromLast < fireSequenceDistance) {
                type = 'pit';
            }
            // Alternate pattern
            else {
                type = lastObstacle.type === 'pit' ? 'fire' : 'pit';
            }
        }
        // If only one obstacle exists
        else if (lastObstacle) {
            // Prefer alternating pattern
            type = lastObstacle.type === 'pit' ? 'fire' : 'pit';
        }
        // First obstacle - random
        else {
            type = Math.random() < 0.5 ? 'pit' : 'fire';
        }
        
        // Ensure minimum distance between obstacles
        if (distanceFromLast < safeDistance && lastObstacle && !inFireSequence) {
            // If too close and not in fire sequence, skip this spawn
            return;
        }
        
        const obstacle = new Obstacle(x, type, this.currentLevel);
        this.obstacles.push(obstacle);
        this.lastObstacleX = x + (type === 'pit' ? CONFIG.PIT_WIDTH : CONFIG.OBSTACLE_WIDTH);
    }

    checkCollisions() {
        const playerBounds = this.player.getBounds();
        const playerBottomY = this.player.y; // Player's bottom Y coordinate
        
        for (let obstacle of this.obstacles) {
            if (obstacle.type === 'pit') {
                // For pits: check if player is over the pit and below ground level
                const pitBounds = obstacle.getBounds();
                const isOverPit = playerBounds.x < pitBounds.x + pitBounds.width &&
                                  playerBounds.x + playerBounds.width > pitBounds.x;
                
                if (isOverPit && playerBottomY >= CONFIG.GROUND_Y) {
                    // Player is over pit and on/below ground level - fell into pit
                    this.loseLife();
                    return true;
                }
            } else {
                // For fires: standard rectangle collision
                const obstacleBounds = obstacle.getBounds();
                
                if (playerBounds.x < obstacleBounds.x + obstacleBounds.width &&
                    playerBounds.x + playerBounds.width > obstacleBounds.x &&
                    playerBounds.y < obstacleBounds.y + obstacleBounds.height &&
                    playerBounds.y + playerBounds.height > obstacleBounds.y) {
                    
                    // Collision detected
                    this.loseLife();
                    return true;
                }
            }
        }
        
        return false;
    }
    
    loseLife() {
        this.lives--;
        
        if (this.lives <= 0) {
            // No lives left - restart from level 1
            this.currentLevel = 0;
            this.lives = 3;
            this.score = 0;
            this.distance = 0;
            this.obstacles = [];
            this.lastSpawnTime = 0;
            this.lastObstacleX = -1000;
            this.player = new Player();
            this.state = GAME_STATE.PLAYING;
        } else {
            // Still have lives - continue from current position
            // Small invincibility period - remove obstacle that caused collision
            // This prevents immediate death from same obstacle
            if (this.obstacles.length > 0) {
                // Remove the obstacle that caused collision
                const playerBounds = this.player.getBounds();
                const playerBottomY = this.player.y;
                
                const collidedObstacle = this.obstacles.find(obs => {
                    if (obs.type === 'pit') {
                        const pitBounds = obs.getBounds();
                        const isOverPit = playerBounds.x < pitBounds.x + pitBounds.width &&
                                         playerBounds.x + playerBounds.width > pitBounds.x;
                        return isOverPit && playerBottomY >= CONFIG.GROUND_Y;
                    } else {
                        const obsBounds = obs.getBounds();
                        return playerBounds.x < obsBounds.x + obsBounds.width &&
                               playerBounds.x + playerBounds.width > obsBounds.x &&
                               playerBounds.y < obsBounds.y + obsBounds.height &&
                               playerBounds.y + playerBounds.height > obsBounds.y;
                    }
                });
                
                if (collidedObstacle) {
                    const index = this.obstacles.indexOf(collidedObstacle);
                    if (index > -1) {
                        this.obstacles.splice(index, 1);
                    }
                }
            }
        }
    }
    
    drawHeart(ctx, x, y, size) {
        // Draw a simple heart symbol (♥)
        ctx.save();
        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', x, y);
        ctx.restore();
    }

    updateAI() {
        if (!this.demoMode || !this.player || !this.player.onGround) return;
        
        // Find nearest obstacle
        let nearestObstacle = null;
        let nearestDistance = Infinity;
        
        for (let obstacle of this.obstacles) {
            const distance = obstacle.x - (this.player.x + this.player.width);
            if (distance > 0 && distance < nearestDistance) {
                nearestDistance = distance;
                nearestObstacle = obstacle;
            }
        }
        
        // Jump if obstacle is close enough
        if (nearestObstacle && nearestDistance > 0) {
            const obstacleType = nearestObstacle.type;
            const jumpDistance = obstacleType === 'pit' ? CONFIG.AI_JUMP_DISTANCE_PIT : CONFIG.AI_JUMP_DISTANCE_FIRE;
            
            if (nearestDistance < jumpDistance) {
                // Calculate jump strength based on obstacle type, distance, and level difficulty
                let jumpPower;
                
                if (obstacleType === 'pit') {
                    // For pits, use stronger jump based on distance - closer = stronger jump needed
                    const distanceRatio = Math.max(0, Math.min(1, nearestDistance / CONFIG.AI_JUMP_DISTANCE_PIT));
                    // Closer to pit = need stronger jump (inverse relationship)
                    jumpPower = CONFIG.AI_JUMP_CHARGE_MIN + 
                               (CONFIG.AI_JUMP_CHARGE_MAX - CONFIG.AI_JUMP_CHARGE_MIN) * (1 - distanceRatio * 0.5);
                } else {
                    // For fires, use moderate jump based on distance
                    const distanceRatio = Math.max(0, Math.min(1, nearestDistance / CONFIG.AI_JUMP_DISTANCE_FIRE));
                    jumpPower = CONFIG.AI_JUMP_CHARGE_MIN + 
                               (CONFIG.AI_JUMP_CHARGE_MAX - CONFIG.AI_JUMP_CHARGE_MIN) * (0.5 + distanceRatio * 0.3);
                }
                
                // Add some randomness for realism (5% variation)
                jumpPower += (Math.random() - 0.5) * 0.1;
                jumpPower = Math.max(CONFIG.AI_JUMP_CHARGE_MIN, Math.min(CONFIG.AI_JUMP_CHARGE_MAX, jumpPower));
                
                const jumpStrength = CONFIG.JUMP_STRENGTH_MIN + 
                                    (CONFIG.JUMP_STRENGTH_MAX - CONFIG.JUMP_STRENGTH_MIN) * jumpPower;
                
                if (this.player.onGround && !this.player.isJumping) {
                    this.player.velocityY = jumpStrength;
                    this.player.isJumping = true;
                    this.player.onGround = false;
                }
            }
        }
    }

    update() {
        // Don't update if paused
        if (this.state === GAME_STATE.PAUSED) {
            return;
        }
        
        // Always update ground offset for smooth animation (even in menu)
        if (this.state === GAME_STATE.PLAYING) {
            const levelConfig = LEVELS[this.currentLevel];
            // In demo mode, slow down time slightly (0.9x speed for more realistic feel)
            const timeMultiplier = this.demoMode ? 0.9 : 1.0;
            const speed = levelConfig.speed * timeMultiplier;
            
            // Update player
            this.player.update();
            
            // AI control in demo mode
            if (this.demoMode) {
                this.updateAI();
            }

            // Update distance and score (slower in demo)
            this.distance += speed;
            this.score = Math.floor(this.distance / 10);

            // Update ground offset for animation
            this.groundOffset = (this.groundOffset + speed) % CONFIG.GROUND_TEXTURE_SIZE;

            // Spawn obstacles (much more obstacles for difficulty)
            const baseSpawnRate = levelConfig.spawnRate * 2.0; // 100% more obstacles (doubled)
            const spawnRate = this.demoMode ? baseSpawnRate * 0.85 : baseSpawnRate;
            if (Math.random() < spawnRate) {
                this.spawnObstacle();
            }

            // Update obstacles
            this.obstacles.forEach(obstacle => obstacle.update(speed));
            this.obstacles = this.obstacles.filter(obstacle => {
                if (obstacle.isOffScreen()) {
                    // Update last obstacle position when obstacle goes off screen
                    const obstacleEndX = obstacle.x + (obstacle.type === 'pit' ? CONFIG.PIT_WIDTH : CONFIG.OBSTACLE_WIDTH);
                    if (obstacleEndX < 0) {
                        this.lastObstacleX = Math.min(this.lastObstacleX, obstacleEndX);
                    }
                    return false;
                }
                return true;
            });

            // Check collisions (skip in demo mode to allow infinite play)
            if (!this.demoMode) {
                this.checkCollisions();
            }

            // Check level complete - use score instead of distance
            const targetScore = 750; // Fixed score target for all levels
            if (this.score >= targetScore) {
                if (this.demoMode) {
                    // In demo mode, automatically go to next level (looping)
                    this.nextLevel();
                } else {
                    this.state = GAME_STATE.LEVEL_COMPLETE;
                }
            }
        } else {
            // Animate ground in menu too (slower)
            this.groundOffset = (this.groundOffset + 1) % CONFIG.GROUND_TEXTURE_SIZE;
        }

        this.frameCount++;
    }

    drawBackground() {
        // Use level 0 (Morning) for menu, or current level for gameplay
        const levelIndex = (this.state === GAME_STATE.MENU) ? 0 : this.currentLevel;
        const levelConfig = LEVELS[levelIndex];
        
        if (!levelConfig) {
            // Fallback if level config is missing
            this.ctx.fillStyle = '#87CEEB';
            this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            return;
        }
        
        // Draw sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, levelConfig.skyColor);
        gradient.addColorStop(1, levelConfig.skyColor2);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Draw stars for night level
        if (levelIndex === 4) {
            this.ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 50; i++) {
                const x = (i * 37) % CONFIG.CANVAS_WIDTH;
                const y = (i * 73) % (CONFIG.CANVAS_HEIGHT / 2);
                const size = (i % 3) + 1;
                this.ctx.fillRect(x, y, size, size);
            }
        }

        // Try to draw background image if available
        const bgImage = this.backgroundImages[levelIndex];
        if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
            this.ctx.drawImage(bgImage, 0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        }
    }

    drawGround() {
        // Use level 0 (Morning) for menu, or current level for gameplay
        const levelIndex = (this.state === GAME_STATE.MENU) ? 0 : this.currentLevel;
        const levelConfig = LEVELS[levelIndex];
        
        if (!levelConfig) {
            // Fallback if level config is missing
            this.ctx.fillStyle = '#8B7355';
            this.ctx.fillRect(0, CONFIG.GROUND_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_Y);
            return;
        }
        
        // Draw ground base color
        this.ctx.fillStyle = levelConfig.groundColor;
        this.ctx.fillRect(0, CONFIG.GROUND_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_Y);
        
        // Draw animated ground texture/pattern (moving lines)
        this.ctx.fillStyle = '#6B5B47';
        const textureSize = CONFIG.GROUND_TEXTURE_SIZE;
        const startX = -this.groundOffset;
        
        for (let i = startX; i < CONFIG.CANVAS_WIDTH + textureSize; i += textureSize) {
            this.ctx.fillRect(i, CONFIG.GROUND_Y, 2, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_Y);
        }
        
        // Draw additional texture lines for depth
        this.ctx.fillStyle = '#5A4A37';
        for (let i = startX + textureSize / 2; i < CONFIG.CANVAS_WIDTH + textureSize; i += textureSize) {
            this.ctx.fillRect(i, CONFIG.GROUND_Y + 10, 1, CONFIG.CANVAS_HEIGHT - CONFIG.GROUND_Y - 10);
        }
    }

    drawUI() {
        const levelConfig = LEVELS[this.currentLevel];
        
        // Level indicator (moved lower on mobile, normal on desktop)
        const uiY = this.isMobile ? 90 : 30; // Even lower on mobile: 90 instead of 60
        const uiY2 = this.isMobile ? 110 : 55; // Even lower on mobile: 110 instead of 80
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = this.isMobile ? 'bold 16px monospace' : 'bold 20px monospace';
        this.ctx.fillText(`Level: ${this.currentLevel + 1}/5`, 10, uiY);
        this.ctx.font = this.isMobile ? '14px monospace' : '18px monospace';
        this.ctx.fillText(levelConfig.name, 10, uiY2);

        // Score (moved lower on mobile, normal on desktop)
        this.ctx.font = this.isMobile ? 'bold 16px monospace' : 'bold 20px monospace';
        const scoreText = `Score: ${this.score}`;
        const scoreWidth = this.ctx.measureText(scoreText).width;
        this.ctx.fillText(scoreText, CONFIG.CANVAS_WIDTH - scoreWidth - 10, uiY);
        
        // Pause button (under Score)
        const pauseY = uiY + (this.isMobile ? 20 : 25);
        const pauseSize = this.isMobile ? 20 : 24;
        const pauseX = CONFIG.CANVAS_WIDTH - scoreWidth - 10;
        
        // Draw pause button (two vertical bars)
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(pauseX - pauseSize - 5, pauseY - pauseSize / 2, pauseSize / 3, pauseSize);
        this.ctx.fillRect(pauseX - pauseSize - 5 + pauseSize / 2, pauseY - pauseSize / 2, pauseSize / 3, pauseSize);
        
        // Store pause button bounds for click detection
        this.pauseButtonBounds = {
            x: pauseX - pauseSize - 5,
            y: pauseY - pauseSize / 2,
            width: pauseSize,
            height: pauseSize
        };
        
        // Lives display
        const livesY = this.isMobile ? 130 : 80;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = this.isMobile ? '14px monospace' : '16px monospace';
        this.ctx.fillText('Lives:', 10, livesY);
        
        // Draw hearts for lives (positioned right after "Lives:" text)
        const heartSize = this.isMobile ? 12 : 14;
        const heartSpacing = heartSize + 4;
        const livesTextWidth = this.ctx.measureText('Lives:').width;
        const heartsStartX = 10 + livesTextWidth + 8; // Right after "Lives:" with spacing
        
        for (let i = 0; i < 3; i++) { // 3 lives total
            const heartX = heartsStartX + (i * heartSpacing);
            if (i < this.lives) {
                // Full heart (red)
                this.ctx.fillStyle = '#E74C3C';
            } else {
                // Empty heart (gray)
                this.ctx.fillStyle = '#555555';
            }
            // Draw simple heart shape
            this.drawHeart(this.ctx, heartX, livesY - heartSize / 2, heartSize);
        }
        
        // Demo mode indicator
        if (this.demoMode) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 14px monospace';
            this.ctx.fillText('DEMO MODE', CONFIG.CANVAS_WIDTH / 2 - 60, uiY);
        }

        // Jump charge indicator (when charging) - centered at bottom
        if (this.player && this.player.jumpCharging && this.player.onGround) {
            const chargePercent = this.player.jumpChargePower;
            const barWidth = Math.min(300, CONFIG.CANVAS_WIDTH - 40); // Responsive width
            const barHeight = 18;
            const barX = CONFIG.CANVAS_WIDTH / 2 - barWidth / 2;
            const barY = CONFIG.CANVAS_HEIGHT - 50;

            // Background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

            // Charge bar background
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            // Charge bar fill (green to yellow to red)
            const hue = 120 - (chargePercent * 60); // Green (120) to Yellow (60) to Red (0)
            this.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            this.ctx.fillRect(barX, barY, barWidth * chargePercent, barHeight);

            // Border
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);

            // Text
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('JUMP POWER', CONFIG.CANVAS_WIDTH / 2, barY - 8);
            this.ctx.textAlign = 'left';
        }
    }

    drawMenu() {
        // Draw background first
        this.drawBackground();
        this.drawGround();

        // Title with shadow for visibility (adjusted for vertical)
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Title shadow
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 36px monospace';
        this.ctx.fillText('Krushka', CONFIG.CANVAS_WIDTH / 2 + 2, CONFIG.CANVAS_HEIGHT / 2 - 100 + 2);
        
        // Title
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('Krushka', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 100);
        
        // Subtitle
        this.ctx.font = 'bold 20px monospace';
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText('Knight Rider', CONFIG.CANVAS_WIDTH / 2 + 1, CONFIG.CANVAS_HEIGHT / 2 - 60 + 1);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('Knight Rider', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 60);

        // Instructions (smaller for vertical)
        this.ctx.font = '14px monospace';
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText('Tap or Hold to Jump', CONFIG.CANVAS_WIDTH / 2 + 1, CONFIG.CANVAS_HEIGHT / 2 - 20 + 1);
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.fillText('Tap or Hold to Jump', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 20);
        
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText('Avoid obstacles!', CONFIG.CANVAS_WIDTH / 2 + 1, CONFIG.CANVAS_HEIGHT / 2 + 10 + 1);
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.fillText('Avoid obstacles!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 10);

        // Start button with border (smaller for vertical)
        const btnWidth = Math.min(250, CONFIG.CANVAS_WIDTH - 40);
        const btnHeight = 45;
        const startY = CONFIG.CANVAS_HEIGHT / 2 + 50;
        
        // START GAME button
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(CONFIG.CANVAS_WIDTH / 2 - btnWidth / 2 - 5, startY, btnWidth + 10, btnHeight + 10);
        this.ctx.fillStyle = '#27AE60';
        this.ctx.fillRect(CONFIG.CANVAS_WIDTH / 2 - btnWidth / 2, startY + 5, btnWidth, btnHeight);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 18px monospace';
        this.ctx.fillText('START GAME', CONFIG.CANVAS_WIDTH / 2, startY + 30);
        
        // Show auto-demo hint
        const timeSinceInteraction = (Date.now() - this.lastInteractionTime) / 1000;
        const timeLeft = Math.max(0, 30 - timeSinceInteraction);
        if (timeLeft > 0 && timeLeft < 30) {
            this.ctx.font = '12px monospace';
            this.ctx.fillStyle = '#888888';
            this.ctx.fillText(`Demo starts in ${Math.ceil(timeLeft)}s`, CONFIG.CANVAS_WIDTH / 2, startY + btnHeight + 30);
        }

        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
    }

    drawLevelComplete() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 28px monospace';
        this.ctx.textAlign = 'center';
        
        if (this.currentLevel < LEVELS.length - 1) {
            this.ctx.fillText(`Level ${this.currentLevel + 1} Complete!`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 60);
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`Score: ${this.score} / 750`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 20);
            this.ctx.font = '16px monospace';
            this.ctx.fillText('Tap for Next Level', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 20);
        }

        this.ctx.textAlign = 'left';
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        this.ctx.fillStyle = '#E74C3C';
        this.ctx.font = 'bold 28px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Game Over!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 60);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '20px monospace';
        this.ctx.fillText(`Final Score: ${this.score}`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 20);
        this.ctx.font = '16px monospace';
        this.ctx.fillText('Tap to Restart', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 20);

        this.ctx.textAlign = 'left';
    }

    drawAllComplete() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        this.ctx.fillStyle = '#F39C12';
        this.ctx.font = 'bold 28px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Congratulations!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 80);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '18px monospace';
        this.ctx.fillText('You finished all 5 levels!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 40);
        this.ctx.font = '20px monospace';
        this.ctx.fillText(`Final Score: ${this.score}`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
        this.ctx.font = '16px monospace';
        this.ctx.fillText('Tap to Restart', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 40);

        this.ctx.textAlign = 'left';
    }

    draw() {
        // Ensure canvas has proper size
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            this.canvas.width = CONFIG.CANVAS_WIDTH;
            this.canvas.height = CONFIG.CANVAS_HEIGHT;
        }
        
        // Clear canvas with a background color first
        this.ctx.fillStyle = '#87CEEB'; // Light blue fallback
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        if (this.state === GAME_STATE.MENU) {
            this.drawMenu();
        } else if (this.state === GAME_STATE.PLAYING) {
            this.drawBackground();
            this.drawGround();
            this.obstacles.forEach(obstacle => obstacle.draw(this.ctx, LEVELS[this.currentLevel]));
            this.player.draw(this.ctx);
            this.drawUI();
        } else if (this.state === GAME_STATE.PAUSED) {
            // Draw game in background when paused
            this.drawBackground();
            this.drawGround();
            this.obstacles.forEach(obstacle => obstacle.draw(this.ctx, LEVELS[this.currentLevel]));
            this.player.draw(this.ctx);
            this.drawUI();
            this.drawPauseScreen();
        } else if (this.state === GAME_STATE.LEVEL_COMPLETE) {
            this.drawBackground();
            this.drawGround();
            this.player.draw(this.ctx);
            this.drawLevelComplete();
        } else if (this.state === GAME_STATE.GAME_OVER) {
            this.drawBackground();
            this.drawGround();
            this.obstacles.forEach(obstacle => obstacle.draw(this.ctx, LEVELS[this.currentLevel]));
            this.player.draw(this.ctx);
            this.drawGameOver();
        } else if (this.state === GAME_STATE.ALL_COMPLETE) {
            this.drawAllComplete();
        }
    }
    
    drawPauseScreen() {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        // Pause text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 36px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 20);
        
        this.ctx.font = '18px monospace';
        this.ctx.fillText('Tap to Resume', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 20);
        
        this.ctx.textAlign = 'left';
    }

    gameLoop() {
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
}

// ==================== ORIENTATION LOCK ====================
// Lock orientation to portrait
function lockOrientation() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(() => {
            // Lock failed, but continue anyway
        });
    } else if (screen.lockOrientation) {
        screen.lockOrientation('portrait');
    } else if (screen.mozLockOrientation) {
        screen.mozLockOrientation('portrait');
    } else if (screen.msLockOrientation) {
        screen.msLockOrientation('portrait');
    }
}

// Try to lock orientation on load
window.addEventListener('DOMContentLoaded', () => {
    lockOrientation();
    
    // Also try on orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(lockOrientation, 100);
    });
});

// ==================== INITIALIZE GAME ====================
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element with id "game-canvas" not found!');
        return;
    }
    
    try {
        const game = new Game(canvas);
        console.log('Game initialized successfully');
    } catch (error) {
        console.error('Error initializing game:', error);
    }
});

