'use client';

import { useState } from 'react';
import InstallPrompt from './InstallPrompt';

interface Props {
  onLogin: (user: { userId: string; name: string; isAdmin: boolean }) => void;
}

export default function AuthScreen({ onLogin }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password, inviteCode };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Er ging iets mis');
        return;
      }

      onLogin(data.user);
    } catch {
      setError('Netwerkfout, probeer opnieuw');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-gold';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card card-gold w-full max-w-md animate-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold trophy-text">WK 2026</h1>
          <p className="text-gray-400 text-lg mt-1">Pronostiek</p>
        </div>

        {showForgot ? (
          <>
            <div className="text-center space-y-3 py-4">
              <p className="text-gray-300">Wachtwoord vergeten?</p>
              <p className="text-gray-400 text-sm">
                Stuur een berichtje naar de admin en die reset je wachtwoord.
              </p>
            </div>
            <p className="text-center text-base text-gray-500 mt-5">
              <button
                onClick={() => { setShowForgot(false); setError(''); }}
                className="text-gold hover:underline"
              >
                Terug naar inloggen
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-base text-gray-400 mb-1">Naam</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Je naam"
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <label className="block text-base text-gray-400 mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="je@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-base text-gray-400 mb-1">Wachtwoord</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-base text-gray-400 mb-1">Uitnodigingscode</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    className={inputClass}
                    placeholder="Vraag de code aan de admin"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                </div>
              )}

              {error && (
                <p className="text-red-400 text-base bg-red-400/10 rounded-lg p-3">{error}</p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Even geduld...' : isLogin ? 'Inloggen' : 'Registreren'}
              </button>
            </form>

            {isLogin && (
              <p className="text-center text-sm text-gray-500 mt-3">
                <button
                  onClick={() => setShowForgot(true)}
                  className="text-gray-400 hover:text-gold hover:underline"
                >
                  Wachtwoord vergeten?
                </button>
              </p>
            )}

            <p className="text-center text-base text-gray-500 mt-5">
              {isLogin ? 'Nog geen account?' : 'Al een account?'}{' '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-gold hover:underline"
              >
                {isLogin ? 'Registreer hier' : 'Log in'}
              </button>
            </p>
          </>
        )}

        <div className="flex justify-center mt-4">
          <InstallPrompt />
        </div>
      </div>
    </div>
  );
}
