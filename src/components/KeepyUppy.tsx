'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCosmetic } from '@/lib/cosmetics';

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
const SPEED_INCREASE = 0.012;
const WIND_BASE = 0.006;
const WIND_INCREASE = 0.002;
const STORAGE_KEY = 'keepie-uppie-custom-player';
const POWERUP_DURATION = 300;
const POWERUP_SPAWN_INTERVAL = 400;
const POWERUP_SPAWN_CHANCE = 0.4;
const POWERUP_R = 18;
const POWERUP_FALL_SPEED = 1.5;

type PowerUpType = 'wide' | 'slow' | 'magnet' | 'shield';

interface PowerUp {
  type: PowerUpType;
  x: number;
  y: number;
}

const POWERUP_COLORS: Record<PowerUpType, string> = {
  wide: '#22d3ee',
  slow: '#a78bfa',
  magnet: '#f472b6',
  shield: '#22c55e',
};

const POWERUP_ICONS: Record<PowerUpType, string> = {
  wide: '↔',
  slow: '⏳',
  magnet: '🧲',
  shield: '🛡️',
};

// === Ball Skins ===
interface BallSkin {
  id: string;
  name: string;
  unlockScore: number;
  description: string;
}

const BALL_SKINS: BallSkin[] = [
  { id: 'classic', name: 'Klassiek', unlockScore: 0, description: 'De standaard bal' },
  { id: 'gold', name: 'Gouden Bal', unlockScore: 15, description: "Ballon d'Or" },
  { id: 'fire', name: 'Vuurbal', unlockScore: 30, description: 'On fire!' },
  { id: 'ice', name: 'IJsbal', unlockScore: 50, description: 'Bevroren' },
  { id: 'galaxy', name: 'Galaxy', unlockScore: 75, description: 'Buitenaards' },
  { id: 'rainbow', name: 'Regenboog', unlockScore: 100, description: 'Legende' },
];

// === Cosmetics ===
interface CosmeticItem {
  id: string;
  name: string;
  unlockScore: number;
  description: string;
}

const COSMETICS: CosmeticItem[] = [
  { id: 'headband', name: 'Hoofdband', unlockScore: 15, description: 'Ninja style' },
  { id: 'armband', name: 'Aanvoerdersband', unlockScore: 30, description: 'De kapitein' },
  { id: 'golden_boots', name: 'Gouden Schoenen', unlockScore: 50, description: 'Gouden Schoen' },
  { id: 'fire_aura', name: 'Vuur Aura', unlockScore: 75, description: 'Onstopbaar' },
];

// === Milestones ===
const MILESTONES: { score: number; text: string; color: string }[] = [
  { score: 10, text: 'LEKKER!', color: '#22d3ee' },
  { score: 25, text: 'FENOMEEN!', color: '#a78bfa' },
  { score: 50, text: 'LEGENDE!', color: '#fbbf24' },
  { score: 75, text: 'BUITENAARDS!', color: '#f472b6' },
  { score: 100, text: 'G.O.A.T.!', color: '#ff4500' },
];

// === Particles ===
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const UNLOCKS_KEY = 'keepie-uppie-unlocks';

interface LeaderboardEntry {
  name: string;
  score: number;
  cosmetics?: { nameColor: string | null; rowStyle: string | null; title: string | null };
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

function drawBallWithSkin(ctx: CanvasRenderingContext2D, x: number, y: number, skinId: string, frameCount: number) {
  ctx.save();
  const shadowScale = Math.max(0.3, 1 - (FLOOR_Y - y) / CANVAS_H);
  ctx.beginPath();
  ctx.ellipse(x, FLOOR_Y - 2, BALL_R * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * shadowScale})`;
  ctx.fill();

  switch (skinId) {
    case 'gold': {
      const glow = ctx.createRadialGradient(x, y, BALL_R * 0.3, x, y, BALL_R * 1.5);
      glow.addColorStop(0, 'rgba(255,215,0,0.3)');
      glow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - BALL_R * 2, y - BALL_R * 2, BALL_R * 4, BALL_R * 4);
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      const gg = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, BALL_R);
      gg.addColorStop(0, '#fff7cc');
      gg.addColorStop(0.5, '#ffd700');
      gg.addColorStop(1, '#b8860b');
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, BALL_R * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
      break;
    }
    case 'fire': {
      const fg = ctx.createRadialGradient(x, y, BALL_R * 0.2, x, y, BALL_R * 2);
      fg.addColorStop(0, 'rgba(255,100,0,0.4)');
      fg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(x - BALL_R * 3, y - BALL_R * 3, BALL_R * 6, BALL_R * 6);
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      const fGrad = ctx.createRadialGradient(x, y, 2, x, y, BALL_R);
      fGrad.addColorStop(0, '#ffff00');
      fGrad.addColorStop(0.4, '#ff8c00');
      fGrad.addColorStop(1, '#ff4500');
      ctx.fillStyle = fGrad;
      ctx.fill();
      ctx.strokeStyle = '#cc3700';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const d = BALL_R + Math.random() * 6;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d - Math.random() * 4, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${100 + Math.random() * 155 | 0},0,${0.5 + Math.random() * 0.5})`;
        ctx.fill();
      }
      break;
    }
    case 'ice': {
      const ig = ctx.createRadialGradient(x, y, BALL_R * 0.3, x, y, BALL_R * 1.8);
      ig.addColorStop(0, 'rgba(185,242,255,0.3)');
      ig.addColorStop(1, 'rgba(185,242,255,0)');
      ctx.fillStyle = ig;
      ctx.fillRect(x - BALL_R * 2, y - BALL_R * 2, BALL_R * 4, BALL_R * 4);
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      const iGrad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, BALL_R);
      iGrad.addColorStop(0, '#ffffff');
      iGrad.addColorStop(0.3, '#b9f2ff');
      iGrad.addColorStop(0.7, '#7dd3fc');
      iGrad.addColorStop(1, '#0ea5e9');
      ctx.fillStyle = iGrad;
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6 + frameCount * 0.02;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * BALL_R * 0.9, y + Math.sin(a) * BALL_R * 0.9);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a = frameCount * 0.05 + i * 2;
        const sx = x + Math.cos(a) * BALL_R * 1.3;
        const sy = y + Math.sin(a) * BALL_R * 1.3;
        const ss = 2 + Math.sin(frameCount * 0.1 + i);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(sx - ss / 2, sy - 0.5, ss, 1);
        ctx.fillRect(sx - 0.5, sy - ss / 2, 1, ss);
      }
      break;
    }
    case 'galaxy': {
      const galG = ctx.createRadialGradient(x, y, BALL_R * 0.3, x, y, BALL_R * 1.5);
      galG.addColorStop(0, 'rgba(139,92,246,0.3)');
      galG.addColorStop(1, 'rgba(139,92,246,0)');
      ctx.fillStyle = galG;
      ctx.fillRect(x - BALL_R * 2, y - BALL_R * 2, BALL_R * 4, BALL_R * 4);
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      const gGrad = ctx.createRadialGradient(x, y, 1, x, y, BALL_R);
      gGrad.addColorStop(0, '#1e1b4b');
      gGrad.addColorStop(0.5, '#312e81');
      gGrad.addColorStop(1, '#4c1d95');
      ctx.fillStyle = gGrad;
      ctx.fill();
      ctx.strokeStyle = '#6d28d9';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, BALL_R - 1, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 12; i++) {
        const a = (i * 1.37 + frameCount * 0.008) % (Math.PI * 2);
        const r = (i * 3.7) % BALL_R;
        const brightness = 0.5 + Math.sin(frameCount * 0.1 + i) * 0.5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${brightness})`;
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'rainbow': {
      const hue = (frameCount * 3) % 360;
      const rbG = ctx.createRadialGradient(x, y, BALL_R * 0.5, x, y, BALL_R * 2);
      rbG.addColorStop(0, `hsla(${hue},100%,60%,0.3)`);
      rbG.addColorStop(1, `hsla(${hue},100%,60%,0)`);
      ctx.fillStyle = rbG;
      ctx.fillRect(x - BALL_R * 2, y - BALL_R * 2, BALL_R * 4, BALL_R * 4);
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      const rGrad = ctx.createLinearGradient(x - BALL_R, y - BALL_R, x + BALL_R, y + BALL_R);
      rGrad.addColorStop(0, `hsl(${hue},100%,60%)`);
      rGrad.addColorStop(0.25, `hsl(${(hue + 90) % 360},100%,60%)`);
      rGrad.addColorStop(0.5, `hsl(${(hue + 180) % 360},100%,60%)`);
      rGrad.addColorStop(0.75, `hsl(${(hue + 270) % 360},100%,60%)`);
      rGrad.addColorStop(1, `hsl(${hue},100%,60%)`);
      ctx.fillStyle = rGrad;
      ctx.fill();
      ctx.strokeStyle = `hsl(${(hue + 180) % 360},80%,40%)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, BALL_R * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      break;
    }
    default: {
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
          if (j === 0) ctx.moveTo(ppx, ppy); else ctx.lineTo(ppx, ppy);
        }
        ctx.closePath();
        ctx.fillStyle = '#222';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, BALL_R * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawPlayerOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  config: PlayerConfig,
  isKDB: boolean,
  activeCosmetics?: string[],
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

  // Boots
  const bootColor = activeCosmetics?.includes('golden_boots') ? '#ffd700' : '#1a1a1a';
  ctx.fillStyle = bootColor;
  ctx.beginPath();
  ctx.roundRect(cx - 14, baseY + 50, 10, 5, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 4, baseY + 50, 10, 5, 2);
  ctx.fill();
  if (activeCosmetics?.includes('golden_boots')) {
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(cx - 14, baseY + 50, 10, 5, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(cx + 4, baseY + 50, 10, 5, 2);
    ctx.stroke();
  }

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

  // Cosmetics
  if (activeCosmetics?.includes('headband')) {
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(cx - 9, baseY + 3, 18, 3);
    ctx.strokeStyle = '#990000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - 9, baseY + 3, 18, 3);
  }
  if (activeCosmetics?.includes('armband')) {
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(cx + 12, baseY + 17, 7, 5);
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 12, baseY + 17, 7, 5);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', cx + 15.5, baseY + 19.5);
  }
  if (activeCosmetics?.includes('fire_aura')) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 10;
      const fx = cx + Math.cos(a) * dist;
      const fy = baseY + 28 + Math.sin(a) * dist * 0.6;
      ctx.beginPath();
      ctx.arc(fx, fy, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${100 + Math.random() * 100 | 0},0,${0.3 + Math.random() * 0.4})`;
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawStaticScene(ctx: CanvasRenderingContext2D, config: PlayerConfig, isKDB: boolean, cosmetics?: string[]) {
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
  drawPlayerOnCanvas(ctx, playerX, PLAYER_Y, config, isKDB, cosmetics);
}

export default function KeepyUppy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'customize' | 'playing' | 'over'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [charMode, setCharMode] = useState<'kdb' | 'custom'>('kdb');
  const [selectedBall, setSelectedBall] = useState('classic');
  const [selectedCosmetics, setSelectedCosmetics] = useState<string[]>([]);
  const [allTimeBest, setAllTimeBest] = useState(0);
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
  const selectedBallRef = useRef('classic');
  const selectedCosmeticsRef = useRef<string[]>([]);

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
    powerUp: PowerUp | null;
    activePowerUp: PowerUpType | null;
    powerUpTimer: number;
    powerUpSpawnTimer: number;
    particles: Particle[];
    milestoneText: string | null;
    milestoneTimer: number;
    milestoneColor: string;
    ballSkin: string;
    cosmetics: string[];
    shieldActive: boolean;
    triggeredMilestones: Set<number>;
    ballTrail: { x: number; y: number }[];
  } | null>(null);
  const inputRef = useRef<{ pointerX: number | null }>({ pointerX: null });

  useEffect(() => { charModeRef.current = charMode; }, [charMode]);
  useEffect(() => { customConfigRef.current = customConfig; }, [customConfig]);
  useEffect(() => { selectedBallRef.current = selectedBall; }, [selectedBall]);
  useEffect(() => { selectedCosmeticsRef.current = selectedCosmetics; }, [selectedCosmetics]);

  // Load unlocks from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(UNLOCKS_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setAllTimeBest(data.bestEver || 0);
        setSelectedBall(data.selectedBall || 'classic');
        setSelectedCosmetics(data.selectedCosmetics || []);
        selectedBallRef.current = data.selectedBall || 'classic';
        selectedCosmeticsRef.current = data.selectedCosmetics || [];
      }
    } catch {}
  }, []);

  // Save unlocks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(UNLOCKS_KEY, JSON.stringify({
        bestEver: allTimeBest,
        selectedBall: selectedBall,
        selectedCosmetics: selectedCosmetics,
      }));
    } catch {}
  }, [allTimeBest, selectedBall, selectedCosmetics]);

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
    drawStaticScene(ctx, customConfig, false, selectedCosmetics);
  }, [gameState, customConfig, selectedCosmetics]);

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
      powerUp: null as PowerUp | null,
      activePowerUp: null as PowerUpType | null,
      powerUpTimer: 0,
      powerUpSpawnTimer: 0,
      particles: [] as Particle[],
      milestoneText: null as string | null,
      milestoneTimer: 0,
      milestoneColor: '#fff',
      ballSkin: selectedBallRef.current,
      cosmetics: [...selectedCosmeticsRef.current],
      shieldActive: false,
      triggeredMilestones: new Set<number>(),
      ballTrail: [] as { x: number; y: number }[],
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

    let lastTime = 0;

    function loop(timestamp: number) {
      if (!gameRef.current) return;
      const state = gameRef.current;

      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / (1000 / 60), 3);
      lastTime = timestamp;

      if (inputRef.current.pointerX !== null) {
        state.targetX = Math.max(0, Math.min(CANVAS_W - PLAYER_W, inputRef.current.pointerX - PLAYER_W / 2));
      }
      const dx = state.targetX - state.playerX;
      state.playerX += dx * (1 - Math.pow(0.3, dt));

      state.windTimer += dt;
      if (state.windTimer > 60 + Math.random() * 120) {
        const windStrength = WIND_BASE + state.score * WIND_INCREASE;
        state.wind = (Math.random() - 0.5) * 2 * windStrength;
        state.windTimer = 0;
      }

      // Power-up timer
      if (state.activePowerUp) {
        state.powerUpTimer -= dt;
        if (state.powerUpTimer <= 0) {
          state.activePowerUp = null;
          state.powerUpTimer = 0;
        }
      }

      // Power-up spawning
      state.powerUpSpawnTimer += dt;
      if (!state.powerUp && state.powerUpSpawnTimer > POWERUP_SPAWN_INTERVAL && state.score >= 3) {
        if (Math.random() < POWERUP_SPAWN_CHANCE) {
          const types: PowerUpType[] = ['wide', 'slow', 'magnet', 'shield'];
          state.powerUp = {
            type: types[Math.floor(Math.random() * types.length)],
            x: 30 + Math.random() * (CANVAS_W - 60),
            y: -POWERUP_R,
          };
        }
        state.powerUpSpawnTimer = 0;
      }

      // Power-up falling & collection
      if (state.powerUp) {
        state.powerUp.y += POWERUP_FALL_SPEED * dt;
        const pw = state.activePowerUp === 'wide' ? PLAYER_W * 2 : PLAYER_W;
        const pCX = state.playerX + PLAYER_W / 2;
        if (
          state.powerUp.y + POWERUP_R >= PLAYER_Y &&
          state.powerUp.x > pCX - pw / 2 - POWERUP_R &&
          state.powerUp.x < pCX + pw / 2 + POWERUP_R
        ) {
          if (state.powerUp.type === 'shield') {
            state.shieldActive = true;
          } else {
            state.activePowerUp = state.powerUp.type;
            state.powerUpTimer = POWERUP_DURATION;
          }
          state.powerUp = null;
        } else if (state.powerUp.y > FLOOR_Y) {
          state.powerUp = null;
        }
      }

      // Apply power-up effects
      const speedFactor = state.activePowerUp === 'slow' ? 0.5 : 1;
      const effectiveSpeedMult = state.speedMult * speedFactor;

      state.ballVY += GRAVITY * effectiveSpeedMult * dt;
      state.ballVX += state.wind * dt;
      if (state.activePowerUp === 'magnet') {
        const pCX = state.playerX + PLAYER_W / 2;
        const dist = pCX - state.ballX;
        const pullX = dist * 0.003;
        state.ballVX += pullX * dt;
        if (state.ballVY > 0) {
          state.ballVY *= 0.997;
        }
      }
      state.ballX += state.ballVX * dt;
      state.ballY += state.ballVY * dt;

      if (state.score >= 10) {
        state.ballTrail.push({ x: state.ballX, y: state.ballY });
        const maxTrail = Math.min(8 + Math.floor(state.score / 15) * 2, 20);
        while (state.ballTrail.length > maxTrail) state.ballTrail.shift();
      }

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

      const pw = state.activePowerUp === 'wide' ? PLAYER_W * 2 : PLAYER_W;
      const playerCX = state.playerX + PLAYER_W / 2;
      const playerTop = PLAYER_Y;
      const prevBallBottom = state.ballY + BALL_R - state.ballVY * dt;
      if (
        state.ballVY > 0 &&
        prevBallBottom <= playerTop + 16 &&
        state.ballY + BALL_R >= playerTop &&
        state.ballX > playerCX - pw / 2 - BALL_R &&
        state.ballX < playerCX + pw / 2 + BALL_R
      ) {
        state.ballVY = KICK_VY * effectiveSpeedMult;
        const offset = (state.ballX - playerCX) / (pw / 2);
        const chaos = Math.min(state.score * 0.08, 3);
        state.ballVX = offset * KICK_VX_FACTOR + (Math.random() - 0.5) * (1 + chaos);
        state.score++;
        state.speedMult = 1 + state.score * SPEED_INCREASE;
        setScore(state.score);

        const kickAccuracy = Math.abs(offset);
        if (kickAccuracy < 0.15) {
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            state.particles.push({
              x: state.ballX,
              y: playerTop,
              vx: Math.cos(angle) * 3,
              vy: Math.sin(angle) * 3 - 2,
              life: 20 + Math.random() * 15,
              maxLife: 35,
              color: '#fbbf24',
              size: 2 + Math.random() * 2,
            });
          }
        } else {
          for (let i = 0; i < 5; i++) {
            state.particles.push({
              x: state.ballX + (Math.random() - 0.5) * 10,
              y: playerTop,
              vx: (Math.random() - 0.5) * 3,
              vy: -Math.random() * 2 - 1,
              life: 15 + Math.random() * 10,
              maxLife: 25,
              color: '#ffffff',
              size: 1 + Math.random() * 1.5,
            });
          }
        }

        // Milestone check
        const milestone = MILESTONES.find(m => m.score === state.score);
        if (milestone && !state.triggeredMilestones.has(milestone.score)) {
          state.triggeredMilestones.add(milestone.score);
          state.milestoneText = milestone.text;
          state.milestoneColor = milestone.color;
          state.milestoneTimer = 120;
          const colors = [milestone.color, '#ffd700', '#ffffff', '#ff4500', '#22d3ee'];
          for (let i = 0; i < 40; i++) {
            state.particles.push({
              x: state.ballX,
              y: state.ballY,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8 - 3,
              life: 60 + Math.random() * 40,
              maxLife: 60 + Math.random() * 40,
              color: colors[Math.floor(Math.random() * colors.length)],
              size: 2 + Math.random() * 4,
            });
          }
        }
      }

      if (state.ballY + BALL_R >= FLOOR_Y) {
        if (state.shieldActive) {
          state.shieldActive = false;
          state.ballY = FLOOR_Y - BALL_R;
          state.ballVY = KICK_VY * 0.8;
          for (let i = 0; i < 15; i++) {
            state.particles.push({
              x: state.ballX + (Math.random() - 0.5) * 40,
              y: FLOOR_Y,
              vx: (Math.random() - 0.5) * 4,
              vy: -Math.random() * 5 - 2,
              life: 30 + Math.random() * 20,
              maxLife: 30 + Math.random() * 20,
              color: '#22c55e',
              size: 2 + Math.random() * 3,
            });
          }
        } else {
          for (let i = 0; i < 20; i++) {
            state.particles.push({
              x: state.ballX + (Math.random() - 0.5) * 20,
              y: FLOOR_Y,
              vx: (Math.random() - 0.5) * 6,
              vy: -Math.random() * 6 - 2,
              life: 30 + Math.random() * 20,
              maxLife: 50,
              color: i % 2 === 0 ? '#ef4444' : '#fbbf24',
              size: 2 + Math.random() * 3,
            });
          }

          frameCount++;
          ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
          drawBackground();
          drawPlayerOnCanvas(ctx, state.playerX, PLAYER_Y, state.playerConfig, state.isKDB, state.cosmetics);
          drawBallWithSkin(ctx, state.ballX, FLOOR_Y - BALL_R, state.ballSkin, frameCount);
          state.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life--;
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });

          setGameState('over');
          const finalScore = state.score;
          setHighScore(prev => Math.max(prev, finalScore));
          setAllTimeBest(prev => Math.max(prev, finalScore));
          submitScore(finalScore);
          gameRef.current = null;
          return;
        }
      }

      frameCount++;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      drawBackground();

      // Draw wide effect zone
      if (state.activePowerUp === 'wide') {
        ctx.save();
        const wideW = PLAYER_W * 2;
        const wideX = state.playerX + PLAYER_W / 2 - wideW / 2;
        ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.fillRect(wideX, PLAYER_Y, wideW, PLAYER_H);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(wideX, PLAYER_Y, wideW, PLAYER_H);
        ctx.restore();
      }

      // Draw magnet effect
      if (state.activePowerUp === 'magnet') {
        ctx.save();
        const mCX = state.playerX + PLAYER_W / 2;
        const magnetGlow = ctx.createRadialGradient(mCX, PLAYER_Y, PLAYER_W * 0.5, mCX, PLAYER_Y, PLAYER_W * 3);
        magnetGlow.addColorStop(0, 'rgba(244, 114, 182, 0.15)');
        magnetGlow.addColorStop(1, 'rgba(244, 114, 182, 0)');
        ctx.fillStyle = magnetGlow;
        ctx.fillRect(0, PLAYER_Y - PLAYER_W * 3, CANVAS_W, PLAYER_W * 6);
        ctx.strokeStyle = `rgba(244, 114, 182, ${0.2 + Math.sin(frameCount * 0.1) * 0.1})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(mCX, PLAYER_Y);
        ctx.lineTo(state.ballX, state.ballY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Shield floor indicator
      if (state.shieldActive) {
        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.1) * 0.3;
        ctx.beginPath();
        ctx.moveTo(0, FLOOR_Y);
        ctx.lineTo(CANVAS_W, FLOOR_Y);
        ctx.stroke();
        const shieldGlow = ctx.createLinearGradient(0, FLOOR_Y - 15, 0, FLOOR_Y);
        shieldGlow.addColorStop(0, 'rgba(34,197,94,0)');
        shieldGlow.addColorStop(1, 'rgba(34,197,94,0.15)');
        ctx.fillStyle = shieldGlow;
        ctx.fillRect(0, FLOOR_Y - 15, CANVAS_W, 15);
        ctx.restore();
      }

      drawPlayerOnCanvas(ctx, state.playerX, PLAYER_Y, state.playerConfig, state.isKDB, state.cosmetics);

      if (state.ballTrail.length > 1) {
        ctx.save();
        for (let i = 0; i < state.ballTrail.length - 1; i++) {
          const t = state.ballTrail[i];
          const alpha = (i / state.ballTrail.length) * 0.3;
          const size = BALL_R * (0.3 + (i / state.ballTrail.length) * 0.5);
          ctx.beginPath();
          ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
          ctx.fillStyle = state.ballSkin === 'fire' ? `rgba(255,100,0,${alpha})`
            : state.ballSkin === 'ice' ? `rgba(135,206,250,${alpha})`
            : state.ballSkin === 'gold' ? `rgba(255,215,0,${alpha})`
            : state.ballSkin === 'galaxy' ? `rgba(139,92,246,${alpha})`
            : state.ballSkin === 'rainbow' ? `hsla(${(frameCount * 3 + i * 30) % 360},100%,60%,${alpha})`
            : `rgba(200,200,200,${alpha})`;
          ctx.fill();
        }
        ctx.restore();
      }

      drawBallWithSkin(ctx, state.ballX, state.ballY, state.ballSkin, frameCount);

      // Update and render particles
      state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life--;
        if (p.life <= 0) return false;
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      });

      // Milestone text
      if (state.milestoneText && state.milestoneTimer > 0) {
        state.milestoneTimer--;
        const progress = state.milestoneTimer / 120;
        const scale = progress > 0.8 ? 1 + (1 - (progress - 0.8) / 0.2) * 0.5 : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(progress * 2, 1);
        ctx.font = `bold ${Math.round(36 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = state.milestoneColor;
        ctx.shadowColor = state.milestoneColor;
        ctx.shadowBlur = 20;
        ctx.fillText(state.milestoneText, CANVAS_W / 2, CANVAS_H / 3);
        ctx.restore();
        if (state.milestoneTimer <= 0) state.milestoneText = null;
      }

      // Draw falling power-up
      if (state.powerUp) {
        ctx.save();
        const pu = state.powerUp;
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, POWERUP_R, 0, Math.PI * 2);
        ctx.fillStyle = POWERUP_COLORS[pu.type];
        ctx.globalAlpha = 0.8 + Math.sin(frameCount * 0.1) * 0.2;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(POWERUP_ICONS[pu.type], pu.x, pu.y);
        ctx.restore();
      }

      // Draw active power-up indicator
      if (state.activePowerUp) {
        ctx.save();
        const barW = 100;
        const barH = 8;
        const barX = CANVAS_W / 2 - barW / 2;
        const barY = 60;
        const progress = state.powerUpTimer / POWERUP_DURATION;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 4);
        ctx.fill();
        ctx.fillStyle = POWERUP_COLORS[state.activePowerUp];
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * progress, barH, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(POWERUP_ICONS[state.activePowerUp], barX - 12, barY + barH - 1);
        ctx.restore();
      }

      // Shield active indicator
      if (state.shieldActive) {
        ctx.save();
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.8;
        ctx.fillText('🛡️ SHIELD', CANVAS_W - 10, 45);
        ctx.restore();
      }

      if (Math.abs(state.wind) > 0.005) {
        ctx.save();
        ctx.globalAlpha = Math.min(Math.abs(state.wind) * 8, 0.7);
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        const windArrow = state.wind > 0 ? '>>>' : '<<<';
        ctx.fillText(windArrow, CANVAS_W / 2, 85);
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

        {gameState === 'over' && (() => {
          const best = Math.max(allTimeBest, score);
          const newUnlocks = [
            ...BALL_SKINS.filter(s => s.unlockScore > allTimeBest && s.unlockScore <= best),
            ...COSMETICS.filter(c => c.unlockScore > allTimeBest && c.unlockScore <= best),
          ];
          return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
              <p className="text-red-400 text-xl font-bold mb-1">Game Over!</p>
              <p className="text-white text-4xl font-bold mb-1">{score}</p>
              <p className="text-gray-400 text-sm mb-2">
                {score > highScore ? 'Nieuw record!' : `Record: ${Math.max(highScore, score)}`}
              </p>
              {newUnlocks.length > 0 && (
                <div className="mb-3 text-center">
                  <p className="text-yellow-400 text-sm font-bold mb-1">Nieuw unlocked!</p>
                  {newUnlocks.map(u => (
                    <p key={u.name} className="text-yellow-300 text-xs">{u.name}</p>
                  ))}
                </div>
              )}
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
          );
        })()}
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

          {/* Ball Skins */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Bal</p>
            <div className="grid grid-cols-3 gap-1.5">
              {BALL_SKINS.map(skin => {
                const unlocked = allTimeBest >= skin.unlockScore;
                return (
                  <button
                    key={skin.id}
                    onClick={() => unlocked && setSelectedBall(skin.id)}
                    className={`px-2 py-2 rounded-lg text-xs transition-all ${
                      !unlocked
                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                        : selectedBall === skin.id
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                    disabled={!unlocked}
                    title={unlocked ? skin.description : `Unlock bij ${skin.unlockScore} punten`}
                  >
                    {unlocked ? skin.name : `🔒 ${skin.unlockScore}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cosmetics */}
          <div>
            <p className="text-gray-400 text-xs mb-1.5 font-medium">Accessoires</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COSMETICS.map(item => {
                const unlocked = allTimeBest >= item.unlockScore;
                const active = selectedCosmetics.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!unlocked) return;
                      setSelectedCosmetics(prev =>
                        prev.includes(item.id) ? prev.filter(c => c !== item.id) : [...prev, item.id]
                      );
                    }}
                    className={`px-2 py-2 rounded-lg text-xs transition-all ${
                      !unlocked
                        ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                        : active
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                    disabled={!unlocked}
                    title={unlocked ? item.description : `Unlock bij ${item.unlockScore} punten`}
                  >
                    {unlocked ? (active ? `✓ ${item.name}` : item.name) : `🔒 ${item.unlockScore}`}
                  </button>
                );
              })}
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
            leaderboard.map((entry, i) => {
              const nameCos = getCosmetic(entry.cosmetics?.nameColor);
              const rowCos = getCosmetic(entry.cosmetics?.rowStyle);
              const titleCos = getCosmetic(entry.cosmetics?.title);
              return (
                <div key={i} className={`flex justify-between items-center px-3 py-2 ${i % 2 === 0 ? 'bg-white/5' : ''} ${rowCos?.rowClassName ?? ''}`}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-500 inline-block w-5 text-right shrink-0">{i + 1}.</span>
                    <span className="flex flex-col min-w-0">
                      {titleCos?.title && <span className="cos-title leading-tight">{titleCos.title}</span>}
                      <span className={`truncate ${nameCos?.nameClassName ?? 'text-gray-300'}`}>{entry.name}</span>
                    </span>
                  </span>
                  <span className="text-yellow-400 font-bold shrink-0 ml-2">{entry.score}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
