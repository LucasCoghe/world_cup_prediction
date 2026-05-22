'use client';

import { useState, useEffect, useRef } from 'react';

interface Comment {
  id: string;
  userName: string;
  message: string;
  createdAt: string;
}

interface Props {
  matchNumber: number;
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

export default function MatchComments({ matchNumber }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 15000);
    return () => clearInterval(interval);
  }, [matchNumber]);

  function fetchComments() {
    fetch(`/api/comments?match=${matchNumber}`)
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
        body: JSON.stringify({ matchNumber, message: message.trim() }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments(prev => [...prev, data.comment]);
        setMessage('');
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <div className="text-xs text-gray-500 font-medium mb-2">Reacties</div>

      {/* Comments list */}
      {comments.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto mb-2">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 text-sm">
              <span className="text-amber-400 font-medium shrink-0">{c.userName}</span>
              <span className="text-gray-300">{c.message}</span>
              <span className="text-gray-600 text-xs ml-auto shrink-0">{timeAgo(c.createdAt)}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Zeg iets..."
          maxLength={500}
          className="flex-1 bg-black/30 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-600/50"
        />
        <button
          onClick={send}
          disabled={!message.trim() || sending}
          className="px-3 py-1.5 bg-amber-600/20 border border-amber-600/30 rounded-lg text-sm text-amber-300 hover:bg-amber-600/30 disabled:opacity-30 transition-colors"
        >
          Stuur
        </button>
      </div>
    </div>
  );
}
