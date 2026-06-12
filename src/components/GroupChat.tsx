'use client';

import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { getCosmetic } from '@/lib/cosmetics';

interface Comment {
  id: string;
  userName: string;
  avatarUrl: string | null;
  message: string;
  createdAt: string;
  cosmetics?: { nameColor: string | null; rowStyle: string | null; title: string | null };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'net';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function GroupChat() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  function fetchComments() {
    fetch('/api/comments?match=0')
      .then(r => r.json())
      .then(data => setComments(data.comments || []));
  }

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchNumber: 0, message: message.trim() }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments(prev => [...prev, data.comment]);
        setMessage('');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 animate-in">
      <h2 className="text-2xl font-bold trophy-text">Groepschat</h2>

      <div className="card flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
          {comments.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              Nog geen berichten. Zeg iets!
            </div>
          ) : (
            comments.map(c => {
              const nameCos = getCosmetic(c.cosmetics?.nameColor);
              const titleCos = getCosmetic(c.cosmetics?.title);
              return (
                <div key={c.id} className="flex gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-white/5">
                  <Avatar name={c.userName} avatarUrl={c.avatarUrl} size={28} className="self-start mt-0.5" />
                  <div className="shrink-0 flex flex-col">
                    {titleCos?.title && <span className="cos-title leading-none">{titleCos.title}</span>}
                    <span className={`font-medium ${nameCos?.nameClassName ?? 'text-amber-400'}`}>{c.userName}</span>
                  </div>
                  <span className="text-gray-300 flex-1 break-words">{c.message}</span>
                  <span className="text-gray-600 text-xs ml-2 shrink-0 self-end">{timeAgo(c.createdAt)}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 border-t border-white/10 pt-3">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Typ een bericht..."
            maxLength={500}
            className="flex-1 bg-black/30 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-600/50"
          />
          <button
            onClick={send}
            disabled={!message.trim() || sending}
            className="px-5 py-2.5 bg-amber-600/20 border border-amber-600/30 rounded-lg text-sm text-amber-300 hover:bg-amber-600/30 disabled:opacity-30 transition-colors"
          >
            Stuur
          </button>
        </div>
      </div>
    </div>
  );
}
