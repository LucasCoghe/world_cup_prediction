'use client';

import { useState, useEffect } from 'react';
import Avatar from './Avatar';

interface PintComment {
  id: string;
  message: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

interface PintEntry {
  id: string;
  reason: string;
  claimedAt: string | null;
  photoUrl: string;
  caption: string | null;
  drinker: { id: string; name: string; avatarUrl: string | null };
  comments: PintComment[];
}

interface Props {
  currentUserId: string;
}

function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v|3gp|3gpp|quicktime)(\?|$)/i.test(url);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${hh}:${mm}`;
}

export default function Schandpaal({ currentUserId }: Props) {
  const [pints, setPints] = useState<PintEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomedId, setZoomedId] = useState<string | null>(null);

  // Caption-editor
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);

  // Reacties
  const [commentDraft, setCommentDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch('/api/beers')
      .then(r => r.json())
      .then(data => {
        const all = (data.confirmations || []) as PintEntry[];
        setPints(all.filter(p => p.photoUrl).map(p => ({ ...p, comments: p.comments || [] })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const zoomed = pints.find(p => p.id === zoomedId) || null;

  function openPint(p: PintEntry) {
    setZoomedId(p.id);
    setEditingCaption(false);
    setCaptionDraft(p.caption || '');
    setCommentDraft('');
  }

  async function saveCaption() {
    if (!zoomed) return;
    setSavingCaption(true);
    try {
      const res = await fetch('/api/beers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'caption', pintId: zoomed.id, caption: captionDraft }),
      });
      const data = await res.json();
      if (data.ok) {
        setPints(prev => prev.map(p => (p.id === zoomed.id ? { ...p, caption: data.caption } : p)));
        setEditingCaption(false);
      }
    } finally {
      setSavingCaption(false);
    }
  }

  async function postComment() {
    if (!zoomed || !commentDraft.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/beers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', pintId: zoomed.id, message: commentDraft }),
      });
      const data = await res.json();
      if (data.ok && data.comment) {
        setPints(prev => prev.map(p => (p.id === zoomed.id ? { ...p, comments: [...p.comments, data.comment] } : p)));
        setCommentDraft('');
      }
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!zoomed) return;
    const res = await fetch('/api/beers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteComment', commentId }),
    });
    const data = await res.json();
    if (data.ok) {
      setPints(prev => prev.map(p => (p.id === zoomed.id ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p)));
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-12 text-lg">Laden...</div>;
  }

  const grouped = new Map<string, PintEntry[]>();
  for (const p of pints) {
    const list = grouped.get(p.drinker.id) || [];
    list.push(p);
    grouped.set(p.drinker.id, list);
  }
  const leaderboard = [...grouped.entries()]
    .map(([id, items]) => ({ id, name: items[0].drinker.name, avatarUrl: items[0].drinker.avatarUrl, count: items.length }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8 animate-in">
      <section>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">🍻 Bewijslast</h2>
        <p className="text-gray-500 text-sm mb-4">
          Alle pintjes die effectief gedronken zijn. Geen foto, geen pint geteld.
        </p>

        {pints.length === 0 ? (
          <div className="card text-center text-gray-500 py-8">
            Nog niemand heeft een pint bewezen. Dorst?
          </div>
        ) : (
          <>
            {leaderboard.length > 1 && (
              <div className="card mb-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-2">Top drinkers</h3>
                <div className="flex flex-wrap gap-2">
                  {leaderboard.map(d => (
                    <div key={d.id} className="flex items-center gap-2 bg-white/5 rounded-full pl-1 pr-3 py-1">
                      <Avatar name={d.name} avatarUrl={d.avatarUrl} size={24} />
                      <span className="text-sm text-white">{d.name}</span>
                      <span className="text-xs font-bold text-amber-300">×{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pints.map(p => (
                <button
                  key={p.id}
                  onClick={() => openPint(p)}
                  className="card !p-2 text-left hover:border-amber-600/60 transition group"
                >
                  <div className="aspect-square rounded overflow-hidden bg-black/40 mb-2 relative">
                    {isVideoUrl(p.photoUrl) ? (
                      <>
                        <video
                          src={p.photoUrl}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-white text-4xl drop-shadow pointer-events-none">▶</span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt={`Pint van ${p.drinker.name}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    )}
                    {p.comments.length > 0 && (
                      <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                        {p.comments.length} 💬
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Avatar name={p.drinker.name} avatarUrl={p.drinker.avatarUrl} size={20} />
                    <span className="text-xs font-semibold text-white truncate">{p.drinker.name}</span>
                  </div>
                  {p.caption && (
                    <div className="text-[11px] text-gray-300 italic truncate">“{p.caption}”</div>
                  )}
                  <div className="text-[10px] text-gray-500 truncate">{p.reason}</div>
                  <div className="text-[10px] text-gray-600">{formatDateTime(p.claimedAt)}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {zoomed && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-3 sm:p-4"
          onClick={() => setZoomedId(null)}
        >
          <div
            className="card !p-0 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomedId(null)}
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 text-gray-200 hover:text-white text-xl leading-none flex items-center justify-center"
              aria-label="Sluiten"
            >
              &times;
            </button>

            {/* Media — past altijd binnen het scherm, gecentreerd */}
            <div className="bg-black flex items-center justify-center shrink-0">
              {isVideoUrl(zoomed.photoUrl) ? (
                <video
                  src={zoomed.photoUrl}
                  className="max-h-[50vh] w-auto max-w-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={zoomed.photoUrl}
                  alt={`Pint van ${zoomed.drinker.name}`}
                  className="max-h-[50vh] w-auto max-w-full object-contain"
                />
              )}
            </div>

            {/* Body — scrollt intern */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              <div className="flex items-center gap-2 text-white">
                <Avatar name={zoomed.drinker.name} avatarUrl={zoomed.drinker.avatarUrl} size={28} />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{zoomed.drinker.name}</div>
                  <div className="text-xs text-gray-400 truncate">{zoomed.reason} · {formatDateTime(zoomed.claimedAt)}</div>
                </div>
              </div>

              {/* Bijschrift */}
              {currentUserId === zoomed.drinker.id ? (
                editingCaption ? (
                  <div className="space-y-2">
                    <textarea
                      value={captionDraft}
                      onChange={e => setCaptionDraft(e.target.value)}
                      maxLength={200}
                      rows={2}
                      placeholder="Schrijf een bijschrift..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-amber-500/60"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveCaption} disabled={savingCaption} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                        {savingCaption ? 'Opslaan...' : 'Opslaan'}
                      </button>
                      <button onClick={() => { setEditingCaption(false); setCaptionDraft(zoomed.caption || ''); }} className="btn-secondary text-xs px-3 py-1.5">
                        Annuleer
                      </button>
                    </div>
                  </div>
                ) : zoomed.caption ? (
                  <button onClick={() => setEditingCaption(true)} className="text-left w-full text-sm text-gray-200 italic hover:text-white">
                    “{zoomed.caption}” <span className="text-xs text-amber-400 not-italic">· bewerk</span>
                  </button>
                ) : (
                  <button onClick={() => setEditingCaption(true)} className="text-left text-sm text-amber-400 hover:text-amber-300">
                    + Voeg een bijschrift toe
                  </button>
                )
              ) : (
                zoomed.caption && <div className="text-sm text-gray-200 italic">“{zoomed.caption}”</div>
              )}

              {/* Reacties */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-gray-400">
                  {zoomed.comments.length > 0 ? `Reacties (${zoomed.comments.length})` : 'Nog geen reacties'}
                </div>
                {zoomed.comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2 group/comment">
                    <Avatar name={c.user.name} avatarUrl={c.user.avatarUrl} size={24} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs">
                        <span className="font-semibold text-white">{c.user.name}</span>
                        <span className="text-gray-600"> · {formatDateTime(c.createdAt)}</span>
                      </div>
                      <div className="text-sm text-gray-200 break-words">{c.message}</div>
                    </div>
                    {(c.user.id === currentUserId) && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-gray-600 hover:text-red-400 text-xs shrink-0 opacity-0 group-hover/comment:opacity-100 transition"
                        aria-label="Verwijder reactie"
                      >
                        verwijder
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reactie-invoer — vast onderaan */}
            <div className="border-t border-white/10 p-3 flex gap-2 shrink-0">
              <input
                value={commentDraft}
                onChange={e => setCommentDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Reageer..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
              <button
                onClick={postComment}
                disabled={posting || !commentDraft.trim()}
                className="btn-primary text-sm px-4 disabled:opacity-50"
              >
                {posting ? '...' : 'Stuur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
