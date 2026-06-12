'use client';

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ name, avatarUrl, size = 40, className = '' }: Props) {
  const dim = { width: size, height: size };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={dim}
        className={`rounded-full object-cover border border-white/15 shrink-0 ${className}`}
      />
    );
  }
  const color = PALETTE[hashName(name) % PALETTE.length];
  const fontSize = Math.max(10, Math.round(size * 0.4));
  return (
    <div
      style={{ ...dim, background: color, fontSize }}
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 border border-white/15 ${className}`}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
