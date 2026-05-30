'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const CANVAS_W = 360;
const CANVAS_H = 540;
const GRAVITY = 0.35;
const BALL_R = 14;
const PLAYER_W = 38;
const PLAYER_H = 56;
const KICK_VY = -9.5;
const KICK_VX_FACTOR = 4;
const FLOOR_Y = CANVAS_H - 20;
const PLAYER_Y = FLOOR_Y - PLAYER_H;
const SPEED_INCREASE = 0.03;
const WIND_BASE = 0.02;
const WIND_INCREASE = 0.008;
const STORAGE_KEY = 'keepie-uppie-custom-player';

interface LeaderboardEntry {
  name: string;
  score: number;
}

type HairStyle = 'spiky' | 'short' | 'buzz' | 'curly' | 'mohawk';

interface PlayerConfig {
  skinColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  shirtColor: string;
  shortsColor: string;
  socksColor: string;
  number: string;
}

const KDB_CONFIG: PlayerConfig = {
  skinColor: '#f5d0a9',
  hairStyle: 'spiky',
  hairColor: '#d4721a',
  shirtColor: '#cc0000',
  shortsColor: '#ffffff',
  socksColor: '#cc0000',
  number: '7',
};

const DEFAULT_CUSTOM: PlayerConfig = {
  skinColor: '#c68642',
  hairStyle: 'short',
  hairColor: '#2c1b0e',
  shirtColor: '#2563eb',
  shortsColor: '#ffffff',
  socksColor: '#2563eb',
  number: '10',
};

const SKIN_COLORS = ['#fde7c8', '#f5d0a9', '#c68642', '#8d5524', '#5c3317'];
const HAIR_COLORS = ['#ffd700', '#d4721a', '#8b4513', '#2c1b0e', '#1a1a1a', '#c0c0c0', '#cc0000', '#2563eb'];
const SHIRT_COLORS = ['#cc0000', '#2563eb', '#16a34a', '#fbbf24', '#ffffff', '#1a1a1a', '#f97316', '#8b5cf6', '#ec4899'];
const SHORTS_COLORS = ['#ffffff', '#1a1a1a', '#cc0000', '#2563eb', '#16a34a', '#fbbf24'];
const SOCKS_COLORS = ['#cc0000', '#2563eb', '#16a34a', '#fbbf24', '#ffffff', '#1a1a1a'];
const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'spiky', label: 'Spiky' },
  { id: 'short', label: 'Kort' },
  { id: 'buzz', label: 'Buzz' },
  { id: 'curly', label: 'Krullen' },
  { id: 'mohawk', label: 'Mohawk' },
];
const NUMBERS = ['1', '7', '9', '10', '11', '14', '23'];

function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#1a1a1a' : '#ffffff';
}

function drawHair(ctx: CanvasRenderingContext2D, cx: number, baseY: number, style: HairStyle, color: string) {
  ctx.fillStyle = color;
  switch (style) {
    case 'spiky': {
      ctx.beginPath();
      ctx.arc(cx, baseY + 5, 8, Math.PI, 2 * Math.PI);
      ctx.fill();
      ctx.fillRect(cx - 8, baseY + 3, 3, 6);
      ctx.fillRect(cx + 5, baseY + 3, 3, 6);
      ctx.beginPath();
      ctx.moveTo(cx - 5, baseY - 2);
      ctx.lineTo(cx - 2, baseY - 4);
      ctx.lineTo(cx + 1, baseY - 3);
      ctx.lineTo(cx + 4, baseY - 5);
      ctx.lineTo(cx + 6, baseY - 1);
      ctx.lineTo(cx + 7, baseY + 2);
      ctx.lineTo(cx - 7, baseY + 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'short': {
      ctx.beginPath();
      ctx.arc(cx, baseY + 5, 8.5, Math.PI, 2 * Math.PI);
      ctx.fill();
      ctx.fillRect(cx - 8, baseY + 3, 3, 5);
      ctx.fillRect(cx + 5, baseY + 3, 3, 5);
      break;
    }
    case 'buzz': {
      ctx.beginPath();
      ctx.arc(cx, baseY + 5, 8.2, Math.PI + 0.3, 2 * Math.PI - 0.3);
      ctx.fill();
      break;
    }
    case 'curly': {
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + (i / 7) * Math.PI;
        const bx = cx + Math.cos(a) * 10;
        const by = baseY + 3 + Math.sin(a) * 8;
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        const bx = cx - 8 + i * 4;
        ctx.beginPath();
        ctx.arc(bx, baseY - 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'mohawk': {
      ctx.beginPath();
      ctx.moveTo(cx - 3, baseY + 5);
      ctx.lineTo(cx - 4, baseY - 6);
      ctx.lineTo(cx - 1, baseY - 8);
      ctx.lineTo(cx + 1, baseY - 8);
      ctx.lineTo(cx + 4, baseY - 6);
      ctx.lineTo(cx + 3, baseY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, baseY + 5, 8.2, Math.PI + 0.5, 2 * Math.PI - 0.5);
      ctx.fill();
      break;
    }
  }
}

function drawPlayerOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  config: PlayerConfig,
  isKDB: boolean,
) {
  ctx.save();
  const cx = x + PLAYER_W / 2;
  const skin = config.skinColor;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(cx, baseY + PLAYER_H - 1, 16, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  // Socks
  ctx.fillStyle = config.socksColor;
  ctx.fillRect(cx - 11, baseY + 44, 5, 8);
  ctx.fillRect(cx + 6, baseY + 44, 5, 8);

  // Black boots
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.roundRect(cx - 14, baseY + 50, 10, 5, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 4, baseY + 50, 10, 5, 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = skin;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 2, baseY + 34);
  ctx.lineTo(cx - 9, baseY + 46);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 2, baseY + 34);
  ctx.lineTo(cx + 9, baseY + 46);
  ctx.stroke();

  // Shorts
  ctx.fillStyle = config.shortsColor;
  ctx.beginPath();
  ctx.moveTo(cx - 10, baseY + 28);
  ctx.lineTo(cx + 10, baseY + 28);
  ctx.lineTo(cx + 8, baseY + 36);
  ctx.lineTo(cx - 8, baseY + 36);
  ctx.closePath();
  ctx.fill();

  // Shirt
  ctx.fillStyle = config.shirtColor;
  ctx.beginPath();
  ctx.moveTo(cx - 11, baseY + 14);
  ctx.lineTo(cx + 11, baseY + 14);
  ctx.lineTo(cx + 10, baseY + 30);
  ctx.lineTo(cx - 10, baseY + 30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darkenColor(config.shirtColor, 0.2);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Collar
  if (isKDB) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(cx - 5, baseY + 13, 3, 3);
    ctx.fillStyle = '#fcd116';
    ctx.fillRect(cx - 2, baseY + 13, 4, 3);
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(cx + 2, baseY + 13, 3, 3);
  } else {
    ctx.strokeStyle = darkenColor(config.shirtColor, 0.3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, baseY + 14);
    ctx.lineTo(cx, baseY + 16);
    ctx.lineTo(cx + 5, baseY + 14);
    ctx.stroke();
  }

  // Number
  ctx.fillStyle = getContrastColor(config.shirtColor);
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(config.number, cx, baseY + 26);

  // Arms
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 11, baseY + 16);
  ctx.lineTo(cx - 17, baseY + 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 11, baseY + 16);
  ctx.lineTo(cx + 17, baseY + 24);
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(cx, baseY + 8, 8, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  // Hair
  drawHair(ctx, cx, baseY, config.hairStyle, config.hairColor);

  // Eyes
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - 4, baseY + 7, 2, 2);
  ctx.fillRect(cx + 2, baseY + 7, 2, 2);

  ctx.restore();
}

function drawStaticScene(ctx: CanvasRenderingContext2D, config: PlayerConfig, isKDB: boolean) {
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, '#1a3a5c');
  sky.addColorStop(0.6, '#2d5a3f');
  sky.addColorStop(1, '#1e5631');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, FLOOR_Y);

  // Stadium lights glow
  for (const lx of [40, CANVAS_W - 40]) {
    const glow = ctx.createRadialGradient(lx, 0, 0, lx, 0, 120);
    glow.addColorStop(0, 'rgba(255,255,200,0.15)');
    glow.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, 150);
  }

  // Grass
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1b7a3d' : '#1e8c44';
    ctx.fillRect(0, FLOOR_Y + i * 5, CANVAS_W, 5);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y);
  ctx.lineTo(CANVAS_W, FLOOR_Y);
  ctx.stroke();

  // Center circle
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(CANVAS_W / 2, FLOOR_Y + 10, 60, 8, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Goal net
  const goalL = CANVAS_W / 2 - 50;
  const goalR = CANVAS_W / 2 + 50;
  const goalTop = FLOOR_Y - 70;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(goalL, FLOOR_Y);
  ctx.lineTo(goalL, goalTop);
  ctx.lineTo(goalR, goalTop);
  ctx.lineTo(goalR, FLOOR_Y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = goalL + 8; x < goalR; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, goalTop);
    ctx.lineTo(x, FLOOR_Y);
    ctx.stroke();
  }
  for (let y = goalTop + 10; y < FLOOR_Y; y += 10) {
    ctx.beginPath();
    ctx.moveTo(goalL, y);
    ctx.lineTo(goalR, y);
    ctx.stroke();
  }

  const playerX = CANVAS_W / 2 - PLAYER_W / 2;
  drawPlayerOnCanvas(ctx, playerX, PLAYER_Y, config, isKDB);
}

export default function KeepyUppy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'customize' | 'playing' | 'over'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [charMode, setCharMode] = useState<'kdb' | 'custom'>('kdb');
  const [customConfig, setCustomConfig] = useState<PlayerConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_CUSTOM;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CUSTOM;
  });

  const charModeRef = useRef<'kdb' | 'custom'>('kdb');
  const customConfigRef = useRef<PlayerConfig>(customConfig);

  const gameRef = useRef<{
    ballX: number;
    ballY: number;
    ballVX: number;
    ballVY: number;
    playerX: number;
    targetX: number;
    score: number;
    animId: number;
    speedMult: number;
    wind: number;
    windTimer: number;
    playerConfig: PlayerConfig;
    isKDB: boolean;
  } | null>(null);
  const inputRef = useRef<{ pointerX: number | null }>({ pointerX: null });

  useEffect(() => { charModeRef.current = charMode; }, [charMode]);
  useEffect(() => { customConfigRef.current = customConfig; }, [customConfig]);

  // Save custom config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customConfig));
    } catch {}
  }, [customConfig]);

  // Draw preview when customizing
  useEffect(() => {
    if (gameState !== 'customize') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawStaticScene(ctx, customConfig, false);
  }, [gameState, customConfig]);

  const fetchLeaderboard = useCallback(() => {
    fetch('/api/minigame')
      .then(r => r.json())
      .then(data => {
        setLeaderboard(data.leaderboard || []);
        if (data.personalBest != null) setPersonalBest(data.personalBest);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const submitScore = useCallback((s: number) => {
    if (s <= 0) return;
    fetch('/api/minigame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: s }),
    }).then(() => fetchLeaderboard());
  }, [fetchLeaderboard]);

  const updateConfig = useCallback(<K extends keyof PlayerConfig>(key: K, value: PlayerConfig[K]) => {
    setCustomConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const startGame = useCallback(() => {
    const config = charModeRef.current === 'kdb' ? { ...KDB_CONFIG } : { ...customConfigRef.current };
    const isKDB = charModeRef.current === 'kdb';

    setGameState('playing');
    setScore(0);
    const g = {
      ballX: CANVAS_W / 2,
      ballY: CANVAS_H / 3,
      ballVX: (Math.random() - 0.5) * 3,
      ballVY: 0,
      playerX: CANVAS_W / 2 - PLAYER_W / 2,
      targetX: CANVAS_W / 2 - PLAYER_W / 2,
      score: 0,
      animId: 0,
      speedMult: 1,
      wind: 0,
      windTimer: 0,
      playerConfig: config,
      isKDB,
    };
    gameRef.current = g;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let frameCount = 0;

    function drawBackground() {
      const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
      sky.addColorStop(0, '#1a3a5c');
      sky.addColorStop(0.6, '#2d5a3f');
      sky.addColorStop(1, '#1e5631');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, FLOOR_Y);

      for (const lx of [40, CANVAS_W - 40]) {
        const glow = ctx.createRadialGradient(lx, 0, 0, lx, 0, 120);
        glow.addColorStop(0, 'rgba(255,255,200,0.15)');
        glow.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, CANVAS_W, 150);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 0; x < CANVAS_W; x += 12) {
        const h = 18 + Math.sin(x * 0.5 + frameCount * 0.02) * 3;
        ctx.beginPath();
        ctx.arc(x + 6, 50 - h * 0.2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 3, 50 - h * 0.2 + 4, 6, h * 0.4);
      }

      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#1b7a3d' : '#1e8c44';
        ctx.fillRect(0, FLOOR_Y + i * 5, CANVAS_W, 5);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      ctx.lineTo(CANVAS_W, FLOOR_Y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(CANVAS_W / 2, FLOOR_Y + 10, 60, 8, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, FLOOR_Y + 10, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      const goalL = CANVAS_W / 2 - 50;
      const goalR = CANVAS_W / 2 + 50;
      const goalTop = FLOOR_Y - 70;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(goalL, FLOOR_Y);
      ctx.lineTo(goalL, goalTop);
      ctx.lineTo(goalR, goalTop);
      ctx.lineTo(goalR, FLOOR_Y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = goalL + 8; x < goalR; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, goalTop);
        ctx.lineTo(x, FLOOR_Y);
        ctx.stroke();
      }
      for (let y = goalTop + 10; y < FLOOR_Y; y += 10) {
        ctx.beginPath();
        ctx.moveTo(goalL, y);
        ctx.lineTo(goalR, y);
        ctx.stroke();
      }
    }

    function drawBall(x: number, y: number) {
      ctx.save();
      const shadowScale = Math.max(0.3, 1 - (FLOOR_Y - y) / CANVAS_H);
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y - 2, BALL_R * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.3 * shadowScale})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#f0f0f0';
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const rot = frameCount * 0.05;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 + rot;
        const pcx = x + Math.cos(a) * BALL_R * 0.5;
        const pcy = y + Math.sin(a) * BALL_R * 0.5;
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const pa = (j * Math.PI * 2) / 5 + a;
          const ppx = pcx + Math.cos(pa) * BALL_R * 0.25;
          const ppy = pcy + Math.sin(pa) * BALL_R * 0.25;
          if (j === 0) { ctx.moveTo(ppx, ppy); } else { ctx.lineTo(ppx, ppy); }
        }
        ctx.closePath();
        ctx.fillStyle = '#222';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, BALL_R * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      ctx.restore();
    }

    function loop() {
      if (!gameRef.current) return;
      const state = gameRef.current;

      if (inputRef.current.pointerX !== null) {
        state.targetX = Math.max(0, Math.min(CANVAS_W - PLAYER_W, inputRef.current.pointerX - PLAYER_W / 2));
      }
      const dx = state.targetX - state.playerX;
      state.playerX += dx * 0.2;

      state.windTimer++;
      if (state.windTimer > 60 + Math.random() * 120) {
        const windStrength = WIND_BASE + state.score * WIND_INCREASE;
        state.wind = (Math.random() - 0.5) * 2 * windStrength;
        state.windTimer = 0;
      }

      state.ballVY += GRAVITY * state.speedMult;
      state.ballVX += state.wind;
      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      if (state.ballX - BALL_R < 0) {
        state.ballX = BALL_R;
        state.ballVX = Math.abs(state.ballVX);
      }
      if (state.ballX + BALL_R > CANVAS_W) {
        state.ballX = CANVAS_W - BALL_R;
        state.ballVX = -Math.abs(state.ballVX);
      }
      if (state.ballY - BALL_R < 0) {
        state.ballY = BALL_R;
        state.ballVY = Math.abs(state.ballVY) * 0.5;
      }

      const playerCX = state.playerX + PLAYER_W / 2;
      const playerTop = PLAYER_Y;
      if (
        state.ballVY > 0 &&
        state.ballY + BALL_R >= playerTop &&
        state.ballY + BALL_R <= playerTop + 16 &&
        state.ballX > state.playerX - BALL_R &&
        state.ballX < state.playerX + PLAYER_W + BALL_R
      ) {
        state.ballVY = KICK_VY * state.speedMult;
        const offset = (state.ballX - playerCX) / (PLAYER_W / 2);
        const chaos = Math.min(state.score * 0.15, 4);
        state.ballVX = offset * KICK_VX_FACTOR + (Math.random() - 0.5) * (1 + chaos);
        state.score++;
        state.speedMult = 1 + state.score * SPEED_INCREASE;
        setScore(state.score);
      }

      if (state.ballY + BALL_R >= FLOOR_Y) {
        setGameState('over');
        const finalScore = state.score;
        setHighScore(prev => Math.max(prev, finalScore));
        submitScore(finalScore);
        gameRef.current = null;
        return;
      }

      frameCount++;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      drawBackground();
      drawPlayerOnCanvas(ctx, state.playerX, PLAYER_Y, state.playerConfig, state.isKDB);
      drawBall(state.ballX, state.ballY);

      if (Math.abs(state.wind) > 0.005) {
        ctx.save();
        ctx.globalAlpha = Math.min(Math.abs(state.wind) * 8, 0.7);
        ctx.fillStyle = '#93c5fd';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        const windArrow = state.wind > 0 ? '>>>' : '<<<';
        ctx.fillText(windArrow, CANVAS_W / 2, 75);
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(state.score), CANVAS_W / 2, 45);

      state.animId = requestAnimationFrame(loop);
    }

    g.animId = requestAnimationFrame(loop);
  }, [submitScore]);

  const playKDB = useCallback(() => {
    setCharMode('kdb');
    charModeRef.current = 'kdb';
    startGame();
  }, [startGame]);

  const playCustom = useCallback(() => {
    setCharMode('custom');
    charModeRef.current = 'custom';
    startGame();
  }, [startGame]);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        cancelAnimationFrame(gameRef.current.animId);
        gameRef.current = null;
      }
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    inputRef.current.pointerX = (e.clientX - rect.left) * scaleX;
  }, [gameState]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    inputRef.current.pointerX = (e.clientX - rect.left) * scaleX;
  }, [gameState]);

  const handlePointerLeave = useCallback(() => {
    inputRef.current.pointerX = null;
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;
    function handleKey(e: KeyboardEvent) {
      if (!gameRef.current) return;
      const step = 20;
      if (e.key === 'ArrowLeft') {
        gameRef.current.targetX = Math.max(0, gameRef.current.playerX - step);
      } else if (e.key === 'ArrowRight') {
        gameRef.current.targetX = Math.min(CANVAS_W - PLAYER_W, gameRef.current.playerX + step);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState]);

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-bold text-white">Keepie-Uppie</h2>
      <p className="text-gray-400 text-sm">
        {gameState === 'customize' ? 'Pas je speler aan!' : 'Houd de bal in de lucht!'}
      </p>

      <div className="relative" style={{ width: '100%', maxWidth: CANVAS_W }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerLeave={handlePointerLeave}
          className="w-full rounded-xl border border-white/10"
          style={{ background: '#0a1628', touchAction: 'none', aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        />

        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl">
            <div className="text-5xl mb-2">&#9917;</div>
            <p className="text-white font-bold text-lg mb-4">Kies je speler</p>
            <div className="flex gap-3 mb-4">
              <button
                onClick={playKDB}
                className="flex flex-col items-center p-4 rounded-xl bg-red-900/60 border border-red-500/30 hover:bg-red-800/60 active:scale-95 transition-all min-w-[120px]"
              >
                <span className="text-2xl mb-1">&#127463;&#127466;</span>
                <span className="text-white font-bold text-sm">KDB</span>
                <span className="text-gray-300 text-xs">De Bruyne #7</span>
              </button>
              <button
                onClick={() => setGameState('customize')}
                className="flex flex-col items-center p-4 rounded-xl bg-blue-900/60 border border-blue-500/30 hover:bg-blue-800/60 active:scale-95 transition-all min-w-[120px]"
              >
                <span className="text-2xl mb-1">&#9998;</span>
                <span className="text-white font-bold text-sm">Eigen Speler</span>
                <span className="text-gray-300 text-xs">Personaliseer!</span>
              </button>
            </div>
            <p className="text-gray-500 text-xs">Sleep of gebruik pijltjestoetsen</p>
          </div>
        )}

        {gameState === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
            <p className="text-red-400 text-xl font-bold mb-1">Game Over!</p>
            <p className="text-white text-4xl font-bold mb-1">{score}</p>
            <p className="text-gray-400 text-sm mb-4">
              {score > highScore ? 'Nieuw record!' : `Record: ${Math.max(highScore, score)}`}
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-lg transition-colors"
            >
              Opnieuw
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="text-gray-400 hover:text-white text-xs mt-3 underline transition-colors"
            >
              Andere speler
            </button>
          </div>
        )}
      </div>

      {/* Character customization panel */}
      {gameState === 'customize' && (
        <div className="w-full max-w-sm space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setGameState('menu')}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              &larr; Terug
            </button>
            <button
              onClick={playCustom}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors"
            >
              Speel!
            </button>
          </div>

          {/* Skin */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Huidskleur</p>
            <div className="flex gap-2 flex-wrap">
              {SKIN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateConfig('skinColor', c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    customConfig.skinColor === c ? 'border-white scale-110' : 'border-white/20 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Hair style */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Kapsel</p>
            <div className="flex gap-1.5 flex-wrap">
              {HAIR_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => updateConfig('hairStyle', s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    customConfig.hairStyle === s.id
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hair color */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Haarkleur</p>
            <div className="flex gap-2 flex-wrap">
              {HAIR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateConfig('hairColor', c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    customConfig.hairColor === c ? 'border-white scale-110' : 'border-white/20 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Shirt */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Shirt</p>
            <div className="flex gap-2 flex-wrap">
              {SHIRT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateConfig('shirtColor', c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    customConfig.shirtColor === c ? 'border-white scale-110' : 'border-white/20 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Shorts */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Broek</p>
            <div className="flex gap-2 flex-wrap">
              {SHORTS_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateConfig('shortsColor', c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    customConfig.shortsColor === c ? 'border-white scale-110' : 'border-white/20 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Socks */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Kousen</p>
            <div className="flex gap-2 flex-wrap">
              {SOCKS_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateConfig('socksColor', c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    customConfig.socksColor === c ? 'border-white scale-110' : 'border-white/20 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Number */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Nummer</p>
            <div className="flex gap-1.5 flex-wrap">
              {NUMBERS.map(n => (
                <button
                  key={n}
                  onClick={() => updateConfig('number', n)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    customConfig.number === n
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom play button */}
          <button
            onClick={playCustom}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-lg transition-colors"
          >
            Speel!
          </button>
        </div>
      )}

      {/* Leaderboard */}
      <div className="w-full max-w-sm">
        <h3 className="text-lg font-bold text-white mb-2">Highscores</h3>
        {personalBest != null && (
          <p className="text-sm text-gray-400 mb-2">Jouw record: <span className="text-yellow-400 font-bold">{personalBest}</span></p>
        )}
        <div className="bg-white/5 rounded-lg overflow-hidden">
          {leaderboard.length === 0 ? (
            <p className="text-gray-500 text-sm p-3">Nog geen scores</p>
          ) : (
            leaderboard.map((entry, i) => (
              <div key={i} className={`flex justify-between px-3 py-2 ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                <span className="text-gray-300">
                  <span className="text-gray-500 mr-2 inline-block w-5 text-right">{i + 1}.</span>
                  {entry.name}
                </span>
                <span className="text-yellow-400 font-bold">{entry.score}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
