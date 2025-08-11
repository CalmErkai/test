'use strict';

(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const GAME_WIDTH = canvas.width;   // logical width (CSS may scale)
  const GAME_HEIGHT = canvas.height; // logical height (CSS may scale)

  const KEY = {
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight',
    A: 'a',
    D: 'd',
    SPACE: ' ', // Space
    ENTER: 'Enter',
  };

  const GAME_STATE = {
    MENU: 'MENU',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER',
    WON: 'WON',
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getRowColors(rowCount) {
    const palette = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#a26bff', '#f72585', '#ff9f1c'];
    return new Array(rowCount).fill(0).map((_, i) => palette[i % palette.length]);
  }

  class Input {
    constructor() {
      this.leftPressed = false;
      this.rightPressed = false;
      this.onTogglePause = null;
      this.onStartOrRestart = null;

      window.addEventListener('keydown', (e) => this.#handleKeyDown(e));
      window.addEventListener('keyup', (e) => this.#handleKeyUp(e));
    }

    #handleKeyDown(e) {
      if (e.repeat) return;
      switch (e.key) {
        case KEY.LEFT:
        case KEY.A:
          this.leftPressed = true;
          break;
        case KEY.RIGHT:
        case KEY.D:
          this.rightPressed = true;
          break;
        case KEY.SPACE:
          if (this.onTogglePause) this.onTogglePause();
          break;
        case KEY.ENTER:
          if (this.onStartOrRestart) this.onStartOrRestart();
          break;
      }
    }

    #handleKeyUp(e) {
      switch (e.key) {
        case KEY.LEFT:
        case KEY.A:
          this.leftPressed = false;
          break;
        case KEY.RIGHT:
        case KEY.D:
          this.rightPressed = false;
          break;
      }
    }
  }

  class Paddle {
    constructor(gameWidth, gameHeight) {
      this.gameWidth = gameWidth;
      this.gameHeight = gameHeight;
      this.width = 110;
      this.height = 14;
      this.maxSpeed = 420; // px/s
      this.position = { x: (gameWidth - this.width) / 2, y: gameHeight - this.height - 24 };
      this.velocityX = 0;
    }

    moveLeft() { this.velocityX = -this.maxSpeed; }
    moveRight() { this.velocityX = this.maxSpeed; }
    stop() { this.velocityX = 0; }

    update(dt, input) {
      if (input.leftPressed && !input.rightPressed) this.moveLeft();
      else if (input.rightPressed && !input.leftPressed) this.moveRight();
      else this.stop();

      this.position.x += this.velocityX * dt;
      this.position.x = clamp(this.position.x, 0, this.gameWidth - this.width);
    }

    draw(ctx) {
      ctx.save();
      const radius = 7;
      ctx.fillStyle = '#e5e7eb';
      roundRect(ctx, this.position.x, this.position.y, this.width, this.height, radius);
      ctx.fill();
      ctx.restore();
    }
  }

  class Ball {
    constructor(gameWidth, gameHeight, paddle) {
      this.gameWidth = gameWidth;
      this.gameHeight = gameHeight;
      this.paddle = paddle;
      this.radius = 8;
      this.baseSpeed = 360; // px/s
      this.speedMultiplier = 1;
      this.reset();
    }

    reset() {
      this.position = { x: this.paddle.position.x + this.paddle.width / 2, y: this.paddle.position.y - this.radius - 2 };
      const angle = (-Math.PI / 3) + Math.random() * (Math.PI / 6); // upward angle between -60° and -30°
      const speed = this.baseSpeed * this.speedMultiplier;
      this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    }

    increaseDifficulty(level) {
      this.speedMultiplier = 1 + Math.min(level - 1, 4) * 0.12;
      const dir = Math.sign(this.velocity.x) || 1;
      const speed = this.baseSpeed * this.speedMultiplier;
      const angle = Math.atan2(this.velocity.y, this.velocity.x);
      this.velocity.x = Math.cos(angle) * speed * dir;
      this.velocity.y = Math.sin(angle) * speed;
    }

    update(dt) {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      // Wall collisions
      if (this.position.x - this.radius <= 0) {
        this.position.x = this.radius;
        this.velocity.x *= -1;
      }
      if (this.position.x + this.radius >= this.gameWidth) {
        this.position.x = this.gameWidth - this.radius;
        this.velocity.x *= -1;
      }
      if (this.position.y - this.radius <= 0) {
        this.position.y = this.radius;
        this.velocity.y *= -1;
      }

      // Paddle collision
      const p = this.paddle;
      if (circleIntersectsRect(this.position.x, this.position.y, this.radius, p.position.x, p.position.y, p.width, p.height) && this.velocity.y > 0) {
        this.position.y = p.position.y - this.radius - 0.01;
        // Reflect with angle based on where the ball hits the paddle
        const hitPoint = (this.position.x - (p.position.x + p.width / 2)) / (p.width / 2); // -1..1
        const maxBounceAngle = (5 * Math.PI) / 12; // 75 degrees
        const bounceAngle = hitPoint * maxBounceAngle;
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        this.velocity.x = speed * Math.sin(bounceAngle);
        this.velocity.y = -Math.abs(speed * Math.cos(bounceAngle));
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Brick {
    constructor(x, y, width, height, color) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.color = color;
      this.alive = true;
    }

    draw(ctx) {
      if (!this.alive) return;
      ctx.save();
      ctx.fillStyle = this.color;
      roundRect(ctx, this.x, this.y, this.width, this.height, 6);
      ctx.fill();
      ctx.restore();
    }
  }

  class BrickField {
    constructor(gameWidth, gameHeight) {
      this.gameWidth = gameWidth;
      this.gameHeight = gameHeight;
      this.columns = 10;
      this.rows = 6;
      this.padding = 10;
      this.offsetTop = 70;
      this.offsetLeft = 30;
      this.brickHeight = 22;
      this.brickWidth = 0; // computed in build
      this.bricks = [];
      this.rowColors = getRowColors(this.rows);
      this.remaining = 0;
      this.build();
    }

    build() {
      this.bricks = [];
      this.brickWidth = (this.gameWidth - 2 * this.offsetLeft - (this.columns - 1) * this.padding) / this.columns;
      this.remaining = this.rows * this.columns;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.columns; c++) {
          const x = this.offsetLeft + c * (this.brickWidth + this.padding);
          const y = this.offsetTop + r * (this.brickHeight + this.padding);
          const brick = new Brick(x, y, this.brickWidth, this.brickHeight, this.rowColors[r % this.rowColors.length]);
          this.bricks.push(brick);
        }
      }
    }

    handleBallCollision(ball, onBrickDestroyed) {
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (circleIntersectsRect(ball.position.x, ball.position.y, ball.radius, brick.x, brick.y, brick.width, brick.height)) {
          brick.alive = false;
          this.remaining -= 1;
          // Reflect: choose axis based on which penetration is smaller
          const prevX = ball.position.x - ball.velocity.x * (1/60); // rough previous
          const prevY = ball.position.y - ball.velocity.y * (1/60);
          const hitFromLeftOrRight = prevY >= brick.y && prevY <= brick.y + brick.height;
          if (hitFromLeftOrRight) ball.velocity.x *= -1; else ball.velocity.y *= -1;
          if (onBrickDestroyed) onBrickDestroyed();
          break;
        }
      }
    }

    draw(ctx) {
      for (const brick of this.bricks) brick.draw(ctx);
    }
  }

  class Game {
    constructor() {
      this.input = new Input();
      this.state = GAME_STATE.MENU;
      this.score = 0;
      this.lives = 3;
      this.level = 1;
      this.paddle = new Paddle(GAME_WIDTH, GAME_HEIGHT);
      this.ball = new Ball(GAME_WIDTH, GAME_HEIGHT, this.paddle);
      this.bricks = new BrickField(GAME_WIDTH, GAME_HEIGHT);
      this.lastTimestamp = 0;
      this.accumulator = 0;
      this.fixedDt = 1 / 120; // fixed update for stable collisions

      this.input.onTogglePause = () => this.togglePauseOrStart();
      this.input.onStartOrRestart = () => this.startOrRestart();

      requestAnimationFrame((ts) => this.loop(ts));
    }

    resetForNewLevel() {
      this.bricks = new BrickField(GAME_WIDTH, GAME_HEIGHT);
      this.paddle = new Paddle(GAME_WIDTH, GAME_HEIGHT);
      this.ball = new Ball(GAME_WIDTH, GAME_HEIGHT, this.paddle);
      this.ball.increaseDifficulty(this.level);
    }

    startOrRestart() {
      if (this.state === GAME_STATE.MENU || this.state === GAME_STATE.WON) {
        this.state = GAME_STATE.RUNNING;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.resetForNewLevel();
      } else if (this.state === GAME_STATE.GAMEOVER) {
        this.state = GAME_STATE.MENU;
      }
    }

    togglePauseOrStart() {
      if (this.state === GAME_STATE.MENU) {
        this.state = GAME_STATE.RUNNING;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.resetForNewLevel();
        return;
      }
      if (this.state === GAME_STATE.RUNNING) {
        this.state = GAME_STATE.PAUSED;
      } else if (this.state === GAME_STATE.PAUSED) {
        this.state = GAME_STATE.RUNNING;
      } else if (this.state === GAME_STATE.WON || this.state === GAME_STATE.GAMEOVER) {
        // Do nothing. Use Enter to restart to MENU
      }
    }

    update(dt) {
      if (this.state !== GAME_STATE.RUNNING) return;

      this.paddle.update(dt, this.input);
      this.ball.update(dt);

      // Bottom out: lose life
      if (this.ball.position.y - this.ball.radius > GAME_HEIGHT) {
        this.lives -= 1;
        if (this.lives <= 0) {
          this.state = GAME_STATE.GAMEOVER;
        } else {
          this.ball.reset();
          this.paddle.position.x = (GAME_WIDTH - this.paddle.width) / 2;
        }
      }

      // Bricks
      this.bricks.handleBallCollision(this.ball, () => {
        this.score += 10;
      });

      if (this.bricks.remaining === 0) {
        this.level += 1;
        if (this.level > 5) {
          this.state = GAME_STATE.WON;
        } else {
          this.resetForNewLevel();
        }
      }
    }

    drawHUD(ctx) {
      ctx.save();
      ctx.font = '16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillStyle = 'rgba(230, 230, 230, 0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(`分数: ${this.score}`, 16, 24);
      ctx.fillText(`生命: ${this.lives}`, 16, 46);
      ctx.textAlign = 'right';
      ctx.fillText(`等级: ${this.level}`, GAME_WIDTH - 16, 24);
      ctx.restore();
    }

    drawOverlay(ctx) {
      if (this.state === GAME_STATE.RUNNING) return;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      const titleFont = 'bold 32px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
      const smallFont = '16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';

      if (this.state === GAME_STATE.MENU) {
        ctx.font = titleFont;
        ctx.fillText('打砖块 Brick Breaker', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
        ctx.font = smallFont;
        ctx.fillText('空格开始/暂停，方向键或 A/D 移动挡板', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10);
        ctx.fillText('回车在游戏结束或胜利后返回菜单', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 34);
      } else if (this.state === GAME_STATE.PAUSED) {
        ctx.font = titleFont;
        ctx.fillText('暂停', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        ctx.font = smallFont;
        ctx.fillText('按空格继续', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28);
      } else if (this.state === GAME_STATE.GAMEOVER) {
        ctx.font = titleFont;
        ctx.fillText('游戏结束', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        ctx.font = smallFont;
        ctx.fillText('按回车返回菜单', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28);
      } else if (this.state === GAME_STATE.WON) {
        ctx.font = titleFont;
        ctx.fillText('你赢了！', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        ctx.font = smallFont;
        ctx.fillText('按回车返回菜单', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28);
      }

      ctx.restore();
    }

    loop(timestamp) {
      const delta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      // Fixed update steps for stability
      this.accumulator += Math.min(delta, 0.1);
      while (this.accumulator >= this.fixedDt) {
        this.update(this.fixedDt);
        this.accumulator -= this.fixedDt;
      }

      // Render
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.bricks.draw(ctx);
      this.paddle.draw(ctx);
      this.ball.draw(ctx);
      this.drawHUD(ctx);
      this.drawOverlay(ctx);

      requestAnimationFrame((ts) => this.loop(ts));
    }
  }

  // Utilities
  function circleIntersectsRect(cx, cy, radius, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  // Fit canvas in container while keeping logical resolution
  function fitCanvasToContainer() {
    // No-op: CSS handles scaling via width/height 100% inside aspect-ratio container
  }

  window.addEventListener('resize', fitCanvasToContainer);
  fitCanvasToContainer();

  // Start the game instance
  new Game();
})();