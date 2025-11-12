import { useEffect, useRef } from "react";

/**
 * PUBLIC_INTERFACE
 * GameCanvas
 * A canvas-based mini game loop rendering a player with clouds, stars, and storms.
 * - Press Space to jump. AI controls storms and wind.
 * - This component sets up requestAnimationFrame and keyboard listeners with cleanup.
 */
export default function GameCanvas({ onScore }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const windTimeoutRef = useRef(null);
  const flashTimeoutRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // ----- PLAYER -----
    const player = {
      x: 100,
      y: 250,
      size: 30,
      vy: 0,
      gravity: 0.8,
      jumpPower: -12,
      grounded: true,
    };

    // ----- ENVIRONMENT -----
    let stars = [];
    let clouds = [];
    let storms = [];
    let windForce = 0;

    // visual feedback flag for star collection flash
    let flashAlpha = 0;

    // create background gradient
    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#c0e8ff");
      grad.addColorStop(1, "#f5f7ff");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // draw clouds
    function drawClouds() {
      ctx.fillStyle = "#fff";
      clouds.forEach((c) => {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
        ctx.fill();
        c.x -= c.speed;
        if (c.x + c.w < 0) c.x = W + Math.random() * 200;
      });
    }

    // draw stars
    function drawStars() {
      ctx.fillStyle = "#ffdf5d";
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

    // draw player
    function drawPlayer() {
      ctx.fillStyle = "#ff7f7f";
      ctx.fillRect(player.x, player.y, player.size, player.size);
    }

    // draw storms
    function drawStorms() {
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

    // AABB (player rect) vs circle (star) collision detection
    function rectCircleColliding(px, py, pw, ph, cx, cy, r) {
      const closestX = Math.max(px, Math.min(cx, px + pw));
      const closestY = Math.max(py, Math.min(cy, py + ph));
      const dx = cx - closestX;
      const dy = cy - closestY;
      return dx * dx + dy * dy <= r * r;
    }

    // Handle player-star collisions: increment score and respawn star
    function handleStarCollisions() {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (rectCircleColliding(player.x, player.y, player.size, player.size, s.x, s.y, s.r)) {
          // callback to parent to increment score
          if (typeof onScore === "function") {
            onScore(1);
          }
          // flash effect
          flashAlpha = 0.35;
          if (flashTimeoutRef.current) {
            clearTimeout(flashTimeoutRef.current);
          }
          // decay flash quickly
          flashTimeoutRef.current = setTimeout(() => {
            flashAlpha = 0;
            flashTimeoutRef.current = null;
          }, 120);

          // respawn star offscreen right with new height
          s.x = W + 40 + Math.random() * 200;
          s.y = 80 + Math.random() * 200;
        }
      }
    }

    // render a subtle screen flash overlay to indicate collection
    function drawFlashOverlay() {
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(245, 158, 11, ${flashAlpha})`; // Ocean Professional amber accent
        ctx.fillRect(0, 0, W, H);
        // soft decay over frames
        flashAlpha = Math.max(0, flashAlpha - 0.04);
      }
    }

    // ----- COMPUTER-CONTROLLED WEATHER (AI EVENTS) -----
    function computerControl() {
      // Randomly create new storms
      if (Math.random() < 0.01 && storms.length < 3) {
        storms.push({ x: W, y: 100 + Math.random() * 100, speed: 2 });
      }

      // Random wind gusts
      if (Math.random() < 0.002) {
        windForce = (Math.random() - 0.5) * 2; // push left/right
        // Clear any previous timeout before setting a new one.
        if (windTimeoutRef.current) {
          clearTimeout(windTimeoutRef.current);
        }
        windTimeoutRef.current = setTimeout(() => {
          windForce = 0;
          windTimeoutRef.current = null;
        }, 2000);
      }
    }

    // ----- GAME LOOP -----
    function update() {
      ctx.clearRect(0, 0, W, H);
      drawBackground();

      computerControl(); // AI creates storms & wind
      drawClouds();
      drawStars();
      drawStorms();

      // Apply gravity + wind to player
      player.vy += player.gravity;
      player.y += player.vy;
      player.x += windForce;

      // ground
      if (player.y + player.size > 280) {
        player.y = 280 - player.size;
        player.vy = 0;
        player.grounded = true;
      }

      // star collisions (+score + respawn)
      handleStarCollisions();

      drawPlayer();

      // overlay flash for collection feedback
      drawFlashOverlay();

      rafRef.current = requestAnimationFrame(update);
    }

    // ----- INPUT: JUMP -----
    const onKeyDown = (e) => {
      if (e.code === "Space" && player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);

    // Initial setup
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: i * 100,
        y: 220 + Math.random() * 30,
        w: 50,
        h: 20,
        speed: 0.5,
      });
    }
    for (let i = 0; i < 10; i++) {
      stars.push({
        x: i * 80 + 100,
        y: 100 + Math.random() * 100,
        r: 5,
        speed: 1.5,
      });
    }

    update();

    // Cleanup on unmount
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (windTimeoutRef.current) {
        clearTimeout(windTimeoutRef.current);
        windTimeoutRef.current = null;
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
      // Clear references
      stars = [];
      clouds = [];
      storms = [];
    };
  }, [onScore]);

  return (
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
  );
}
