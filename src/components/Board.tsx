/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PachinkoBall, Pin, Pocket } from '../types';
import { sfx } from '../utils/audio';

interface BoardProps {
  shootingPower: number; // 0 to 100
  isShooting: boolean;
  onHesoGet: () => void;
  onAttackerScore: () => void;
  onAwardBalls: (amount: number) => void;
  isAttackerOpen: boolean;
  onBallFleshed: () => void; // Called when a ball is successfully fired (costs 1 ball)
  currentBallCount: number;
  autoTuningEnabled?: boolean;
  ballsFiredCount?: number;
  totalSpins?: number;
}

export const Board: React.FC<BoardProps> = ({
  shootingPower,
  isShooting,
  onHesoGet,
  onAttackerScore,
  onAwardBalls,
  isAttackerOpen,
  onBallFleshed,
  currentBallCount,
  autoTuningEnabled = true,
  ballsFiredCount = 1,
  totalSpins = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<PachinkoBall[]>([]);
  const nextBallIdRef = useRef<number>(1);
  const lastShotTimeRef = useRef<number>(0);

  // Symmetrical interactive windmills (風車) representing real pachinko mechanics
  const windmillsRef = useRef<Array<{ x: number; y: number; radius: number; angle: number; angularVelocity: number; color: string }>>([
    { x: 74, y: 220, radius: 15, angle: 0, angularVelocity: 0, color: '#10b981' },       // Left Upper Windmill (Emerald)
    { x: 78, y: 310, radius: 15, angle: Math.PI / 4, angularVelocity: 0, color: '#06b6d4' }, // Left Lower Windmill (Cyan)
    { x: 326, y: 220, radius: 15, angle: Math.PI / 2, angularVelocity: 0, color: '#f59e0b' }, // Right Upper Windmill (Amber)
    { x: 322, y: 310, radius: 15, angle: Math.PI / 3, angularVelocity: 0, color: '#ec4899' }, // Right Lower Windmill (Magenta)
  ]);

  // Board dimensions
  const WIDTH = 400;
  const HEIGHT = 565;

  // Track particle bursts for entry events
  const [particles, setParticles] = useState<Array<{ x: number; y: number; color: string; vx: number; vy: number; age: number; maxAge: number }>>([]);

  // Setup pins statically
  const pinsRef = useRef<Pin[]>([]);
  if (pinsRef.current.length === 0) {
    const pins: Pin[] = [];

    // ==========================================
    // OUTER WALLS & ARCH PINS (盤面外周・アーチ天釘)
    // ==========================================
    // Left barrier curve guide pins (stops balls from staying outside)
    for (let i = 0; i < 7; i++) {
      pins.push({ x: 28 + i * 2, y: 150 + i * 35, radius: 3, type: 'normal' });
    }

    // Top arch pins (balls bounce off into central field)
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * i) / 11;
      const rx = 200 + Math.cos(angle) * 165;
      const ry = 180 - Math.sin(angle) * 100;
      pins.push({ x: rx, y: ry, radius: 3, type: 'normal' });
    }

    // ==========================================
    // BUKKOMI OBLIQUE GUIDE (ぶっこみエリア)
    // ==========================================
    // Symmetrical left-upper channel guiding falling balls from out-left/top 
    // smoothly towards the inner LCD-left side instead of sticking to the left wall.
    for (let i = 0; i < 6; i++) {
      pins.push({ x: 55 + i * 14, y: 110 + i * 11, radius: 3.2, type: 'normal' });
    }

    // ==========================================
    // THE WARP ENTRY PORTAL PINS (ワープ入口)
    // ==========================================
    // Golden target guide pins right beneath the top right curve around X=335, Y=120
    pins.push({ x: 318, y: 114, radius: 3.5, type: 'heso-guide' }); // Left golden portal pin
    pins.push({ x: 346, y: 116, radius: 3.5, type: 'heso-guide' }); // Right golden portal pin
    pins.push({ x: 332, y: 130, radius: 3.0, type: 'normal' });     // Directing base pin

    // ==========================================
    // UPPER DYNAMIC CASCADE PINS (中央上部)
    // ==========================================
    // Gentle triangular cascade to scatter drop lines towards LCD edges
    pins.push({ x: 200, y: 105, radius: 3, type: 'normal' });
    pins.push({ x: 185, y: 125, radius: 3, type: 'normal' });
    pins.push({ x: 215, y: 125, radius: 3, type: 'normal' });
    pins.push({ x: 170, y: 145, radius: 3, type: 'normal' });
    pins.push({ x: 200, y: 145, radius: 3, type: 'normal' });
    pins.push({ x: 230, y: 145, radius: 3, type: 'normal' });

    // ==========================================
    // DENSE SIDE WALLS / INWARD "HA-NO-JI" (＼ ／ 傾斜・風車誘導エリア)
    // ==========================================
    // Left sleeve (＼): Funnels falling balls from left side of LCD towards the center
    for (let i = 0; i < 7; i++) {
      pins.push({ x: 50 + i * 14, y: 230 + i * 18, radius: 3.2, type: 'normal' });
    }
    // Block outer left leak
    pins.push({ x: 42, y: 350, radius: 3, type: 'normal' });
    pins.push({ x: 42, y: 375, radius: 3, type: 'normal' });
    pins.push({ x: 48, y: 400, radius: 3, type: 'normal' });

    // Right sleeve (／): Funnels falling balls from right side of LCD towards the center
    for (let i = 0; i < 7; i++) {
      pins.push({ x: 350 - i * 14, y: 230 + i * 18, radius: 3.2, type: 'normal' });
    }
    // Block outer right leak
    pins.push({ x: 358, y: 350, radius: 3, type: 'normal' });
    pins.push({ x: 358, y: 375, radius: 3, type: 'normal' });
    pins.push({ x: 352, y: 400, radius: 3, type: 'normal' });

    // Symmetrical Windmill outer deflectors (tuned to stay out of main flow but keeps ball on deck)
    const wmsDeflectors = [
      { x: 56, y: 208 }, { x: 344, y: 208 },
      { x: 60, y: 298 }, { x: 340, y: 298 }
    ];
    wmsDeflectors.forEach(def => {
      pins.push({ x: def.x, y: def.y, radius: 3.2, type: 'normal' });
    });

    // ==========================================
    // TRADITIONAL GOLD "INOCHI-KUGI" (命釘) ONLY
    // ==========================================
    // The legendary gold "Inochi-kugi" at the START chucker throat
    pins.push({ x: WIDTH / 2 - 14.5, y: 435, radius: 3.2, type: 'heso-guide' }); // Left Inochi-kugi
    pins.push({ x: WIDTH / 2 + 14.5, y: 435, radius: 3.2, type: 'heso-guide' }); // Right Inochi-kugi

    // ==========================================
    // LOWER FIELD DEVIATORS (アタッカー周辺・アウト口)
    // ==========================================
    pins.push({ x: WIDTH / 2 - 60, y: 480, radius: 3, type: 'normal' });
    pins.push({ x: WIDTH / 2 + 60, y: 480, radius: 3, type: 'normal' });
    pins.push({ x: WIDTH / 2 - 40, y: 512, radius: 3, type: 'normal' });
    pins.push({ x: WIDTH / 2 + 40, y: 512, radius: 3, type: 'normal' });

    pinsRef.current = pins;
  }

  // Pocket coordinates
  const pockets: Pocket[] = [
    { x: WIDTH / 2, y: 450, width: 29, height: 18, type: 'heso', label: 'CHANCE', payout: 3 },
    { x: WIDTH / 2, y: 515, width: 65, height: 18, type: 'attacker', label: 'FEVER', payout: 15 },
    { x: WIDTH / 2, y: 556, width: 40, height: 10, type: 'out', label: 'OUT', payout: 0 },
  ];

  // Helper to spawn entry burst particles
  const createBurst = (x: number, y: number, color: string, count: number = 12) => {
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      newParticles.push({
        x,
        y,
        color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        maxAge: 30 + Math.floor(Math.random() * 20),
      });
    }
    setParticles((prev) => [...prev, ...newParticles].slice(-100));
  };

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;
    let animationId: number;

    const updatePhysics = () => {
      // 1. Fire new ball if shooting is active
      const now = Date.now();
      // Shoot at approx 3 balls per second (1 every 333ms) to make it smooth but robust
      if (isShooting && currentBallCount > 0 && now - lastShotTimeRef.current >= 320) {
        // Cost 1 ball
        onBallFleshed();
        lastShotTimeRef.current = now;
        sfx.playShot();

        // Spawn ball at the bottom-left rail launcher (Traditional pachinko left-side launch)
        // It shoots straight up the left guide tube and curves over the top arch
        const bPower = shootingPower / 100; // 0 to 1

        // Introduce structural micro-variations (dispersion) to replicate realistic mechanical springs, air-resistance, and tube friction
        const dispersionY = (Math.random() - 0.5) * 0.45;
        const wobbleX = (Math.random() - 0.5) * 0.4;

        // Tweak launch velocities to respond perfectly to the power slider with realistic chaos added
        // Inside the tube, the ball travels straight up (vx is near 0, but slightly rightward pushing)
        const vx = 0.05 + bPower * 0.45 + (Math.random() - 0.5) * 0.15;
        const vy = -11.0 - bPower * 8.2 + dispersionY;

        ballsRef.current.push({
          id: nextBallIdRef.current++,
          x: 15 + wobbleX, // Left rail channel coordinate with mechanical offset wobble
          y: HEIGHT - 35,
          vx,
          vy,
          radius: 5.2,
          bounces: 0,
          isDead: false,
          color: '#ffffff',
          inLaunchTube: true,
        });
      }

      // 2. Physics & Collisions
      const balls = [...ballsRef.current];
      const pins = pinsRef.current;
      const windmills = windmillsRef.current;

      // Update kinetic rotation of neon windmills before applying collisions
      windmills.forEach((wm) => {
        wm.angle += wm.angularVelocity;
        wm.angularVelocity *= 0.945; // Smooth mechanical spin drag over time
      });

      // A. PREMIUM SEAMLESS BALL-TO-BALL CONCURRENT COLLISION ENGINE
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];
          if (b1.isDead || b2.isDead || b1.inLaunchTube || b2.inLaunchTube) continue;

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.hypot(dx, dy);
          const minDist = b1.radius + b2.radius;

          if (dist < minDist) {
            // Instant overlap deconstruction to prevent overlap sticky-glitches
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            b1.x -= nx * overlap * 0.5;
            b1.y -= ny * overlap * 0.5;
            b2.x += nx * overlap * 0.5;
            b2.y += ny * overlap * 0.5;

            // Momentum elastic exchange of identical carbon-steel balls
            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const p = kx * nx + ky * ny;

            b1.vx -= p * nx * 0.84; // Hyper-elastic steel properties
            b1.vy -= p * ny * 0.84;
            b2.vx += p * nx * 0.84;
            b2.vy += p * ny * 0.84;

            if (b1.bounces < 10 && Math.random() < 0.2) {
              sfx.playBounce(1.15); // Distinct dual steel clink
            }
          }
        }
      }

      // B. NEON SPINNERS / WINDMILL DYNAMIC KINETICS & PADDLE ROTATIONAL KICK
      for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (ball.isDead || ball.inLaunchTube) continue;

        for (let w = 0; w < windmills.length; w++) {
          const wm = windmills[w];
          const dx = ball.x - wm.x;
          const dy = ball.y - wm.y;
          const dist = Math.hypot(dx, dy);
          const interactionRadius = wm.radius + ball.radius;

          if (dist < interactionRadius) {
            // Push ball safely outward
            const nx = dx / dist;
            const ny = dy / dist;
            ball.x = wm.x + nx * interactionRadius;

            // Impart momentum into spinner rotation and reverse-react back onto ball speed
            const tx = -ny; // Tangential vector X
            const ty = nx;  // Tangential vector Y
            const relativeVelocityTan = ball.vx * tx + ball.vy * ty;

            wm.angularVelocity += relativeVelocityTan * 0.015;
            if (wm.angularVelocity > 0.45) wm.angularVelocity = 0.45;
            if (wm.angularVelocity < -0.45) wm.angularVelocity = -0.45;

            const tipSpeed = wm.angularVelocity * wm.radius;
            const dot = ball.vx * nx + ball.vy * ny;

            // Kick ball with rotational velocity + standard bounce restitution
            ball.vx = (ball.vx - 2 * dot * nx) * 0.65 + tx * tipSpeed * 1.55 + (Math.random() - 0.5) * 0.3;
            ball.vy = (ball.vy - 2 * dot * ny) * 0.65 + ty * tipSpeed * 1.55 + (Math.random() - 0.5) * 0.2;

            ball.bounces++;
            if (Math.random() < 0.65) {
              sfx.playBounce(1.25);
            }
          }
        }
      }

      // Main singular physics loop
      for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (ball.isDead) continue;

        // -------------------------------------------------------------
        // WARP ENTRY portal detector
        // -------------------------------------------------------------
        if (!ball.inLaunchTube && !ball.inWarp && !ball.onStage) {
          // Detect physical entry into the golden portal gate
          const distToPortal = Math.hypot(ball.x - 332, ball.y - 120);
          if (distToPortal < 15.0) {
            ball.inWarp = true;
            ball.warpT = 0;
            ball.vx = 0;
            ball.vy = 0;
            sfx.playHeso(); // happy mechanical chimes chime!
            createBurst(332, 120, '#06b6d4', 8);
          } else if (autoTuningEnabled && ballsFiredCount > 0 && ball.y > 90 && ball.y < 120 && ball.x > 300 && ball.x < 360) {
            // Smart Guidance Assistance (自動調律システム):
            // If we are significantly behind our target 1-in-15 start rate, 
            // apply a subtle gravitational nudge to draw the falling ball into the Warp Entrance!
            const currentRatio = ballsFiredCount / Math.max(1, totalSpins);
            if (currentRatio > 15.0) {
              const dx = 332 - ball.x;
              const dy = 120 - ball.y;
              ball.vx += dx * 0.045; // micro magnetic drawer pull
              ball.vy += dy * 0.045;
            }
          }
        }

        // -------------------------------------------------------------
        // WARP ROUTE flight path
        // -------------------------------------------------------------
        if (ball.inWarp) {
          // Progress along warp parametric curve
          ball.warpT = (ball.warpT || 0) + 0.026;
          if (ball.warpT >= 1.0) {
            // Land smoothly onto the horizontal STAGE tray
            ball.inWarp = false;
            ball.onStage = true;
            ball.stageX = WIDTH / 2 + (Math.random() - 0.5) * 16; // Spawn slightly randomized near center of stage
            ball.stageVx = (Math.random() - 0.5) * 1.6; // initial horizontal speed vacillation
            ball.x = ball.stageX;
            ball.y = 398;
            ball.vx = ball.stageVx;
            ball.vy = 0;
            sfx.playBounce(1.15); // metal clink!
          } else {
            // Cubic Bezier interpolation: P0=(332, 120), P1=(395, 205), P2=(310, 315), P3=(200, 395)
            const t = ball.warpT;
            const t_1 = 1.0 - t;
            
            const p0x = 332, p0y = 120;
            const p1x = 398, p1y = 210;
            const p2x = 300, p2y = 320;
            const p3x = 200, p3y = 395;
            
            ball.x = t_1*t_1*t_1*p0x + 3*t_1*t_1*t*p1x + 3*t_1*t*t*p2x + t*t*t*p3x;
            ball.y = t_1*t_1*t_1*p0y + 3*t_1*t_1*t*p1y + 3*t_1*t*t*p2y + t*t*t*p3y;
            ball.vx = 0;
            ball.vy = 0;
          }
          continue; // bypass regular gravity/bouncing during warp
        }

        // -------------------------------------------------------------
        // STAGE PATH rolling mechanics
        // -------------------------------------------------------------
        if (ball.onStage) {
          // Rest on the stage: slides horizontally, has friction & attraction towards center drop slot
          ball.stageX = (ball.stageX || WIDTH / 2) + (ball.stageVx || 0);
          ball.stageVx = (ball.stageVx || 0);

          // Apply plastic material rolling resistance
          ball.stageVx *= 0.96;

          // Physics slope: drop-slot is at X = 200. Accelerate ball towards the center.
          const pullSpeed = (200 - ball.stageX) * 0.052;
          ball.stageVx += pullSpeed;

          // DYNAMIC PROBABILITY AUTOTALK: (15発に1回回転の自動調律システム)
          let stageModifier = 0;
          if (autoTuningEnabled && ballsFiredCount > 0) {
            const actualRatio = ballsFiredCount / Math.max(1, totalSpins);
            if (actualRatio > 15.5) {
              // Too few spins. Trigger magnetic center positioning to guarantee the drop!
              stageModifier = (200 - ball.stageX) * 0.12; 
            } else if (actualRatio < 13.5) {
              // Too many spins. Trigger slight electrostatic repulsion to make ball spill of the sides instead.
              stageModifier = -Math.sign(200 - ball.stageX) * 0.10;
            }
          }
          ball.stageVx += stageModifier;

          ball.x = ball.stageX;
          ball.y = 398;
          ball.vx = ball.stageVx;
          ball.vy = 0;

          // Verify stage limit exit conditions
          if (ball.stageX < 156 || ball.stageX > 244) {
            // Spills off the edges of the platform!
            ball.onStage = false;
            ball.vx = ball.stageX < 156 ? -1.5 : 1.5;
            ball.vy = 1.0;
          } else {
            // Drop through central opening drop slot (trapdoor width is approx 12px)
            const distFromCenter = Math.abs(ball.stageX - 200);
            if (distFromCenter < 5.5 && Math.abs(ball.stageVx) < 0.95) {
              // Perfect drop straight down, aimed perfectly to enter the Inochi-kugi!
              ball.onStage = false;
              ball.x = 200;
              ball.y = 405;
              ball.vx = 0;
              ball.vy = 2.4; 
              sfx.playBounce(0.9);
            }
          }
          continue; // bypass regular gravity/bouncing while on stage
        }

        // Apply constant gravity vector (tuned to 0.24 for spectacular bouncy cascades!)
        ball.vy += 0.24;

        // -------------------------------------------------------------
        // FALLING ONTO THE STAGE PLATFORM (パチンコのようにステージに直接乗る)
        // -------------------------------------------------------------
        if (!ball.inLaunchTube && !ball.inWarp && !ball.onStage && ball.vy > 0) {
          // If the ball's Y-coordinate crosses the Y plane of the stage (Y=397)
          if (ball.y <= 397 && (ball.y + ball.vy) >= 397) {
            // Check if the ball lands on either the left or right ledge of the stage
            if ((ball.x >= 156 && ball.x <= 194.5) || (ball.x >= 205.5 && ball.x <= 244)) {
              ball.onStage = true;
              ball.stageX = ball.x;
              ball.stageVx = ball.vx * 0.45; // retain some horizontal velocity
              ball.x = ball.stageX;
              ball.y = 398;
              ball.vy = 0;
              sfx.playBounce(0.85); // play mechanical landing sound
            }
          }
        }

        // -------------------------------------------------------------
        // HESO PSEUDO-MAGNETIC DRAFT (スタートチャッカー周辺の微風・誘導磁力システム)
        // -------------------------------------------------------------
        if (!ball.inLaunchTube && !ball.inWarp && !ball.onStage) {
          // Check if ball is in the pocket's upper guidance zone (Y: 390 to 448, X: 170 to 230)
          // 200 represents the central X of START chucker, 450 is its Y.
          const zoneLeft = 170;
          const zoneRight = 230;
          const zoneTop = 390;
          const zoneBottom = 448;
          
          if (ball.x >= zoneLeft && ball.x <= zoneRight && ball.y >= zoneTop && ball.y <= zoneBottom) {
            // 1. Decelerate to half velocity exactly when entering the assist zone to prevent bounce-outs
            if (!ball.hesoSlowed) {
              ball.vx *= 0.5;
              ball.vy *= 0.5;
              ball.hesoSlowed = true;
            }
            
            // 2. Smoothly draw X coordinate towards center (200) frame-by-frame
            const dx = 200 - ball.x;
            ball.x += dx * 0.12; // Natural, fluid magnetic attraction
            ball.vx *= 0.85;     // Clean stabilizing lateral dampers
          } else {
            // Reset state if it exits the zone so physical forces behave as expected elsewhere
            ball.hesoSlowed = false;
          }
        }

        // High precision air resistance (drag)
        ball.vx *= 0.994;
        ball.vy *= 0.994;

        // Apply velocities
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Boundary collision: Unified launch tube vs playfield constraints
        const centerX = WIDTH / 2;
        const centerY = 190;
        const distFromCenter = Math.hypot(ball.x - centerX, ball.y - centerY);
        const outerRadius = 188;

        if (ball.inLaunchTube) {
          // ==========================================
          // SPECIAL LAUNCH TUBE PHYSICS (X = 12 to X = 27)
          // ==========================================
          const tubeLeft = 12 + ball.radius;
          const tubeRight = 27 - ball.radius;

          if (ball.x < tubeLeft) {
            ball.x = tubeLeft;
            ball.vx = -ball.vx * 0.35; // Friction-free vertical glide
          } else if (ball.x > tubeRight && ball.y > 116) {
            // Constrain by Divider wall at X = 27 below Y = 116
            ball.x = tubeRight;
            ball.vx = -ball.vx * 0.35;
          }

          // Retain strict upward path inside tube
          ball.vx *= 0.985;

          // Check for exit condition
          if (ball.y < 116 && ball.x > 32) {
            // Curving out over the top-left bend into the central board
            ball.inLaunchTube = false;
          } else if (ball.vy >= 0 && ball.y > 150) {
            // Failed/weak launch: dropped below threshold or lost upward speed
            ball.inLaunchTube = false;
          }
        } else {
          // ==========================================
          // STANDARD PLAYFIELD BOUNDARY PHYSICS
          // ==========================================
          // 1. Upper circular arch constraint (only when Y < 190)
          if (ball.y < 190) {
            if (distFromCenter > outerRadius) {
              const angle = Math.atan2(ball.y - centerY, ball.x - centerX);
              ball.x = centerX + Math.cos(angle) * (outerRadius - 1);

              const normalX = Math.cos(angle);
              const normalY = Math.sin(angle);
              const dotProduct = ball.vx * normalX + ball.vy * normalY;
              
              // Bounce damping
              ball.vx = (ball.vx - 2 * dotProduct * normalX) * 0.52;
              ball.vy = (ball.vy - 2 * dotProduct * normalY) * 0.52;
              ball.bounces++;
              if (ball.bounces < 8) sfx.playBounce(0.8);
            }
          } else {
            // 2. Lower rectangular side wall constraints (when Y >= 190)
            // Left boundary is the vertical divider at X = 27
            // Right boundary is the outer right steel molding at X = 388
            const playfieldLeft = 27 + ball.radius;
            const playfieldRight = 388 - ball.radius;

            if (ball.x < playfieldLeft) {
              ball.x = playfieldLeft;
              ball.vx = -ball.vx * 0.55;
              ball.bounces++;
              if (ball.bounces < 8) sfx.playBounce(0.85);
            } else if (ball.x > playfieldRight) {
              ball.x = playfieldRight;
              ball.vx = -ball.vx * 0.55;
              ball.bounces++;
              if (ball.bounces < 8) sfx.playBounce(0.85);
            }
          }
        }

        // Collisions with pins
        // Balls in launch tube do not collide with pins
        if (!ball.inLaunchTube) {
          for (let p = 0; p < pins.length; p++) {
            const pin = pins[p];
            const dist = Math.hypot(ball.x - pin.x, ball.y - pin.y);
            const minDist = ball.radius + pin.radius;

            if (dist < minDist) {
              // Un-overlap ball from pin
              const angle = Math.atan2(ball.y - pin.y, ball.x - pin.x);
              ball.x = pin.x + Math.cos(angle) * minDist;

              // Reflect velocity with coefficient of restitution
              const normalX = Math.cos(angle);
              const normalY = Math.sin(angle);
              const dot = ball.vx * normalX + ball.vy * normalY;

              // Tilt/Scatter with organic dispersion to make paths highly chaotic and non-repetitive
              const tiltScatter = (Math.random() - 0.5) * 0.35;
              const bounceElasticity = pin.type === 'bumper' ? 0.88 : (pin.type === 'heso-guide' ? 0.42 : 0.60);

              ball.vx = (ball.vx - 2 * dot * normalX) * bounceElasticity + tiltScatter;
              ball.vy = (ball.vy - 2 * dot * normalY) * bounceElasticity + (Math.random() - 0.5) * 0.15;
              ball.bounces++;

              // Play mechanical bell/chime chime sound on collision with distinct resonance
              if (ball.bounces < 24 && Math.random() < 0.65) {
                sfx.playBounce(pin.type === 'bumper' ? 1.45 : (pin.type === 'heso-guide' ? 1.25 : 1.0 + (p % 6) * 0.04));
              }
            }
          }
        }

        // Screen frame collisions (LCD display bezel in center)
        // Center Screen bounding box: X=115 to X=285, Y=180 to Y=350
        const dispL = 115;
        const dispR = 285;
        const dispT = 180;
        const dispB = 350;

        if (ball.x > dispL - ball.radius && ball.x < dispR + ball.radius && ball.y > dispT - ball.radius && ball.y < dispB + ball.radius) {
          // Find closest side and bounce off
          const dl = Math.abs(ball.x - (dispL - ball.radius));
          const dr = Math.abs(ball.x - (dispR + ball.radius));
          const dt = Math.abs(ball.y - (dispT - ball.radius));
          const db = Math.abs(ball.y - (dispB + ball.radius));
          const minDist = Math.min(dl, dr, dt, db);

          if (minDist === dl) {
            ball.x = dispL - ball.radius;
            ball.vx = -Math.abs(ball.vx) * 0.52;
          } else if (minDist === dr) {
            ball.x = dispR + ball.radius;
            ball.vx = Math.abs(ball.vx) * 0.52;
          } else if (minDist === dt) {
            ball.y = dispT - ball.radius;
            ball.vy = -Math.abs(ball.vy) * 0.52;
          } else {
            ball.y = dispB + ball.radius;
            ball.vy = Math.abs(ball.vy) * 0.4;
          }
          ball.bounces++;
          sfx.playBounce(0.7);
        }

        // Pocket check
        for (let pk = 0; pk < pockets.length; pk++) {
          const pocket = pockets[pk];
          const detectionWidth = pocket.type === 'heso' ? pocket.width * 3.0 : pocket.width;
          const insideX = ball.x > pocket.x - detectionWidth / 2 && ball.x < pocket.x + detectionWidth / 2;
          // Approximate top opening
          const insideY = ball.y > pocket.y - 12 && ball.y < pocket.y + 12;

          if (insideX && insideY) {
            if (pocket.type === 'heso') {
              ball.isDead = true;
              onHesoGet();
              createBurst(pocket.x, pocket.y, '#3b82f6', 15);
              onAwardBalls(pocket.payout);
            } else if (pocket.type === 'attacker') {
              // Can only score if attacker is physically open (Fever Mode!)
              if (isAttackerOpen) {
                ball.isDead = true;
                onAttackerScore();
                createBurst(pocket.x, pocket.y, '#ec4899', 18);
                onAwardBalls(pocket.payout);
              }
            } else if (pocket.type === 'side') {
              ball.isDead = true;
              sfx.playBounce(1.5);
              createBurst(pocket.x, pocket.y, '#10b981', 8);
              onAwardBalls(pocket.payout);
            } else if (pocket.type === 'out') {
              ball.isDead = true;
              createBurst(pocket.x, pocket.y, '#6b7280', 4);
            }
          }
        }

        // Off-screen fallback cleanup
        if (ball.y > HEIGHT + 20) {
          ball.isDead = true;
        }
      }

      // Filter out dead balls
      ballsRef.current = balls.filter((b) => !b.isDead);

      // Render Everything
      drawBoard(ctx);

      // Update particle effects
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.08, // Subtle gravity inside explosions
            age: p.age + 1,
          }))
          .filter((p) => p.age < p.maxAge)
      );

      if (isMounted) {
        animationId = requestAnimationFrame(updatePhysics);
      }
    };

    const drawBoard = (c: CanvasRenderingContext2D) => {
      // Clear with elegant translucent black for trailing motion blur & rich starry space
      const bgGrad = c.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, WIDTH);
      bgGrad.addColorStop(0, '#0a142c');
      bgGrad.addColorStop(0.5, '#040817');
      bgGrad.addColorStop(1, '#01030a');
      c.fillStyle = bgGrad;
      c.fillRect(0, 0, WIDTH, HEIGHT);

      // Draw subtle space grid
      c.strokeStyle = '#112244';
      c.lineWidth = 0.8;
      for (let x = 0; x < WIDTH; x += 25) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, HEIGHT);
        c.stroke();
      }
      for (let y = 0; y < HEIGHT; y += 25) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(WIDTH, y);
        c.stroke();
      }

      // ==========================================
      // ABSTRACT NEON CYBER FIELDS (High-fidelity light matrices)
      // ==========================================

      // Left Side: Emerald Laser Matrix
      c.save();
      // Glowing green background aura
      const greenGlow = c.createRadialGradient(80, 240, 5, 80, 240, 100);
      greenGlow.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
      greenGlow.addColorStop(0.6, 'rgba(16, 185, 129, 0.1)');
      greenGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = greenGlow;
      c.beginPath();
      c.arc(80, 240, 100, 0, Math.PI * 2);
      c.fill();

      // Sharp glowing Green Circuit Pathways (Abstract tech-grid)
      c.strokeStyle = '#10b981';
      c.lineWidth = 2;
      c.shadowColor = '#10b981';
      c.shadowBlur = 8;
      c.beginPath();
      // Hexagonal outer tech lines
      c.moveTo(15, 180);
      c.lineTo(55, 160);
      c.lineTo(95, 210);
      c.lineTo(75, 290);
      c.lineTo(25, 270);
      c.stroke();

      // Concentric structural lines
      c.beginPath();
      c.arc(60, 230, 40, 0, Math.PI * 1.5);
      c.stroke();
      c.shadowBlur = 0; // reset shadow
      c.restore();

      // Right Side: Amber Plasma Corona Matrix
      c.save();
      // Glowing orange/amber background aura
      const orangeGlow = c.createRadialGradient(320, 240, 5, 320, 240, 100);
      orangeGlow.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
      orangeGlow.addColorStop(0.6, 'rgba(245, 158, 11, 0.1)');
      orangeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = orangeGlow;
      c.beginPath();
      c.arc(320, 240, 100, 0, Math.PI * 2);
      c.fill();

      // Sharp glowing Orange V-Lines and concentric rings
      c.strokeStyle = '#f59e0b';
      c.lineWidth = 2;
      c.shadowColor = '#f59e0b';
      c.shadowBlur = 8;
      c.beginPath();
      // Hexagonal outer tech lines (Symmetrical to left)
      c.moveTo(385, 180);
      c.lineTo(345, 160);
      c.lineTo(305, 210);
      c.lineTo(325, 290);
      c.lineTo(375, 270);
      c.stroke();

      // Inner rings
      c.beginPath();
      c.arc(340, 230, 40, Math.PI * 0.5, Math.PI * 2);
      c.stroke();
      c.shadowBlur = 0; // reset shadow
      c.restore();

      // ==========================================
      // GEOMETRIC WING CROWN (Chevron decor atop screens)
      // ==========================================
      c.save();
      c.shadowColor = '#facc15';
      c.shadowBlur = 8;
      c.fillStyle = 'rgba(250, 204, 21, 0.9)'; // Brilliant Imperial Gold
      c.strokeStyle = '#cb9c06';
      c.lineWidth = 2;
      
      // Draw left sleek chevron wing
      c.beginPath();
      c.moveTo(WIDTH/2 - 2, 175);
      c.lineTo(WIDTH/2 - 85, 150);
      c.lineTo(WIDTH/2 - 30, 170);
      c.closePath();
      c.fill();
      c.stroke();

      // Draw right sleek chevron wing
      c.beginPath();
      c.moveTo(WIDTH/2 + 2, 175);
      c.lineTo(WIDTH/2 + 85, 150);
      c.lineTo(WIDTH/2 + 30, 170);
      c.closePath();
      c.fill();
      c.stroke();

      // Center glowing amber diamond core
      c.fillStyle = '#f59e0b';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(WIDTH/2, 164);
      c.lineTo(WIDTH/2 + 10, 172);
      c.lineTo(WIDTH/2, 180);
      c.lineTo(WIDTH/2 - 10, 172);
      c.closePath();
      c.fill();
      c.stroke();

      c.restore();

      // ==========================================
      // PREMIUM OUTER CABINET FRAME (Crimson armor arches)
      // ==========================================

      // Shiny ruby crimson arch gradient
      const redGrad = c.createLinearGradient(0, 0, WIDTH, 120);
      redGrad.addColorStop(0, '#850707');
      redGrad.addColorStop(0.3, '#df1a1a');
      redGrad.addColorStop(0.5, '#f54242');
      redGrad.addColorStop(0.7, '#df1a1a');
      redGrad.addColorStop(1, '#850707');

      // Top cabinet header crown molding
      c.fillStyle = redGrad;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(WIDTH, 0);
      c.lineTo(WIDTH, 50);
      c.bezierCurveTo(WIDTH - 80, 5, 80, 5, 0, 50);
      c.closePath();
      c.fill();

      // Giant chrome/silver shield wing trims (flanking left and right corners)
      const chromeGrad = c.createLinearGradient(0, 0, 100, 100);
      chromeGrad.addColorStop(0, '#f1f5f9');
      chromeGrad.addColorStop(0.5, '#94a3b8');
      chromeGrad.addColorStop(1, '#334155');

      // Left corner chrome ornament
      c.fillStyle = chromeGrad;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(55, 0);
      c.lineTo(35, 80);
      c.bezierCurveTo(20, 60, 5, 30, 0, 0);
      c.closePath();
      c.fill();

      // Right corner chrome ornament
      c.save();
      c.scale(-1, 1);
      c.translate(-WIDTH, 0);
      c.fillStyle = chromeGrad;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(55, 0);
      c.lineTo(35, 80);
      c.bezierCurveTo(20, 60, 5, 30, 0, 0);
      c.closePath();
      c.fill();
      c.restore();

      // Main Outer Ring Guide Frame
      c.strokeStyle = isAttackerOpen ? '#f43f5e' : '#df1a1a';
      c.lineWidth = 12;
      c.beginPath();
      c.arc(WIDTH / 2, 190, 190, Math.PI, 0, false);
      c.stroke();

      // Side metal structural columns (Armor plates)
      c.fillStyle = '#1e1b1b'; // Deep carbon grey
      c.fillRect(0, 190, 12, HEIGHT);
      c.fillRect(WIDTH - 12, 190, 12, HEIGHT);

      // Chrome outer piping accents
      c.fillStyle = '#64748b';
      c.fillRect(12, 190, 3, HEIGHT);
      c.fillRect(WIDTH - 15, 190, 3, HEIGHT);

      // ==========================================
      // SHINING FIBER OPTIC LIGHT STRINGS (Along side-curves)
      // ==========================================
      const pulseTime = Date.now() / 250;
      for (let i = 0; i < 12; i++) {
        const ledY = 170 + i * 33;
        const isActive = Math.sin(pulseTime + i * 0.75) > 0.0;
        
        // Left light bar node
        c.beginPath();
        c.arc(6, ledY, 4.5, 0, Math.PI * 2);
        c.fillStyle = isActive ? (isAttackerOpen ? '#f43f5e' : '#10b981') : '#450606';
        if (isActive) {
          c.shadowColor = isAttackerOpen ? '#f43f5e' : '#10b981';
          c.shadowBlur = 10;
        }
        c.fill();
        c.shadowBlur = 0;

        // Right light bar node
        c.beginPath();
        c.arc(WIDTH - 6, ledY, 4.5, 0, Math.PI * 2);
        c.fillStyle = isActive ? (isAttackerOpen ? '#f43f5e' : '#f59e0b') : '#450606';
        if (isActive) {
          c.shadowColor = isAttackerOpen ? '#f43f5e' : '#f59e0b';
          c.shadowBlur = 10;
        }
        c.fill();
        c.shadowBlur = 0;
      }

      // Bottom speaker grilles
      c.fillStyle = '#0f0f12';
      c.fillRect(15, HEIGHT - 35, 65, 25);
      c.fillRect(WIDTH - 90, HEIGHT - 35, 65, 25);
      c.strokeStyle = '#2d2d34';
      c.lineWidth = 1;
      c.strokeRect(15, HEIGHT - 35, 65, 25);
      c.strokeRect(WIDTH - 90, HEIGHT - 35, 65, 25);

      // Diagonal speaker lines
      for (let sl = 0; sl < 6; sl++) {
        c.beginPath();
        c.moveTo(18 + sl * 10, HEIGHT - 35);
        c.lineTo(28 + sl * 10, HEIGHT - 10);
        c.stroke();

        c.beginPath();
        c.moveTo(WIDTH - 87 + sl * 10, HEIGHT - 35);
        c.lineTo(WIDTH - 77 + sl * 10, HEIGHT - 10);
        c.stroke();
      }

      // Central Screen bezel frame (Bezel container where LcdScreen.tsx sits inside)
      c.strokeStyle = '#475569';
      c.lineWidth = 6;
      c.fillStyle = '#020617';
      c.fillRect(115, 180, 170, 170);
      c.strokeRect(115, 180, 170, 170);

      // Decorative screen corner indicators (Emerald green mecha-sensors!)
      c.fillStyle = isAttackerOpen ? '#f43f5e' : '#10b981';
      c.shadowColor = isAttackerOpen ? '#f43f5e' : '#10b981';
      c.shadowBlur = 5;
      c.fillRect(110, 175, 10, 10);
      c.fillRect(280, 175, 10, 10);
      c.fillRect(110, 345, 10, 10);
      c.fillRect(280, 345, 10, 10);
      c.shadowBlur = 0;

      // ==========================================
      // DIGITAL WARP CHANNEL & CORRIDOR STAGE (IMAGE REPLICA)
      // ==========================================
      // Draw the gorgeous polymer clear outer route spline
      c.save();
      c.strokeStyle = 'rgba(6, 182, 212, 0.40)'; // Neon transparent cyan outer glass tube representation
      c.lineWidth = 14;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      
      c.shadowColor = '#06b6d4';
      c.shadowBlur = 4;
      c.beginPath();
      // Bezier points mirroring the physics trajectory: P0=(332, 120) to P3=(200, 395)
      c.moveTo(332, 120);
      c.bezierCurveTo(398, 210, 300, 320, 200, 395);
      c.stroke();

      // Glowing liquid light core inside the transparent warp tube
      c.strokeStyle = '#22d3ee';
      c.lineWidth = 2.2;
      c.shadowBlur = 10;
      c.stroke();
      c.restore();

      // Draw the gorgeous horizontal Stage platform (at Y=400, X=160 to X=240, with center hole at X=200)
      c.save();
      c.fillStyle = 'rgba(15, 23, 42, 0.90)'; // Charcoal polymer
      c.strokeStyle = '#3b82f6';             // Neon blue
      c.lineWidth = 2;
      c.shadowColor = '#3b82f6';
      c.shadowBlur = 6;
      
      c.beginPath();
      c.moveTo(156, 397);
      c.lineTo(194, 397); // Left ledge
      c.lineTo(194, 403); // Left drop slot wall
      c.lineTo(206, 403); // Right drop slot wall
      c.lineTo(206, 397); // Right ledge
      c.lineTo(244, 397); // Stage Right end
      c.lineTo(244, 402); // Side cap right
      c.lineTo(156, 402); // Side cap left
      c.closePath();
      c.fill();
      c.stroke();

      // Laser guiding lines on Stage to highlight the start corridor drop
      c.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      c.lineWidth = 1;
      c.shadowBlur = 0;
      c.beginPath();
      c.moveTo(175, 397);
      c.lineTo(175, 402);
      c.moveTo(225, 397);
      c.lineTo(225, 402);
      c.stroke();

      // Glowing indicator ring directly behind the start dropping slot
      const waveGlow = Math.abs(Math.sin(Date.now() / 200)) * 6 + 1;
      c.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      c.lineWidth = 1.2;
      c.shadowColor = '#ef4444';
      c.shadowBlur = waveGlow;
      c.beginPath();
      c.arc(200, 400, 5, 0, Math.PI * 2);
      c.stroke();
      
      // Floating neon "WARP STAGE" labels
      c.fillStyle = '#38bdf8';
      c.font = 'bold 7px sans-serif';
      c.textAlign = 'center';
      c.fillText('WARP STAGE', 200, 388);
      c.restore();

      // Launcher Dividers (Launcher tracks) at X = 27
      c.strokeStyle = '#334155';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(27, 120);
      c.lineTo(27, HEIGHT);
      c.stroke();

      // Launch exit curve guide (Upper left corner connecting smoothly inside)
      c.strokeStyle = '#475569';
      c.beginPath();
      c.arc(27 + 12, 120, 12, Math.PI, Math.PI * 1.5);
      c.stroke();

      // Draw Pockets
      pockets.forEach((pkg) => {
        if (pkg.type === 'attacker') {
          // Attacker gate design
          if (isAttackerOpen) {
            c.fillStyle = '#ec4899';
            c.strokeStyle = '#f472b6';
            c.lineWidth = 2;
            c.fillRect(pkg.x - pkg.width - 5, pkg.y - 4, pkg.width * 2 + 10, pkg.height);
            c.strokeRect(pkg.x - pkg.width - 5, pkg.y - 4, pkg.width * 2 + 10, pkg.height);

            // Shaking text
            c.fillStyle = '#ffffff';
            c.font = 'bold 9px sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('OPEN! FEVER', pkg.x, pkg.y + 4);
          } else {
            // Closed gate
            c.fillStyle = '#1e293b';
            c.strokeStyle = '#475569';
            c.lineWidth = 2;
            c.fillRect(pkg.x - pkg.width / 2, pkg.y, pkg.width, pkg.height);
            c.strokeRect(pkg.x - pkg.width / 2, pkg.y, pkg.width, pkg.height);

            c.fillStyle = '#64748b';
            c.font = '8px sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('CLOSED', pkg.x, pkg.y + 8);
          }
        } else if (pkg.type === 'heso') {
          // Glowing Start Heso pocket
          const pulseHeso = Math.sin(Date.now() / 150) * 2;
          c.fillStyle = '#1e3a8a';
          c.strokeStyle = '#3b82f6';
          c.lineWidth = 2;
          c.beginPath();
          // Circular with funnel
          c.moveTo(pkg.x - pkg.width / 2 - pulseHeso, pkg.y);
          c.lineTo(pkg.x + pkg.width / 2 + pulseHeso, pkg.y);
          c.lineTo(pkg.x + docHesoWidth(pkg.width, pulseHeso), pkg.y + pkg.height);
          c.lineTo(pkg.x - docHesoWidth(pkg.width, pulseHeso), pkg.y + pkg.height);
          c.closePath();
          c.fill();
          c.stroke();

          // Active crystal center label
          c.fillStyle = '#38bdf8';
          c.font = 'bold 8px sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('START', pkg.x, pkg.y + 7);
        } else if (pkg.type === 'side') {
          // Side pockets
          c.fillStyle = '#065f46';
          c.strokeStyle = '#34d399';
          c.lineWidth = 1;
          c.fillRect(pkg.x - pkg.width / 2, pkg.y, pkg.width, pkg.height);
          c.strokeRect(pkg.x - pkg.width / 2, pkg.y, pkg.width, pkg.height);

          c.fillStyle = '#a7f3d0';
          c.font = '7px sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('SAFE', pkg.x, pkg.y + 7);
        } else {
          // Out pocket
          c.fillStyle = '#111827';
          c.strokeStyle = '#dc2626';
          c.lineWidth = 2;
          c.fillRect(pkg.x - pkg.width / 2, pkg.y, pkg.width, pkg.height);
          c.strokeRect(pkg.x - pkg.width / 2, pkg.y, pkg.width, pkg.height);

          c.fillStyle = '#f87171';
          c.font = '8px sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('OUT', pkg.x, pkg.y + 5);
        }
      });

      // Draw interactive spinning neo-wheels (風車)
      const windmills = windmillsRef.current;
      windmills.forEach((wm) => {
        c.save();
        c.translate(wm.x, wm.y);
        c.rotate(wm.angle);

        // Neon outer glow aura
        c.shadowColor = wm.color;
        c.shadowBlur = 10;

        // Draw physical transparent outer wheel rim
        c.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(0, 0, wm.radius, 0, Math.PI * 2);
        c.stroke();

        // Draw 4 symmetric glowing paddle blades
        for (let a = 0; a < 4; a++) {
          const armAngle = (Math.PI / 2) * a;
          c.save();
          c.rotate(armAngle);

          // Blade shape
          const bGrad = c.createLinearGradient(0, -2, wm.radius, 2);
          bGrad.addColorStop(0, '#ffffff');
          bGrad.addColorStop(0.5, wm.color);
          bGrad.addColorStop(1, '#000000');
          c.fillStyle = bGrad;

          c.beginPath();
          c.moveTo(0, -2);
          c.lineTo(wm.radius, -1);
          c.lineTo(wm.radius, 1);
          c.lineTo(0, 2);
          c.closePath();
          c.fill();

          // Blade outer metallic tip
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc(wm.radius, 0, 2.5, 0, Math.PI * 2);
          c.fill();

          c.restore();
        }

        // Draw gorgeous central brass brass hub
        c.fillStyle = '#fbbf24';
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1.5;
        c.shadowBlur = 4;
        c.beginPath();
        c.arc(0, 0, 4.5, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        c.restore();
      });

      // Draw physical Pin points (釘 - Kugi)
      pinsRef.current.forEach((pin) => {
        if (pin.type === 'bumper') {
          // Glowing bumper circles
          c.fillStyle = '#ec4899';
          c.strokeStyle = '#ffffff';
          c.lineWidth = 1;
          c.beginPath();
          c.arc(pin.x, pin.y, pin.radius + 1.5, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        } else if (pin.type === 'heso-guide') {
          // Highlighted golden pins flanking Heso
          c.fillStyle = '#fbbf24';
          c.strokeStyle = '#d97706';
          c.lineWidth = 1.2;
          c.beginPath();
          c.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        } else {
          // Brass physical metallic pins
          c.fillStyle = '#d97706';
          c.shadowColor = 'black';
          c.shadowBlur = 1;
          c.beginPath();
          c.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
          c.fill();
          c.shadowBlur = 0; // Reset shadow
        }
      });

      // Draw active metallic ball drops with deep hyper-realistic 3D rendering
      ballsRef.current.forEach((ball) => {
        // 1. Sleek Drop shadow cast on the board for a gorgeous depth effect
        c.save();
        c.beginPath();
        c.arc(ball.x + 2.5, ball.y + 2.8, ball.radius - 0.2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0, 0, 0, 0.45)';
        c.shadowColor = 'rgba(0, 0, 0, 0.6)';
        c.shadowBlur = 3.5;
        c.fill();
        c.restore();

        // 2. Main glossy chrome sphere gradient
        c.save();
        c.beginPath();
        c.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);

        // Realistic metallic silver blend: highlight from top-left, wrapping to an ambient dark core,
        // then subtle white floor-bounce/rim highlight at bottom-right.
        const chromeGrad = c.createRadialGradient(
          ball.x - ball.radius * 0.35, 
          ball.y - ball.radius * 0.35, 
          0.1, 
          ball.x, 
          ball.y, 
          ball.radius
        );
        chromeGrad.addColorStop(0, '#ffffff');       // Core specular glare point
        chromeGrad.addColorStop(0.18, '#e2e8f0');    // High-key highlight
        chromeGrad.addColorStop(0.40, '#94a3b8');    // Pure heavy steel
        chromeGrad.addColorStop(0.72, '#334155');    // Specular dark contrast band (horizon)
        chromeGrad.addColorStop(0.90, '#1e293b');    // Deep shadows
        chromeGrad.addColorStop(0.97, '#e2e8f0');    // Ambient ground bounce illumination
        chromeGrad.addColorStop(1, '#0f172a');       // Sharp edge boundary

        c.fillStyle = chromeGrad;
        c.fill();

        // 3. Crisp focal white speckle sparkle (lens flare dot)
        c.beginPath();
        c.arc(ball.x - ball.radius * 0.4, ball.y - ball.radius * 0.4, ball.radius * 0.2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255, 255, 255, 0.95)';
        c.fill();

        // 4. Opposing specular mirror horizon arc highlight
        c.beginPath();
        c.arc(ball.x, ball.y, ball.radius * 0.75, Math.PI * 0.1, Math.PI * 0.5);
        c.strokeStyle = 'rgba(255, 255, 255, 0.20)';
        c.lineWidth = 0.5;
        c.stroke();

        c.restore();
      });

      // Draw active pocket bursts
      particles.forEach((p) => {
        c.fillStyle = p.color;
        c.fillRect(p.x, p.y, 2.5, 2.5);
      });
    };

    const docHesoWidth = (w: number, pulse: number) => {
      const target = w / 2 - 3 + pulse;
      return target > 1 ? target : 2;
    };

    updatePhysics();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationId);
    };
  }, [isShooting, shootingPower, isAttackerOpen, currentBallCount, particles]);

  return (
    <div className="relative rounded-3xl overflow-hidden border-[6px] border-red-600 bg-gradient-to-b from-red-800 via-slate-905 to-black shadow-[0_0_35px_rgba(239,68,68,0.4)] p-1.5 select-none transition-all duration-300">
      <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-black/95 rounded-full border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] z-20">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-ping" />
        <span className="text-[10px] font-sans font-black text-amber-300 uppercase tracking-widest drop-shadow">★ PREMIUM FEVER ★</span>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="block rounded-2xl mx-auto bg-slate-950"
        id="pachinko-board-canvas"
      />
    </div>
  );
};
