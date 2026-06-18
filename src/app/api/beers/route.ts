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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const ALLOWED_VIDEOS = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'];

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const confirmations = await prisma.beerConfirmation.findMany({
    where: { photoUrl: { not: null } },
    include: {
      drinker: { select: { id: true, name: true, avatarUrl: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
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
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 });
    }
    const isVideo = ALLOWED_VIDEOS.includes(file.type);
    const isImage = ALLOWED_IMAGES.includes(file.type);
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: 'Alleen foto (JPG/PNG/WEBP/GIF/HEIC) of video (MP4/MOV/WEBM)' }, { status: 400 });
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      const limitMb = Math.round(maxBytes / (1024 * 1024));
      return NextResponse.json({ error: `${isVideo ? 'Filmpje' : 'Foto'} te groot (max ${limitMb} MB)` }, { status: 400 });
    }

    const extMap: Record<string, string> = {
      'video/quicktime': 'mov',
      'video/x-m4v': 'm4v',
      'video/3gpp': '3gp',
    };
    const ext = extMap[file.type] || file.type.split('/')[1] || 'jpg';
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

  const { action, reason, receiverId, pintId, caption, message, commentId } = await req.json();

  // Maker zet/bewerkt het bijschrift bij zijn eigen foto
  if (action === 'caption') {
    if (typeof pintId !== 'string') {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
    }
    const pint = await prisma.beerConfirmation.findUnique({ where: { id: pintId }, select: { drinkerId: true } });
    if (!pint) return NextResponse.json({ error: 'Foto niet gevonden' }, { status: 404 });
    if (pint.drinkerId !== user.userId) {
      return NextResponse.json({ error: 'Alleen de maker kan een bijschrift toevoegen' }, { status: 403 });
    }
    const trimmed = typeof caption === 'string' ? caption.trim().slice(0, 200) : '';
    await prisma.beerConfirmation.update({
      where: { id: pintId },
      data: { caption: trimmed || null },
    });
    return NextResponse.json({ ok: true, caption: trimmed || null });
  }

  // Iedereen mag reageren op een foto
  if (action === 'comment') {
    if (typeof pintId !== 'string' || !message?.trim()) {
      return NextResponse.json({ error: 'Foto en bericht vereist' }, { status: 400 });
    }
    const pint = await prisma.beerConfirmation.findUnique({ where: { id: pintId }, select: { id: true } });
    if (!pint) return NextResponse.json({ error: 'Foto niet gevonden' }, { status: 404 });
    const comment = await prisma.pintComment.create({
      data: { pintId, userId: user.userId, message: message.trim().slice(0, 500) },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return NextResponse.json({
      ok: true,
      comment: {
        id: comment.id,
        message: comment.message,
        createdAt: comment.createdAt.toISOString(),
        user: comment.user,
      },
    });
  }

  // Eigen reactie (of admin) verwijderen
  if (action === 'deleteComment') {
    if (typeof commentId !== 'string') {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
    }
    const comment = await prisma.pintComment.findUnique({ where: { id: commentId }, select: { userId: true } });
    if (!comment) return NextResponse.json({ error: 'Reactie niet gevonden' }, { status: 404 });
    if (comment.userId !== user.userId && !user.isAdmin) {
      return NextResponse.json({ error: 'Geen rechten' }, { status: 403 });
    }
    await prisma.pintComment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  }

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
