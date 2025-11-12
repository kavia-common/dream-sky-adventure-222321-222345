import React, { useEffect, useRef, useState } from "react";
import bgImgSrc from "../assets/bg.png";
import playerImgSrc from "../assets/player.png";
import starImgSrc from "../assets/star.png";
import cloudImgSrc from "../assets/cloud.png";
import stormImgSrc from "../assets/storm.png";

/**
 * PUBLIC_INTERFACE
 * GameCanvas
 * Robust 2D canvas loop with safe image preloading.
 *
 * - Preloads images with onload/onerror and Promise.allSettled
 * - Starts render loop only after preload settles
 * - Guards all drawImage calls against broken images (complete && naturalWidth > 0)
 * - Provides canvas-based fallbacks if assets fail to load
 * - Animated background, movable player, drifting clouds and stars
 */
export default function GameCanvas({ onScore }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // keyboard state
  const pressed = useRef(new Set());

  // loading and asset state
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // entities
  const player = useRef({ x: 100, y: 220, w: 28, h: 28, speed: 2.6 });
  const starsRef = useRef([]);
  const cloudsRef = useRef([]);

  // images store with status flags
  const imagesRef = useRef({
    bg: { img: new Image(), ok: false },
    player: { img: new Image(), ok: false },
    star: { img: new Image(), ok: false },
    cloud: { img: new Image(), ok: false },
    storm: { img: new Image(), ok: false },
  });

  // Helper: load one image with robust resolve
  const loadImage = (img, src) =>
    new Promise((resolve) => {
      let settled = false;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (settled) return;
        settled = true;
        resolve({ ok: true, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, width: 0, height: 0 });
      };
      img.src = src;
      // Safety timeout: if neither load nor error fires (rare), resolve as failed
      setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({ ok: false, width: 0, height: 0 });
        }
      }, 8000);
    });

  // Preload images up front, gate the loop start
  useEffect(() => {
    const { bg, player, star, cloud, storm } = imagesRef.current;
    const tasks = [
      loadImage(bg.img, bgImgSrc).then((r) => (bg.ok = r.ok)),
      loadImage(player.img, playerImgSrc).then((r) => (player.ok = r.ok)),
      loadImage(star.img, starImgSrc).then((r) => (star.ok = r.ok)),
      loadImage(cloud.img, cloudImgSrc).then((r) => (cloud.ok = r.ok)),
      loadImage(storm.img, stormImgSrc).then((r) => (storm.ok = r.ok)),
    ];
    Promise.allSettled(tasks).then(() => setAssetsLoaded(true));
    return () => {
      // No special cleanup for image elements
    };
  }, []);

  // init entities after canvas mounted
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const W = c.width;
    const H = c.height;

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

    // clamp vertical based on canvas
    player.current.y = Math.max(60, Math.min(H - player.current.h - 10, player.current.y));
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

  // Validate an image is safe to draw
  const canDraw = (imgObj) => {
    if (!imgObj || !imgObj.img) return false;
    const { img, ok } = imgObj;
    // ok flag from loader plus DOM properties
    return (
      ok === true &&
      img instanceof HTMLImageElement &&
      img.complete === true &&
      typeof img.naturalWidth === "number" &&
      img.naturalWidth > 0
    );
    // if false, we will use fallbacks
  };

  // draw background gradient fallback
  const drawBgFallback = (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#c0e8ff");
    g.addColorStop(1, "#f5f7ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  // main loop: starts only after assets have loaded/settled
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // Guard: wait until assetsLoaded to begin RAF
    if (!assetsLoaded) return;

    const { bg, player: playerImg, star, cloud, storm } = imagesRef.current;

    const update = () => {
      const W = c.width;
      const H = c.height;
      ctx.clearRect(0, 0, W, H);

      // draw bg stretched or fallback
      if (canDraw(bg)) {
        try {
          ctx.drawImage(bg.img, 0, 0, W, H);
        } catch {
          drawBgFallback(ctx, W, H);
        }
      } else {
        drawBgFallback(ctx, W, H);
      }

      // clouds drift
      cloudsRef.current.forEach((cl) => {
        const y = cl.y;
        if (canDraw(cloud)) {
          try {
            ctx.drawImage(cloud.img, cl.x, y, 48, 24);
          } catch {
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.ellipse(cl.x + 24, y + 12, 24, 12, 0, 0, Math.PI * 2);
            ctx.fill();
          }
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
        if (canDraw(star)) {
          try {
            ctx.drawImage(star.img, s.x, y, 18, 18);
          } catch {
            ctx.fillStyle = "#ffdf5d";
            ctx.beginPath();
            ctx.arc(s.x + 9, y + 9, 8, 0, Math.PI * 2);
            ctx.fill();
          }
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
          if (typeof onScore === "function") onScore(1); // scoring tick
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
      if (canDraw(playerImg)) {
        try {
          ctx.drawImage(playerImg.img, p.x, p.y, p.w, p.h);
        } catch {
          ctx.fillStyle = "#ff7f7f";
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }
      } else {
        ctx.fillStyle = "#ff7f7f";
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }

      // simple storm preview element at top-right
      const sx = W - 60;
      const sy = 20;
      if (canDraw(storm)) {
        try {
          ctx.drawImage(storm.img, sx, sy, 40, 24);
        } catch {
          ctx.fillStyle = "#777";
          ctx.beginPath();
          ctx.ellipse(sx + 20, sy + 12, 20, 12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#777";
        ctx.beginPath();
        ctx.ellipse(sx + 20, sy + 12, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(update);
    };

    // Kick off loop only after assetsLoaded
    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [assetsLoaded, onScore]);

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
      {!assetsLoaded && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            color: "#111827",
            background: "rgba(17,24,39,0.06)",
            padding: "6px 8px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 3,
          }}
        >
          Loading assets…
        </div>
      )}
    </div>
  );
}
