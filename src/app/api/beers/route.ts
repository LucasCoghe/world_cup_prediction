import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/auth';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@wk2026.be',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const confirmations = await prisma.beerConfirmation.findMany({
    where: { photoUrl: { not: null } },
    include: {
      drinker: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { claimedAt: 'desc' },
  });

  const gifts = await prisma.beerGift.findMany({
    include: {
      giver: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ confirmations, gifts });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    const reason = form.get('reason');
    const drinkerId = form.get('drinkerId');

    if (typeof reason !== 'string' || typeof drinkerId !== 'string') {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
    }
    if (drinkerId !== user.userId) {
      return NextResponse.json({ error: 'Je kan alleen je eigen pintje bevestigen' }, { status: 403 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Geen foto ontvangen' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Foto te groot (max 8 MB)' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Alleen JPG, PNG, WEBP, GIF of HEIC' }, { status: 400 });
    }

    const ext = file.type.split('/')[1] || 'jpg';
    const safeReason = reason.replace(/[^a-z0-9]/gi, '-').slice(0, 40);
    const key = `pints/${user.userId}-${safeReason}-${Date.now()}.${ext}`;

    try {
      const existing = await prisma.beerConfirmation.findUnique({
        where: { drinkerId_reason: { drinkerId, reason } },
      });

      const blob = await put(key, file, {
        access: 'public',
        contentType: file.type,
        addRandomSuffix: false,
      });

      await prisma.beerConfirmation.upsert({
        where: { drinkerId_reason: { drinkerId, reason } },
        create: {
          drinkerId,
          reason,
          claimedAt: new Date(),
          photoUrl: blob.url,
        },
        update: {
          claimedAt: new Date(),
          photoUrl: blob.url,
        },
      });

      if (existing?.photoUrl && existing.photoUrl !== blob.url) {
        try { await del(existing.photoUrl); } catch { /* old blob gone */ }
      }

      return NextResponse.json({ ok: true, photoUrl: blob.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      console.error('[pint photo upload] failed:', err);
      return NextResponse.json({ error: `Upload mislukt: ${msg}` }, { status: 500 });
    }
  }

  const { action, reason, receiverId } = await req.json();

  if (action === 'give') {
    if (!reason || !receiverId) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
    }
    if (receiverId === user.userId) {
      return NextResponse.json({ error: 'Je kan jezelf geen biertje geven' }, { status: 400 });
    }

    const existing = await prisma.beerGift.findUnique({
      where: { giverId_reason: { giverId: user.userId, reason } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Al toegewezen voor deze dag' }, { status: 400 });
    }

    const giver = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
    await prisma.beerGift.create({
      data: { giverId: user.userId, receiverId, reason },
    });

    const subs = await prisma.pushSubscription.findMany({ where: { userId: receiverId } });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: '🍺 Biertje!', body: `${giver?.name} heeft jou een biertje gegeven!` })
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
