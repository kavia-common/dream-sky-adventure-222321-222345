import React, { useEffect, useRef, useState } from "react";
import bgImgSrc from "../assets/bg.png";
import playerImgSrc from "../assets/player.png";
import starImgSrc from "../assets/star.png";
import cloudImgSrc from "../assets/cloud.png";
import stormImgSrc from "../assets/storm.png";

/**
 * PUBLIC_INTERFACE
 * GameCanvas (stub)
 * Minimal canvas game loop that imports assets and renders:
 * - Stretched background
 * - Movable player (arrow keys)
 * - Drifting clouds
 * - Stars as collectibles (visual only here)
 * Assets are imported so future swaps don't require code changes.
 */
export default function GameCanvas({ onScore }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // keyboard state
  const pressed = useRef(new Set());

  // simple state
  const [ready, setReady] = useState(false);

  // entities
  const player = useRef({ x: 100, y: 220, w: 28, h: 28, speed: 2.6 });
  const starsRef = useRef([]);
  const cloudsRef = useRef([]);

  // load images via imports
  const imagesRef = useRef({
    bg: new Image(),
    player: new Image(),
    star: new Image(),
    cloud: new Image(),
    storm: new Image(),
  });

  useEffect(() => {
    const imgs = imagesRef.current;
    let loaded = 0;
    const ALL = 5;

    const onload = () => {
      loaded += 1;
      if (loaded >= ALL) setReady(true);
    };

    imgs.bg.onload = onload;
    imgs.player.onload = onload;
    imgs.star.onload = onload;
    imgs.cloud.onload = onload;
    imgs.storm.onload = onload;

    imgs.bg.src = bgImgSrc;
    imgs.player.src = playerImgSrc;
    imgs.star.src = starImgSrc;
    imgs.cloud.src = cloudImgSrc;
    imgs.storm.src = stormImgSrc;

    return () => {
      // no cleanup needed for images
    };
  }, []);

  // init entities after canvas mounted
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const W = c.width;
    // stars
    starsRef.current = Array.from({ length: 8 }).map((_, i) => ({
      x: 80 + i * 70,
      y: 90 + Math.random() * 120,
      speed: 1.2 + Math.random() * 0.5,
    }));

    // clouds
    cloudsRef.current = Array.from({ length: 6 }).map((_, i) => ({
      x: i * 110,
      y: 40 + Math.random() * 70,
      speed: 0.4 + Math.random() * 0.3,
    }));

    // clamp player range
    player.current.maxX = W - player.current.w;
    player.current.minX = 0;
  }, []);

  // keyboard input
  useEffect(() => {
    const down = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        pressed.current.add(e.key);
      }
    };
    const up = (e) => {
      if (pressed.current.has(e.key)) pressed.current.delete(e.key);
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // main loop
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const { bg, player: playerImg, star, cloud, storm } = imagesRef.current;

    const update = () => {
      const W = c.width;
      const H = c.height;

      // draw bg stretched
      if (bg && bg.complete) {
        ctx.drawImage(bg, 0, 0, W, H);
      } else {
        // fallback gradient if not ready yet
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#c0e8ff");
        g.addColorStop(1, "#f5f7ff");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // clouds drift
      cloudsRef.current.forEach((cl) => {
        const y = cl.y;
        if (cloud && cloud.complete) {
          ctx.drawImage(cloud, cl.x, y, 48, 24);
        } else {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.ellipse(cl.x + 24, y + 12, 24, 12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        cl.x -= cl.speed;
        if (cl.x < -60) cl.x = W + Math.random() * 120;
      });

      // stars drift
      starsRef.current.forEach((s) => {
        const y = s.y;
        if (star && star.complete) {
          ctx.drawImage(star, s.x, y, 18, 18);
        } else {
          ctx.fillStyle = "#ffdf5d";
          ctx.beginPath();
          ctx.arc(s.x + 9, y + 9, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        s.x -= s.speed;
        if (s.x < -20) {
          s.x = W + Math.random() * 100;
          s.y = 90 + Math.random() * 120;
          if (typeof onScore === "function") onScore(1); // simple scoring tick
        }
      });

      // player control
      const p = player.current;
      if (pressed.current.has("ArrowLeft")) p.x -= p.speed;
      if (pressed.current.has("ArrowRight")) p.x += p.speed;
      if (pressed.current.has("ArrowUp")) p.y -= p.speed;
      if (pressed.current.has("ArrowDown")) p.y += p.speed;

      // clamps
      p.x = Math.max(p.minX ?? 0, Math.min(p.maxX ?? W - p.w, p.x));
      p.y = Math.max(60, Math.min(H - p.h - 10, p.y));

      // draw player
      if (playerImg && playerImg.complete) {
        ctx.drawImage(playerImg, p.x, p.y, p.w, p.h);
      } else {
        ctx.fillStyle = "#ff7f7f";
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }

      // simple storm preview element at top-right
      const sx = W - 60;
      const sy = 20;
      if (storm && storm.complete) {
        ctx.drawImage(storm, sx, sy, 40, 24);
      } else {
        ctx.fillStyle = "#777";
        ctx.beginPath();
        ctx.ellipse(sx + 20, sy + 12, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(update);
    };

    update();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, onScore]);

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
          zIndex: 3,
        }}
      >
        Use Arrow keys to move
      </div>
    </div>
  );
}
