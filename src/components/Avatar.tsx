'use client';

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
        className={`rounded-full object-cover border border-gold/40 shrink-0 ${className}`}
      />
    );
  }
  const fontSize = Math.max(10, Math.round(size * 0.42));
  return (
    <div
      style={{
        ...dim,
        fontSize,
        background: 'radial-gradient(circle at 30% 25%, rgba(212,175,55,0.12), rgba(6,13,31,0.9) 75%)',
        color: '#f5d77a',
        textShadow: '0 0 8px rgba(212,175,55,0.35)',
      }}
      className={`rounded-full flex items-center justify-center font-bold shrink-0 border border-gold/40 tracking-wide ${className}`}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
