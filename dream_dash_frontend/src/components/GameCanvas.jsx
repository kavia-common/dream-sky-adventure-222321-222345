import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 * PUBLIC_INTERFACE
 * GameCanvas
 * Full user-provided implementation:
 * - State: gameOver, level, score, lives, starsCollected, nextLevelAt
 * - Controls: Arrow keys, continuous movement, R to restart
 * - AI environment: storms, wind, clouds
 * - Collisions: storms (damage), stars (collect to progress)
 * - HUD with score, level, lives, and game over overlay
 * - Proper event listener and timer cleanup
 */
export default function GameCanvas({ onScore }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Timers/timeouts refs for cleanup
  const windTimeoutRef = useRef(null);
  const flashTimeoutRef = useRef(null);
  const stormHitCooldownRef = useRef(null);

  // Game state
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [starsCollected, setStarsCollected] = useState(0);
  const [nextLevelAt, setNextLevelAt] = useState(5);
  const [gameOver, setGameOver] = useState(false);

  // Local effect flags/state
  const pressedRef = useRef(new Set());
  const lastDownImpulseAtRef = useRef(0);
  const canTakeStormDamageRef = useRef(true);

  // World entities
  const starsRef = useRef([]);
  const cloudsRef = useRef([]);
  const stormsRef = useRef([]);

  // Sim variables
  const windForceRef = useRef(0);
  const flashAlphaRef = useRef(0);

  // Player object kept in a ref so it persists across renders without causing re-renders
  const playerRef = useRef({
    x: 100,
    y: 250,
    size: 30,
    vy: 0,
    gravity: 0.8,
    jumpPower: -12,
    grounded: true,
    speed: 2.5,
    maxX: 600 - 30, // will update after canvas mount
    minX: 0,
    ceilingY: 10,
  });

  // PUBLIC_INTERFACE
  const restartGame = useCallback(() => {
    // Reset game state
    setScore(0);
    setLevel(1);
    setLives(3);
    setStarsCollected(0);
    setNextLevelAt(5);
    setGameOver(false);

    // Reset world
    starsRef.current = [];
    cloudsRef.current = [];
    stormsRef.current = [];
    windForceRef.current = 0;
    flashAlphaRef.current = 0;

    // Reset inputs and cooldowns
    pressedRef.current.clear();
    canTakeStormDamageRef.current = true;
    if (stormHitCooldownRef.current) {
      clearTimeout(stormHitCooldownRef.current);
      stormHitCooldownRef.current = null;
    }

    // Reset player
    const canvas = canvasRef.current;
    const W = (canvas && canvas.width) || 600;
    playerRef.current = {
      x: 100,
      y: 250,
      size: 30,
      vy: 0,
      gravity: 0.8,
      jumpPower: -12,
      grounded: true,
      speed: 2.5,
      maxX: W - 30,
      minX: 0,
      ceilingY: 10,
    };

    // Reinit entities
    initEntities();
  }, []);

  // Initialize clouds and stars
  const initEntities = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;

    // Clouds
    const clouds = [];
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: i * 100,
        y: 220 + Math.random() * 30,
        w: 50,
        h: 20,
        speed: 0.5,
      });
    }
    cloudsRef.current = clouds;

    // Stars
    const stars = [];
    for (let i = 0; i < 10; i++) {
      stars.push({
        x: i * 80 + 100,
        y: 100 + Math.random() * 100,
        r: 5,
        speed: 1.5,
      });
    }
    starsRef.current = stars;

    // Storms start empty and spawn via AI
    stormsRef.current = [];

    // Reset wind and flash
    windForceRef.current = 0;
    flashAlphaRef.current = 0;
  }, []);

  // Input handlers
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        pressedRef.current.add(e.key);
      }

      if (e.key === "r" || e.key === "R") {
        // Restart when game over, or anytime per request
        restartGame();
        return;
      }

      const player = playerRef.current;
      if (e.key === "ArrowUp") {
        if (player.grounded) {
          player.vy = player.jumpPower;
          player.grounded = false;
        } else {
          player.vy += -0.8;
        }
      }

      if (e.key === "ArrowDown") {
        const now = Date.now();
        if (now - lastDownImpulseAtRef.current > 120) {
          player.vy += 3.2;
          lastDownImpulseAtRef.current = now;
        }
      }
    };

    const onKeyUp = (e) => {
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        if (pressedRef.current.has(e.key)) {
          pressedRef.current.delete(e.key);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [restartGame]);

  // Utility: collision checks
  function rectCircleColliding(px, py, pw, ph, cx, cy, r) {
    const closestX = Math.max(px, Math.min(cx, px + pw));
    const closestY = Math.max(py, Math.min(cy, py + ph));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  function rectRectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // AI computer control
  const computerControl = useCallback((W) => {
    // Spawn new storms occasionally; scale with level slightly
    const maxStorms = Math.min(2 + Math.floor(level / 2), 5);
    if (Math.random() < 0.01 && stormsRef.current.length < maxStorms) {
      stormsRef.current.push({
        x: W,
        y: 80 + Math.random() * 120,
        speed: 1.6 + Math.random() * 0.8 + level * 0.1,
      });
    }

    // Random wind gusts
    if (Math.random() < 0.002) {
      windForceRef.current = (Math.random() - 0.5) * (2 + level * 0.2);
      if (windTimeoutRef.current) clearTimeout(windTimeoutRef.current);
      windTimeoutRef.current = setTimeout(() => {
        windForceRef.current = 0;
        windTimeoutRef.current = null;
      }, 2000);
    }
  }, [level]);

  // Handle star collection
  const handleStarCollisions = useCallback(
    (W) => {
      const player = playerRef.current;
      const stars = starsRef.current;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (
          rectCircleColliding(
            player.x,
            player.y,
            player.size,
            player.size,
            s.x,
            s.y,
            s.r
          )
        ) {
          // Update score and HUD
          setScore((prev) => prev + 1);
          setStarsCollected((prev) => prev + 1);
          if (typeof onScore === "function") {
            onScore(1);
          }

          // Flash effect
          flashAlphaRef.current = 0.35;
          if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = setTimeout(() => {
            flashAlphaRef.current = 0;
            flashTimeoutRef.current = null;
          }, 120);

          // Respawn star
          s.x = W + 40 + Math.random() * 200;
          s.y = 80 + Math.random() * 200;
        }
      }
    },
    [onScore]
  );

  // Handle storm collisions (damage)
  const handleStormCollisions = useCallback(
    (W) => {
      const player = playerRef.current;
      const storms = stormsRef.current;

      for (let i = 0; i < storms.length; i++) {
        const st = storms[i];
        // Storm visual approx: ellipse radius 40x20 -> bounding rect
        const sx = st.x - 40;
        const sy = st.y - 20;
        const sw = 80;
        const sh = 40;

        if (
          rectRectOverlap(player.x, player.y, player.size, player.size, sx, sy, sw, sh)
        ) {
          if (canTakeStormDamageRef.current) {
            setLives((prev) => {
              const next = prev - 1;
              if (next <= 0) {
                // Game over
                setGameOver(true);
              }
              return next;
            });

            // brief i-frames
            canTakeStormDamageRef.current = false;
            stormHitCooldownRef.current = setTimeout(() => {
              canTakeStormDamageRef.current = true;
              stormHitCooldownRef.current = null;
            }, 1000);
          }

          // push player slightly on hit
          player.vy += -2;
          player.x -= 2;
        }
      }
    },
    []
  );

  // Level progression
  useEffect(() => {
    if (starsCollected >= nextLevelAt && !gameOver) {
      setLevel((lv) => lv + 1);
      setNextLevelAt((prev) => prev + 5);
      // increase difficulty by slightly upping star speed and adding another star
      const W = (canvasRef.current && canvasRef.current.width) || 600;
      starsRef.current.forEach((s) => (s.speed += 0.2));
      starsRef.current.push({
        x: W + Math.random() * 120,
        y: 80 + Math.random() * 200,
        r: 5,
        speed: 1.5 + level * 0.1,
      });
    }
  }, [starsCollected, nextLevelAt, gameOver, level]);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    playerRef.current.maxX = W - playerRef.current.size;

    // Draw helpers
    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#c0e8ff");
      grad.addColorStop(1, "#f5f7ff");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    function drawClouds() {
      ctx.fillStyle = "#fff";
      const clouds = cloudsRef.current;
      clouds.forEach((c) => {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
        ctx.fill();
        c.x -= c.speed;
        if (c.x + c.w < 0) c.x = W + Math.random() * 200;
      });
    }

    function drawStars() {
      ctx.fillStyle = "#ffdf5d";
      const stars = starsRef.current;
      stars.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        s.x -= s.speed;
        if (s.x + s.r < 0) {
          s.x = W + Math.random() * 200;
          s.y = 80 + Math.random() * 200;
        }
      });
    }

    function drawPlayer() {
      const p = playerRef.current;
      ctx.fillStyle = "#ff7f7f";
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    function drawStorms() {
      const storms = stormsRef.current;
      storms.forEach((s) => {
        // cloud
        ctx.fillStyle = "#777";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 40, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // lightning flash effect
        if (Math.random() < 0.01) {
          ctx.strokeStyle = "#ffef88";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + (Math.random() * 20 - 10), s.y + 50);
          ctx.stroke();
        }

        s.x -= s.speed;
        if (s.x + 40 < 0) s.x = W + Math.random() * 200;
      });
    }

    function drawFlashOverlay() {
      const alpha = flashAlphaRef.current;
      if (alpha > 0) {
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
        ctx.fillRect(0, 0, W, H);
        flashAlphaRef.current = Math.max(0, alpha - 0.04);
      }
    }

    function drawHUD() {
      ctx.save();
      ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillStyle = "#111827";

      const pill = (text, x, y, colorBg, colorText = "#111827") => {
        ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        const paddingX = 10;
        const paddingY = 6;
        const tm = ctx.measureText(text);
        const w = tm.width + paddingX * 2;
        const h = 24;

        ctx.fillStyle = colorBg;
        ctx.beginPath();
        const r = 12;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();

        ctx.fillStyle = colorText;
        ctx.fillText(text, x + paddingX, y + h - 7);
      };

      pill(`Score: ${score}`, 12, 10, "rgba(37,99,235,0.08)", "#2563EB");
      pill(`Level: ${level}`, 120, 10, "rgba(245,158,11,0.12)", "#F59E0B");
      pill(`Lives: ${lives}`, 220, 10, "rgba(17,24,39,0.08)", "#111827");

      ctx.restore();
    }

    function drawGameOver() {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const title = "Game Over";
      const tm = ctx.measureText(title);
      ctx.fillText(title, W / 2 - tm.width / 2, H / 2 - 10);

      ctx.font = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const tip = "Press R to Restart";
      const tm2 = ctx.measureText(tip);
      ctx.fillText(tip, W / 2 - tm2.width / 2, H / 2 + 20);

      ctx.restore();
    }

    // Ensure entities exist (initial mount or after restart)
    if (starsRef.current.length === 0 && cloudsRef.current.length === 0) {
      initEntities();
    }

    const update = () => {
      ctx.clearRect(0, 0, W, H);
      drawBackground();

      // Draw/update world
      computerControl(W);
      drawClouds();
      drawStars();
      drawStorms();

      const player = playerRef.current;

      // Player movement
      const pressed = pressedRef.current;
      if (pressed.has("ArrowLeft")) player.x -= player.speed;
      if (pressed.has("ArrowRight")) player.x += player.speed;

      // Clamp X
      if (player.x < player.minX) player.x = player.minX;
      if (player.x > player.maxX) player.x = player.maxX;

      // Physics: gravity + wind
      player.vy += player.gravity;
      player.y += player.vy;
      player.x += windForceRef.current;

      // Clamp X after wind
      if (player.x < player.minX) player.x = player.minX;
      if (player.x > player.maxX) player.x = player.maxX;

      // Ceiling
      if (player.y < player.ceilingY) {
        player.y = player.ceilingY;
        if (player.vy < 0) player.vy = 0;
      }

      // Ground
      if (player.y + player.size > 280) {
        player.y = 280 - player.size;
        player.vy = 0;
        player.grounded = true;
      } else {
        player.grounded = false;
      }

      // Collisions
      if (!gameOver) {
        handleStarCollisions(W);
        handleStormCollisions(W);
      }

      // Draw player
      drawPlayer();

      // HUD and flash overlay
      drawFlashOverlay();
      drawHUD();

      if (gameOver) {
        drawGameOver();
      }

      rafRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    gameOver,
    score,
    level,
    lives,
    initEntities,
    computerControl,
    handleStarCollisions,
    handleStormCollisions,
  ]);

  // Cleanup for timers on unmount
  useEffect(() => {
    return () => {
      if (windTimeoutRef.current) {
        clearTimeout(windTimeoutRef.current);
        windTimeoutRef.current = null;
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
      if (stormHitCooldownRef.current) {
        clearTimeout(stormHitCooldownRef.current);
        stormHitCooldownRef.current = null;
      }
      pressedRef.current.clear();
      starsRef.current = [];
      cloudsRef.current = [];
      stormsRef.current = [];
    };
  }, []);

  // PUBLIC_INTERFACE
  return (
    <div style={{ position: "relative", width: 600 }}>
      <canvas
        ref={canvasRef}
        width={600}
        height={330}
        style={{
          display: "block",
          borderRadius: 12,
          boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          background: "#f5f7ff",
        }}
        aria-label="Dream Dash Game Canvas"
        role="img"
      />
      {/* Simple on-canvas HUD is drawn via context; this button enables keyboard hint for accessibility */}
      <div
        aria-live="polite"
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          color: "#2563EB",
          background: "rgba(37,99,235,0.06)",
          padding: "6px 8px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Arrows to move • R to restart
      </div>
    </div>
  );
}
