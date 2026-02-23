/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Info, Globe } from 'lucide-react';

// --- Constants ---
const WIN_SCORE = 1000;
const INITIAL_AMMO = {
  left: 20000,
  middle: 20000,
  right: 20000
};
const ENEMY_SPEED_BASE = 0.5;
const INTERCEPTOR_SPEED = 5;
const EXPLOSION_RADIUS_MAX = 40;
const EXPLOSION_DURATION = 60; // frames
const SCORE_PER_KILL = 20;

type Language = 'zh' | 'en';

interface Point {
  x: number;
  y: number;
}

interface GameObject extends Point {
  id: string;
}

interface Enemy extends GameObject {
  targetX: number;
  targetY: number;
  speed: number;
  isDestroyed: boolean;
}

interface Interceptor extends GameObject {
  destX: number;
  destY: number;
  startX: number;
  startY: number;
  progress: number; // 0 to 1
  isExploded: boolean;
}

interface Explosion extends Point {
  id: string;
  radius: number;
  timer: number;
}

interface Building extends Point {
  id: string;
  type: 'city' | 'battery';
  isDestroyed: boolean;
  batteryId?: 'left' | 'middle' | 'right';
}

const TRANSLATIONS = {
  zh: {
    title: 'Elsa新星防御',
    start: '开始游戏',
    win: '胜利！你成功保卫了地球',
    lose: '失败！所有防御塔已被摧毁',
    score: '得分',
    ammo: '弹药',
    replay: '再玩一次',
    howToPlay: '点击屏幕发射拦截导弹。预判敌方火箭的飞行轨迹！',
    targetScore: '目标得分: 1000'
  },
  en: {
    title: 'Elsa Nova Defense',
    start: 'Start Game',
    win: 'Victory! You saved the Earth',
    lose: 'Defeat! All batteries destroyed',
    score: 'Score',
    ammo: 'Ammo',
    replay: 'Play Again',
    howToPlay: 'Click to fire interceptors. Predict the enemy rocket path!',
    targetScore: 'Target Score: 1000'
  }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'win' | 'lose'>('menu');
  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState(INITIAL_AMMO);
  const [lang, setLang] = useState<Language>('zh');
  
  // Game Logic Refs
  const enemiesRef = useRef<Enemy[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const buildingsRef = useRef<Building[]>([]);
  const frameIdRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);

  const t = TRANSLATIONS[lang];

  // Initialize Buildings
  const initBuildings = useCallback((width: number, height: number) => {
    const groundY = height - 40;
    const padding = width * 0.1;
    const spacing = (width - 2 * padding) / 8;

    const buildings: Building[] = [
      { id: 'b-left', type: 'battery', batteryId: 'left', x: padding, y: groundY, isDestroyed: false },
      { id: 'c1', type: 'city', x: padding + spacing, y: groundY, isDestroyed: false },
      { id: 'c2', type: 'city', x: padding + 2 * spacing, y: groundY, isDestroyed: false },
      { id: 'c3', type: 'city', x: padding + 3 * spacing, y: groundY, isDestroyed: false },
      { id: 'b-mid', type: 'battery', batteryId: 'middle', x: padding + 4 * spacing, y: groundY, isDestroyed: false },
      { id: 'c4', type: 'city', x: padding + 5 * spacing, y: groundY, isDestroyed: false },
      { id: 'c5', type: 'city', x: padding + 6 * spacing, y: groundY, isDestroyed: false },
      { id: 'c6', type: 'city', x: padding + 7 * spacing, y: groundY, isDestroyed: false },
      { id: 'b-right', type: 'battery', batteryId: 'right', x: padding + 8 * spacing, y: groundY, isDestroyed: false },
    ];
    buildingsRef.current = buildings;
  }, []);

  const startGame = () => {
    setScore(0);
    setAmmo(INITIAL_AMMO);
    enemiesRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    if (canvasRef.current) {
      initBuildings(canvasRef.current.width, canvasRef.current.height);
    }
    setGameState('playing');
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Don't fire if clicking too low
    if (y > canvas.height - 60) return;

    // Find closest active battery with ammo
    const activeBatteries = buildingsRef.current.filter(b => b.type === 'battery' && !b.isDestroyed);
    let bestBattery: Building | null = null;
    let minDist = Infinity;

    activeBatteries.forEach(b => {
      const currentAmmo = ammo[b.batteryId as keyof typeof ammo];
      if (currentAmmo > 0) {
        const dist = Math.abs(b.x - x);
        if (dist < minDist) {
          minDist = dist;
          bestBattery = b;
        }
      }
    });

    if (bestBattery) {
      const bId = (bestBattery as Building).batteryId as keyof typeof ammo;
      const count = 3;
      setAmmo(prev => ({ ...prev, [bId]: Math.max(0, prev[bId] - count) }));

      for (let i = 0; i < count; i++) {
        // Spread the 3 shots slightly around the target
        const offsetX = (i - 1) * 15; 
        interceptorsRef.current.push({
          id: Math.random().toString(),
          x: (bestBattery as Building).x,
          y: (bestBattery as Building).y - 20,
          startX: (bestBattery as Building).x,
          startY: (bestBattery as Building).y - 20,
          destX: x + offsetX,
          destY: y,
          progress: 0,
          isExploded: false
        });
      }
    }
  };

  const update = (width: number, height: number) => {
    // Spawn enemies
    const now = Date.now();
    const spawnRate = Math.max(1000, 4000 - (score / 100) * 400);
    if (now - lastSpawnTimeRef.current > spawnRate) {
      const targets = buildingsRef.current.filter(b => !b.isDestroyed);
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        enemiesRef.current.push({
          id: Math.random().toString(),
          x: Math.random() * width,
          y: -20,
          targetX: target.x,
          targetY: target.y,
          speed: ENEMY_SPEED_BASE + (score / 500) * 0.5,
          isDestroyed: false
        });
      }
      lastSpawnTimeRef.current = now;
    }

    // Update Enemies
    enemiesRef.current.forEach(enemy => {
      const dx = enemy.targetX - enemy.x;
      const dy = enemy.targetY - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 5) {
        // Hit target
        enemy.isDestroyed = true;
        const hitBuilding = buildingsRef.current.find(b => b.x === enemy.targetX && b.y === enemy.targetY);
        if (hitBuilding) {
          hitBuilding.isDestroyed = true;
          // Create explosion at building
          explosionsRef.current.push({
            id: Math.random().toString(),
            x: hitBuilding.x,
            y: hitBuilding.y,
            radius: 0,
            timer: EXPLOSION_DURATION
          });
        }
      } else {
        enemy.x += (dx / dist) * enemy.speed;
        enemy.y += (dy / dist) * enemy.speed;
      }
    });
    enemiesRef.current = enemiesRef.current.filter(e => !e.isDestroyed);

    // Update Interceptors
    interceptorsRef.current.forEach(inter => {
      const dx = inter.destX - inter.startX;
      const dy = inter.destY - inter.startY;
      const totalDist = Math.sqrt(dx * dx + dy * dy);
      const speed = INTERCEPTOR_SPEED / totalDist;
      
      inter.progress += speed;
      inter.x = inter.startX + dx * inter.progress;
      inter.y = inter.startY + dy * inter.progress;

      if (inter.progress >= 1) {
        inter.isExploded = true;
        explosionsRef.current.push({
          id: Math.random().toString(),
          x: inter.destX,
          y: inter.destY,
          radius: 0,
          timer: EXPLOSION_DURATION
        });
      }
    });
    interceptorsRef.current = interceptorsRef.current.filter(i => !i.isExploded);

    // Update Explosions
    explosionsRef.current.forEach(exp => {
      exp.timer--;
      const half = EXPLOSION_DURATION / 2;
      if (exp.timer > half) {
        exp.radius = ((EXPLOSION_DURATION - exp.timer) / half) * EXPLOSION_RADIUS_MAX;
      } else {
        exp.radius = (exp.timer / half) * EXPLOSION_RADIUS_MAX;
      }

      // Check collision with enemies
      enemiesRef.current.forEach(enemy => {
        const dx = enemy.x - exp.x;
        const dy = enemy.y - exp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < exp.radius) {
          enemy.isDestroyed = true;
          setScore(s => s + SCORE_PER_KILL);
        }
      });
    });
    explosionsRef.current = explosionsRef.current.filter(e => e.timer > 0);

    // Check Win/Loss
    if (score >= WIN_SCORE) {
      setGameState('win');
    }
    const activeBatteries = buildingsRef.current.filter(b => b.type === 'battery' && !b.isDestroyed);
    if (activeBatteries.length === 0) {
      setGameState('lose');
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    // Draw Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, height - 40, width, 40);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height - 40);
    ctx.lineTo(width, height - 40);
    ctx.stroke();

    // Draw Buildings
    buildingsRef.current.forEach(b => {
      if (b.isDestroyed) {
        ctx.fillStyle = '#444';
        ctx.fillRect(b.x - 10, b.y - 5, 20, 5);
      } else {
        if (b.type === 'battery') {
          // Draw Hogwarts Castle Silhouette
          ctx.save();
          ctx.translate(b.x, b.y);
          
          // Shield Glow
          const shieldGrad = ctx.createRadialGradient(0, -20, 10, 0, -20, 40);
          shieldGrad.addColorStop(0, 'rgba(0, 255, 204, 0.1)');
          shieldGrad.addColorStop(1, 'rgba(0, 255, 204, 0)');
          ctx.fillStyle = shieldGrad;
          ctx.beginPath();
          ctx.arc(0, -20, 40, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#00ffcc';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#00ffcc';

          // Main keep
          ctx.fillRect(-15, -20, 30, 20);
          
          // Towers
          // Left tower
          ctx.fillRect(-20, -30, 8, 30);
          ctx.beginPath();
          ctx.moveTo(-22, -30);
          ctx.lineTo(-16, -45);
          ctx.lineTo(-10, -30);
          ctx.fill();

          // Right tower
          ctx.fillRect(12, -30, 8, 30);
          ctx.beginPath();
          ctx.moveTo(10, -30);
          ctx.lineTo(16, -45);
          ctx.lineTo(22, -30);
          ctx.fill();

          // Central spire
          ctx.fillRect(-3, -40, 6, 20);
          ctx.beginPath();
          ctx.moveTo(-5, -40);
          ctx.lineTo(0, -60);
          ctx.lineTo(5, -40);
          ctx.fill();

          ctx.restore();
        } else {
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(b.x - 12, b.y - 20, 24, 20);
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(b.x - 8, b.y - 15, 6, 6);
          ctx.fillRect(b.x + 2, b.y - 15, 6, 6);
        }
      }
    });

    // Helper to draw Nimbus 2000
    const drawBroomstick = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // 1. Twigs (The tail/straw part) - Golden brown
      ctx.fillStyle = '#c5a059';
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.quadraticCurveTo(-20, -8, -30, -10);
      ctx.lineTo(-30, 10);
      ctx.quadraticCurveTo(-20, 8, -15, 0);
      ctx.fill();

      // 2. Handle (Dark Mahogany wood)
      ctx.strokeStyle = '#4b2c20';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();

      // 3. Gold Band (Nimbus branding area)
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-15, -3);
      ctx.lineTo(-15, 3);
      ctx.stroke();

      ctx.restore();
    };

    // Draw Enemies
    enemiesRef.current.forEach(e => {
      // Draw a subtle trail
      ctx.strokeStyle = 'rgba(255, 68, 68, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const dx = e.targetX - e.x;
      const dy = e.targetY - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - (dx / dist) * 40, e.y - (dy / dist) * 40);
      ctx.stroke();
      
      // Draw Broomstick
      const angle = Math.atan2(dy, dx);
      drawBroomstick(ctx, e.x, e.y, angle);
    });

    // Draw Interceptors
    interceptorsRef.current.forEach(i => {
      // Draw trail
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(i.startX, i.startY);
      ctx.lineTo(i.x, i.y);
      ctx.stroke();

      // Draw Broomstick
      const dx = i.destX - i.startX;
      const dy = i.destY - i.startY;
      const angle = Math.atan2(dy, dx);
      drawBroomstick(ctx, i.x, i.y, angle);

      // Target X
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1;
      const s = 4;
      ctx.beginPath();
      ctx.moveTo(i.destX - s, i.destY - s);
      ctx.lineTo(i.destX + s, i.destY + s);
      ctx.moveTo(i.destX + s, i.destY - s);
      ctx.lineTo(i.destX - s, i.destY + s);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.4, 'rgba(255, 200, 0, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (gameState === 'menu') {
        initBuildings(canvas.width, canvas.height);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const loop = () => {
      if (gameState === 'playing') {
        update(canvas.width, canvas.height);
      }
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, canvas.width, canvas.height);
      frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameIdRef.current);
    };
  }, [gameState, score, ammo, initBuildings]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasClick}
        onTouchStart={handleCanvasClick}
        className="absolute inset-0 cursor-crosshair"
      />

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="bg-black/50 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-3">
            <Trophy className="text-yellow-400 w-5 h-5" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-mono">{t.score}</p>
              <p className="text-xl font-display font-bold text-white leading-none">{score}</p>
            </div>
          </div>
          <p className="text-[10px] text-white/30 font-mono ml-1">{t.targetScore}</p>
        </div>

        <div className="flex gap-4">
          {(['left', 'middle', 'right'] as const).map((pos) => (
            <div key={pos} className="bg-black/50 backdrop-blur-md border border-white/10 p-2 rounded-xl flex flex-col items-center min-w-[60px]">
              <p className="text-[9px] uppercase tracking-tighter text-white/40 font-mono mb-1">{pos}</p>
              <div className="flex items-center gap-1">
                <Shield className={`w-3 h-3 ${ammo[pos] > 0 ? 'text-emerald-400' : 'text-red-500'}`} />
                <span className="text-sm font-display font-bold">{ammo[pos]}</span>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
          className="pointer-events-auto bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors border border-white/10"
        >
          <Globe className="w-5 h-5 text-white/70" />
        </button>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'menu' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.h1 
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-5xl md:text-7xl font-display font-bold mb-4 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent"
            >
              {t.title}
            </motion.h1>
            <p className="text-white/60 max-w-md mb-8 leading-relaxed">
              {t.howToPlay}
            </p>
            <button
              onClick={startGame}
              className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <Target className="w-5 h-5" />
              {t.start}
            </button>
          </motion.div>
        )}

        {(gameState === 'win' || gameState === 'lose') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className={`mb-6 p-4 rounded-full ${gameState === 'win' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {gameState === 'win' ? (
                <Trophy className="w-16 h-16 text-emerald-400" />
              ) : (
                <Shield className="w-16 h-16 text-red-400" />
              )}
            </div>
            <h2 className="text-4xl font-display font-bold mb-2">
              {gameState === 'win' ? t.win : t.lose}
            </h2>
            <div className="mb-8">
              <p className="text-white/40 font-mono uppercase text-xs tracking-widest mb-1">{t.score}</p>
              <p className="text-5xl font-display font-bold text-white">{score}</p>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-white text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <RotateCcw className="w-5 h-5" />
              {t.replay}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Hint */}
      {gameState === 'playing' && score === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/40 text-sm bg-black/40 px-4 py-2 rounded-full border border-white/5"
        >
          <Info className="w-4 h-4" />
          {t.howToPlay}
        </motion.div>
      )}
    </div>
  );
}
