import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Bestand te groot (max 5 MB)' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Alleen JPG, PNG, WEBP of GIF' }, { status: 400 });
  }

  const ext = file.type.split('/')[1] || 'jpg';
  const key = `avatars/${user.userId}-${Date.now()}.${ext}`;

  try {
    const blob = await put(key, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    });

    const previous = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { avatarUrl: true },
    });

    await prisma.user.update({
      where: { id: user.userId },
      data: { avatarUrl: blob.url },
    });

    if (previous?.avatarUrl) {
      try {
        await del(previous.avatarUrl);
      } catch {
        // Old blob may already be gone — not fatal.
      }
    }

    return NextResponse.json({ avatarUrl: blob.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Onbekende fout';
    console.error('[avatar upload] failed:', err);
    return NextResponse.json({ error: `Upload mislukt: ${msg}` }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const current = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { avatarUrl: true },
  });

  await prisma.user.update({
    where: { id: user.userId },
    data: { avatarUrl: null },
  });

  if (current?.avatarUrl) {
    try {
      await del(current.avatarUrl);
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}
