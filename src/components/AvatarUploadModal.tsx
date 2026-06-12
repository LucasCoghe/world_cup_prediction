'use client';

import { useRef, useState } from 'react';
import Avatar from './Avatar';

interface Props {
  name: string;
  avatarUrl: string | null;
  onClose: () => void;
  onChange: (newUrl: string | null) => void;
}

export default function AvatarUploadModal({ name, avatarUrl, onClose, onChange }: Props) {
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File) {
    if (f.size > 5 * 1024 * 1024) {
      setError('Bestand te groot (max 5 MB)');
      return;
    }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload mislukt');
        return;
      }
      onChange(data.avatarUrl);
      onClose();
    } catch {
      setError('Upload mislukt');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
      if (!res.ok) {
        setError('Verwijderen mislukt');
        return;
      }
      onChange(null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card card-gold w-full max-w-sm animate-in"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold trophy-text mb-4">Profielfoto</h3>

        <div className="flex flex-col items-center gap-4 mb-4">
          <Avatar name={name} avatarUrl={preview} size={120} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-secondary text-sm"
            disabled={busy}
          >
            Kies bestand
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) pick(f);
            }}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 rounded-lg p-2 mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={busy}>
            Annuleren
          </button>
          {avatarUrl && !file && (
            <button onClick={remove} className="btn-secondary flex-1 text-red-300" disabled={busy}>
              Verwijderen
            </button>
          )}
          <button
            onClick={upload}
            className="btn-primary flex-1"
            disabled={!file || busy}
          >
            {busy ? 'Bezig...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}
