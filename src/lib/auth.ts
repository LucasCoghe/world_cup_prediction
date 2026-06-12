import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './db';
import type { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'wk-pronostiek-2026-secret-key-change-me';

export interface JWTPayload {
  userId: string;
  name: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// Returns the JWT-authenticated user, but ONLY if their row still exists in the
// DB. A valid JWT for a deleted user resolves to null — prevents "ghost" sessions
// from operating on the system for up to 30 days after admin deletion.
export async function getUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, isAdmin: true, avatarUrl: true },
  });
  if (!dbUser) return null;
  // Resync from DB so admin flag changes take effect without re-login
  return { userId: dbUser.id, name: dbUser.name, isAdmin: dbUser.isAdmin, avatarUrl: dbUser.avatarUrl };
}

// Same as getUser but returns the full Prisma User row (includes `locked`,
// `inlegPaid`, etc.). Use this in routes that need extra fields to avoid a
// second findUnique.
export async function getDBUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.userId } });
}
