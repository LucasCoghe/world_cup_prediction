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

interface LeaderboardEntry {
  name: string;
  score: number;
}

export default function KeepyUppy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'over'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
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
  } | null>(null);
  const inputRef = useRef<{ pointerX: number | null }>({ pointerX: null });

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

  const startGame = useCallback(() => {
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
    };
    gameRef.current = g;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let frameCount = 0;

    function drawBackground() {
      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
      sky.addColorStop(0, '#1a3a5c');
      sky.addColorStop(0.6, '#2d5a3f');
      sky.addColorStop(1, '#1e5631');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, FLOOR_Y);

      // Stadium lights glow (top corners)
      for (const lx of [40, CANVAS_W - 40]) {
        const glow = ctx.createRadialGradient(lx, 0, 0, lx, 0, 120);
        glow.addColorStop(0, 'rgba(255,255,200,0.15)');
        glow.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, CANVAS_W, 150);
      }

      // Crowd silhouettes (back row)
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 0; x < CANVAS_W; x += 12) {
        const h = 18 + Math.sin(x * 0.5 + frameCount * 0.02) * 3;
        ctx.beginPath();
        ctx.arc(x + 6, 50 - h * 0.2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 3, 50 - h * 0.2 + 4, 6, h * 0.4);
      }

      // Grass floor with stripes
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#1b7a3d' : '#1e8c44';
        ctx.fillRect(0, FLOOR_Y + i * 5, CANVAS_W, 5);
      }

      // Pitch line
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      ctx.lineTo(CANVAS_W, FLOOR_Y);
      ctx.stroke();

      // Center circle (perspective)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(CANVAS_W / 2, FLOOR_Y + 10, 60, 8, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, FLOOR_Y + 10, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();

      // Goal net (back, subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      const goalL = CANVAS_W / 2 - 50;
      const goalR = CANVAS_W / 2 + 50;
      const goalTop = FLOOR_Y - 70;
      // posts
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(goalL, FLOOR_Y);
      ctx.lineTo(goalL, goalTop);
      ctx.lineTo(goalR, goalTop);
      ctx.lineTo(goalR, FLOOR_Y);
      ctx.stroke();
      // net lines
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
      // ball shadow (scales with height)
      const shadowScale = Math.max(0.3, 1 - (FLOOR_Y - y) / CANVAS_H);
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y - 2, BALL_R * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.3 * shadowScale})`;
      ctx.fill();
      // ball base
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#f0f0f0';
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // classic pentagon panels
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
          j === 0 ? ctx.moveTo(ppx, ppy) : ctx.lineTo(ppx, ppy);
        }
        ctx.closePath();
        ctx.fillStyle = '#222';
        ctx.fill();
      }
      // highlight
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, BALL_R * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      ctx.restore();
    }

    function drawPlayer(x: number) {
      ctx.save();
      const cx = x + PLAYER_W / 2;
      const baseY = PLAYER_Y;

      // Player shadow
      ctx.beginPath();
      ctx.ellipse(cx, FLOOR_Y - 1, 16, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();

      // Skin color
      const skin = '#f5d0a9';

      // Red socks
      ctx.fillStyle = '#cc0000';
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

      // Legs (white shorts visible)
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

      // White shorts
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - 10, baseY + 28);
      ctx.lineTo(cx + 10, baseY + 28);
      ctx.lineTo(cx + 8, baseY + 36);
      ctx.lineTo(cx - 8, baseY + 36);
      ctx.closePath();
      ctx.fill();

      // Red Belgium shirt (torso)
      ctx.fillStyle = '#cc0000';
      ctx.beginPath();
      ctx.moveTo(cx - 11, baseY + 14);
      ctx.lineTo(cx + 11, baseY + 14);
      ctx.lineTo(cx + 10, baseY + 30);
      ctx.lineTo(cx - 10, baseY + 30);
      ctx.closePath();
      ctx.fill();
      // Shirt border
      ctx.strokeStyle = '#990000';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Belgium tricolor collar detail
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 5, baseY + 13, 3, 3);
      ctx.fillStyle = '#fcd116';
      ctx.fillRect(cx - 2, baseY + 13, 4, 3);
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(cx + 2, baseY + 13, 3, 3);

      // #7 on shirt
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('7', cx, baseY + 26);

      // Arms (skin)
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3;
      // Left arm slightly back
      ctx.beginPath();
      ctx.moveTo(cx - 11, baseY + 16);
      ctx.lineTo(cx - 17, baseY + 26);
      ctx.stroke();
      // Right arm slightly forward
      ctx.beginPath();
      ctx.moveTo(cx + 11, baseY + 16);
      ctx.lineTo(cx + 17, baseY + 24);
      ctx.stroke();

      // Head
      ctx.beginPath();
      ctx.arc(cx, baseY + 8, 8, 0, Math.PI * 2);
      ctx.fillStyle = skin;
      ctx.fill();

      // KDB ginger hair
      ctx.fillStyle = '#d4721a';
      ctx.beginPath();
      ctx.arc(cx, baseY + 5, 8, Math.PI, 2 * Math.PI);
      ctx.fill();
      // Hair sides
      ctx.fillRect(cx - 8, baseY + 3, 3, 6);
      ctx.fillRect(cx + 5, baseY + 3, 3, 6);
      // Spiky top
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

      // Eyes
      ctx.fillStyle = '#333';
      ctx.fillRect(cx - 4, baseY + 7, 2, 2);
      ctx.fillRect(cx + 2, baseY + 7, 2, 2);

      ctx.restore();
    }

    function loop() {
      if (!gameRef.current) return;
      const state = gameRef.current;

      // Move player towards pointer/touch
      if (inputRef.current.pointerX !== null) {
        state.targetX = Math.max(0, Math.min(CANVAS_W - PLAYER_W, inputRef.current.pointerX - PLAYER_W / 2));
      }
      const dx = state.targetX - state.playerX;
      state.playerX += dx * 0.2;

      // Wind: changes direction randomly, gets stronger with score
      state.windTimer++;
      if (state.windTimer > 60 + Math.random() * 120) {
        const windStrength = WIND_BASE + state.score * WIND_INCREASE;
        state.wind = (Math.random() - 0.5) * 2 * windStrength;
        state.windTimer = 0;
      }

      // Ball physics
      state.ballVY += GRAVITY * state.speedMult;
      state.ballVX += state.wind;
      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      // Wall bouncing
      if (state.ballX - BALL_R < 0) {
        state.ballX = BALL_R;
        state.ballVX = Math.abs(state.ballVX);
      }
      if (state.ballX + BALL_R > CANVAS_W) {
        state.ballX = CANVAS_W - BALL_R;
        state.ballVX = -Math.abs(state.ballVX);
      }
      // Ceiling
      if (state.ballY - BALL_R < 0) {
        state.ballY = BALL_R;
        state.ballVY = Math.abs(state.ballVY) * 0.5;
      }

      // Collision with player
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

      // Floor = game over
      if (state.ballY + BALL_R >= FLOOR_Y) {
        setGameState('over');
        const finalScore = state.score;
        setHighScore(prev => Math.max(prev, finalScore));
        submitScore(finalScore);
        gameRef.current = null;
        return;
      }

      // Draw
      frameCount++;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      drawBackground();
      drawPlayer(state.playerX);
      drawBall(state.ballX, state.ballY);

      // Wind indicator
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

      // Score display
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(state.score), CANVAS_W / 2, 45);

      state.animId = requestAnimationFrame(loop);
    }

    g.animId = requestAnimationFrame(loop);

    return () => {
      if (gameRef.current) {
        cancelAnimationFrame(gameRef.current.animId);
        gameRef.current = null;
      }
    };
  }, [submitScore]);

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
      <p className="text-gray-400 text-sm">Beweeg KDB om de bal hoog te houden!</p>

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
            <div className="text-5xl mb-4">⚽</div>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-lg transition-colors"
            >
              Start
            </button>
            <p className="text-gray-400 text-xs mt-3">Sleep of gebruik pijltjestoetsen</p>
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
          </div>
        )}
      </div>

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
