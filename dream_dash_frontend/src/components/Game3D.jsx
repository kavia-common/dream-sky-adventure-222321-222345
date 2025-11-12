import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars as DreiStars, Float, Html, Text } from "@react-three/drei";

/**
 * PUBLIC_INTERFACE
 * Game3D
 * A fully playable 3D endless runner using @react-three/fiber and @react-three/drei.
 * - Player: capsule that moves with arrow keys (Left/Right strafe, Up jumps, Down quick drop)
 * - Ground: scrolling illusion via moving tiles and far background stars
 * - Collectibles: glowing star meshes; picking them increases score
 * - Obstacles: stormy clouds (dark billboards) move toward the player and cause game over on collision
 * - Wind gusts: random lateral push on the player
 * - Level progression: speed and target increase every N stars; HUD shows level and score
 * - UI overlay: React elements layered over Canvas (score/level/game over/restart)
 * - Restart: press R or click Restart
 * Visual palette follows the Ocean Professional theme (blue/amber accents).
 */

// Global configuration for the runner
const CONFIG = {
  laneWidth: 1.5,
  worldWidth: 8,
  groundZCount: 20,
  groundTileLength: 4, // length along -Z
  baseForwardSpeed: 0.12,
  player: {
    radius: 0.35, // for collision approximation
    height: 1.2,
    jumpVelocity: 0.23,
    gravity: -0.015,
    moveSpeed: 0.12,
    minX: -3,
    maxX: 3,
    startY: 0.6,
  },
  star: {
    count: 14,
    radius: 0.3,
  },
  storm: {
    count: 8,
    size: { x: 1.4, y: 0.8, z: 1.2 }, // AABB half-extents approximation
  },
  wind: {
    chance: 0.002,
    durationMs: 1800,
    maxForce: 0.06,
  },
  colors: {
    primary: "#2563EB",
    secondary: "#F59E0B",
    skyTop: "#bfe3ff",
    skyBottom: "#f8fbff",
    storm: "#5f6470",
    groundA: "#e6f0ff",
    groundB: "#dde9ff",
  },
};

function useKeyboard() {
  const pressed = useRef(new Set());
  useEffect(() => {
    const down = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "r", "R"].includes(e.key)) {
        e.preventDefault();
      }
      pressed.current.add(e.key);
    };
    const up = (e) => {
      pressed.current.delete(e.key);
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  return pressed;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Distance-based collision for sphere (player) vs AABB (storm)
// PUBLIC_INTERFACE
export function sphereAabbIntersect(center, radius, boxCenter, halfSize) {
  /** Sphere vs AABB collision */
  const dx = Math.max(Math.abs(center.x - boxCenter.x) - halfSize.x, 0);
  const dy = Math.max(Math.abs(center.y - boxCenter.y) - halfSize.y, 0);
  const dz = Math.max(Math.abs(center.z - boxCenter.z) - halfSize.z, 0);
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

// PUBLIC_INTERFACE
export default function Game3D({ width = 800, height = 460, onScore }) {
  const keyboard = useKeyboard();

  // Core game state
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState(8); // stars needed to next level
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(CONFIG.baseForwardSpeed);
  const [message, setMessage] = useState("");

  // Player state
  const playerRef = useRef({
    x: 0,
    y: CONFIG.player.startY,
    z: 2,
    vy: 0,
    grounded: true,
  });

  // Wind state
  const windRef = useRef({ force: 0, until: 0 });

  // Stars and storms
  const starsRef = useRef([]);
  const stormsRef = useRef([]);

  // Initialize entities
  const resetEntities = useCallback(() => {
    const randLane = () => (Math.random() * CONFIG.worldWidth - CONFIG.worldWidth / 2) * 0.6;
    // Stars scattered ahead
    starsRef.current = Array.from({ length: CONFIG.star.count }).map((_, i) => ({
      x: randLane(),
      y: 0.8 + Math.random() * 1.1,
      z: -i * 6 - 10 - Math.random() * 6,
      active: true,
    }));
    // Storms approaching
    stormsRef.current = Array.from({ length: CONFIG.storm.count }).map((_, i) => ({
      x: randLane(),
      y: 1.2 + Math.random() * 0.8,
      z: -i * 12 - 20 - Math.random() * 16,
      active: true,
    }));
  }, []);

  const restart = useCallback(() => {
    setLevel(1);
    setScore(0);
    setTarget(8);
    setGameOver(false);
    setSpeed(CONFIG.baseForwardSpeed);
    setMessage("");
    playerRef.current = {
      x: 0,
      y: CONFIG.player.startY,
      z: 2,
      vy: 0,
      grounded: true,
    };
    windRef.current = { force: 0, until: 0 };
    resetEntities();
  }, [resetEntities]);

  useEffect(() => {
    resetEntities();
  }, [resetEntities]);

  // Level progression
  useEffect(() => {
    if (score >= target && !gameOver) {
      setLevel((l) => l + 1);
      setTarget((t) => t + 6);
      setSpeed((s) => s + 0.02);
      setMessage(`Level ${level + 1}!`);
      const id = setTimeout(() => setMessage(""), 1600);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [score, target, gameOver, level]);

  // Handle Restart via keyboard
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "r" || e.key === "R")) {
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart]);

  // Per-frame loop
  const Runner = () => {
    useFrame((_, delta) => {
      if (delta > 0.05) return; // clamp long frames
      const now = performance.now();

      // Spawn random wind gust
      if (!gameOver && Math.random() < CONFIG.wind.chance && now > windRef.current.until) {
        const force = (Math.random() * 2 - 1) * CONFIG.wind.maxForce;
        windRef.current = { force, until: now + CONFIG.wind.durationMs };
      }
      if (now > windRef.current.until) windRef.current.force = 0;

      // Player controls
      const pressed = keyboard.current;
      const p = playerRef.current;
      if (!gameOver) {
        const lateral = (pressed.has("ArrowLeft") ? -1 : 0) + (pressed.has("ArrowRight") ? 1 : 0);
        p.x += lateral * CONFIG.player.moveSpeed;
        p.x += windRef.current.force; // wind push
        p.x = clamp(p.x, CONFIG.player.minX, CONFIG.player.maxX);

        if (pressed.has("ArrowUp") && p.grounded) {
          p.vy = CONFIG.player.jumpVelocity;
          p.grounded = false;
        }
        if (pressed.has("ArrowDown")) {
          p.vy += CONFIG.player.gravity * 0.4; // quick drop
        }

        // Gravity
        p.vy += CONFIG.player.gravity;
        p.y += p.vy;

        // Ground collision
        const groundY = CONFIG.player.startY;
        if (p.y <= groundY) {
          p.y = groundY;
          p.vy = 0;
          p.grounded = true;
        }
      }

      // Move world toward player (illusion of forward motion)
      const forward = speed + Math.min(level * 0.003, 0.05);
      starsRef.current.forEach((s) => {
        s.z += forward;
        if (s.z > 3) {
          // respawn ahead
          s.z = -60 - Math.random() * 40;
          s.x = (Math.random() * CONFIG.worldWidth - CONFIG.worldWidth / 2) * 0.6;
          s.y = 0.8 + Math.random() * 1.1;
          s.active = true;
        }
      });
      stormsRef.current.forEach((s) => {
        s.z += forward * 1.1;
        if (s.z > 3) {
          s.z = -80 - Math.random() * 60;
          s.x = (Math.random() * CONFIG.worldWidth - CONFIG.worldWidth / 2) * 0.6;
          s.y = 1.0 + Math.random() * 1.3;
          s.active = true;
        }
      });

      // Collisions
      if (!gameOver) {
        // Collect stars
        for (const s of starsRef.current) {
          if (!s.active) continue;
          const hit = sphereAabbIntersect(
            { x: p.x, y: p.y, z: p.z },
            CONFIG.star.radius,
            { x: s.x, y: s.y, z: s.z },
            { x: 0.25, y: 0.25, z: 0.25 }
          );
          if (hit) {
            s.active = false;
            setScore((prev) => prev + 1);
            if (typeof onScore === "function") onScore(1);
          }
        }
        // Storm damage
        for (const st of stormsRef.current) {
          if (!st.active) continue;
          const hit = sphereAabbIntersect(
            { x: p.x, y: p.y, z: p.z },
            CONFIG.player.radius,
            { x: st.x, y: st.y, z: st.z },
            { x: CONFIG.storm.size.x, y: CONFIG.storm.size.y, z: CONFIG.storm.size.z }
          );
          if (hit) {
            setGameOver(true);
            setMessage("Game Over");
            break;
          }
        }
      }
    });
    return null;
  };

  // Ground tiles moving backward to create a parallax/scrolling sense
  const Ground = () => {
    const group = useRef();
    const tiles = useMemo(() => {
      return Array.from({ length: CONFIG.groundZCount }).map((_, i) => ({
        z: -i * CONFIG.groundTileLength,
        id: i,
      }));
    }, []);
    useFrame(() => {
      const p = playerRef.current;
      if (!group.current) return;
      for (let i = 0; i < group.current.children.length; i++) {
        const m = group.current.children[i];
        // shift along z to create endless scroll
        m.position.z += speed;
        if (m.position.z > CONFIG.groundTileLength) {
          m.position.z -= CONFIG.groundZCount * CONFIG.groundTileLength;
        }
      }
      // slight lateral based on player X for parallax
      group.current.position.x = -playerRef.current.x * 0.05;
    });
    return (
      <group ref={group}>
        {tiles.map((t, idx) => (
          <mesh position={[0, 0, t.z]} rotation={[-Math.PI / 2, 0, 0]} key={idx} receiveShadow>
            <planeGeometry args={[CONFIG.worldWidth, CONFIG.groundTileLength]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? CONFIG.colors.groundA : CONFIG.colors.groundB}
            />
          </mesh>
        ))}
      </group>
    );
  };

  // Player as a capsule approximation
  const Player = () => {
    const body = useRef();
    useFrame(() => {
      const p = playerRef.current;
      if (body.current) {
        body.current.position.set(p.x, p.y, p.z);
      }
    });
    return (
      <group ref={body}>
        <mesh castShadow>
          <capsuleGeometry args={[CONFIG.player.radius, CONFIG.player.height - CONFIG.player.radius * 2, 8, 16]} />
          <meshStandardMaterial color={CONFIG.colors.secondary} emissive={"#F59E0B"} emissiveIntensity={0.1} />
        </mesh>
        <Float speed={2} rotationIntensity={0.05} floatIntensity={0.1}>
          <mesh position={[0, CONFIG.player.height / 2 + 0.2, 0]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color={CONFIG.colors.primary} emissive={"#2563EB"} emissiveIntensity={0.3} />
          </mesh>
        </Float>
      </group>
    );
  };

  const Stars = () => {
    const refs = useRef([]);
    useFrame(() => {
      starsRef.current.forEach((s, i) => {
        const m = refs.current[i];
        if (!m) return;
        m.visible = s.active;
        m.position.set(s.x, s.y, s.z);
        m.rotation.y += 0.02;
      });
    });
    return (
      <group>
        {starsRef.current.map((s, i) => (
          <mesh key={`star-${i}`} ref={(el) => (refs.current[i] = el)}>
            <icosahedronGeometry args={[CONFIG.star.radius, 0]} />
            <meshStandardMaterial color={CONFIG.colors.secondary} emissive={CONFIG.colors.secondary} emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
    );
  };

  const Storms = () => {
    const refs = useRef([]);
    useFrame(() => {
      stormsRef.current.forEach((s, i) => {
        const m = refs.current[i];
        if (!m) return;
        m.visible = s.active;
        m.position.set(s.x, s.y, s.z);
        // subtle bobbing
        m.position.y += Math.sin(performance.now() * 0.002 + i) * 0.002;
      });
    });
    return (
      <group>
        {stormsRef.current.map((st, i) => (
          <group key={`storm-${i}`} ref={(el) => (refs.current[i] = el)}>
            <mesh>
              <sphereGeometry args={[0.7, 16, 16]} />
              <meshStandardMaterial color={CONFIG.colors.storm} roughness={0.9} />
            </mesh>
            <mesh position={[0.6, 0.1, 0]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial color={CONFIG.colors.storm} roughness={0.95} />
            </mesh>
            <mesh position={[-0.6, 0.0, 0]}>
              <sphereGeometry args={[0.45, 16, 16]} />
              <meshStandardMaterial color={CONFIG.colors.storm} roughness={0.95} />
            </mesh>
            {/* Occasional flash bolt */}
            <group position={[0, -0.3, 0]}>
              <mesh visible={Math.random() < 0.02}>
                <boxGeometry args={[0.05, 0.6, 0.05]} />
                <meshStandardMaterial color={"#ffef88"} emissive={"#ffef88"} emissiveIntensity={2} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    );
  };

  const Sky = () => {
    // gradient background via large plane
    return (
      <group position={[0, 0, -20]}>
        <mesh rotation={[0, 0, 0]}>
          <planeGeometry args={[200, 100]} />
          <meshBasicMaterial
            color={CONFIG.colors.skyBottom}
          />
        </mesh>
      </group>
    );
  };

  const UIOverlay = () => {
    const pill = {
      background: "rgba(37,99,235,0.08)",
      color: "#2563EB",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 14,
      fontWeight: 700,
      marginLeft: 8,
    };
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto" }}>
            <span style={{ fontWeight: 700, color: "#111827" }}>Dream Dash 3D</span>
            <span style={{ ...pill, background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>Modern • Ocean</span>
          </div>
          <div>
            <span style={pill}>Score: {score}</span>
            <span style={{ ...pill, marginLeft: 8 }}>Level: {level}</span>
            <span style={{ ...pill, marginLeft: 8 }}>Next: {Math.max(target - score, 0)}</span>
          </div>
        </div>

        {message && (
          <div
            style={{
              alignSelf: "center",
              marginBottom: "auto",
              marginTop: 40,
              background: "rgba(37,99,235,0.9)",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 16,
              fontWeight: 800,
              letterSpacing: 0.3,
              boxShadow: "0 10px 30px rgba(2,8,23,0.18)",
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", padding: 12, alignItems: "flex-end" }}>
          <div
            style={{
              background: "rgba(37,99,235,0.06)",
              color: "#2563EB",
              padding: "6px 8px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              pointerEvents: "auto",
            }}
          >
            Arrows: Move/Jump • R: Restart
          </div>
          <button
            onClick={() => restart()}
            style={{
              pointerEvents: "auto",
              background: "#2563EB",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 800,
              boxShadow: "0 6px 16px rgba(37,99,235,0.35)",
              cursor: "pointer",
            }}
            type="button"
            aria-label="Restart 3D game"
          >
            Restart
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width, height }}>
      <Canvas
        shadows
        camera={{ position: [0, 2.1, 5.2], fov: 60 }}
        style={{
          borderRadius: 12,
          boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          background: `linear-gradient(180deg, ${CONFIG.colors.skyTop} 0%, ${CONFIG.colors.skyBottom} 100%)`,
          display: "block",
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[2, 4, 3]}
          castShadow
          intensity={0.8}
          color={CONFIG.colors.primary}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* Visual sky/star field */}
        <DreiStars radius={80} depth={40} count={1200} factor={3} saturation={0} fade speed={0.4} />
        <Sky />

        {/* World */}
        <Ground />
        <Player />
        <Stars />
        <Storms />

        {/* Game loop */}
        <Runner />

        {/* Optional: allow exploration when paused */}
        {/* <OrbitControls enablePan={false} enableZoom={false} /> */}
      </Canvas>

      <UIOverlay />
    </div>
  );
}
