import { NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import { getUser } from '@/lib/auth';

const SECRET = process.env.JWT_SECRET || 'wk-pronostiek-2026-secret-key-change-me';

// Creates a server-signed session token for a Keepie-Uppie game.
// Client must submit this token together with the final score so the server
// can verify the player actually played (i.e. elapsed time matches score).
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const startTime = Date.now();
  const nonce = randomBytes(12).toString('hex');
  const payload = `${user.userId}:${startTime}:${nonce}`;
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex');

  return NextResponse.json({ startTime, nonce, signature });
}
