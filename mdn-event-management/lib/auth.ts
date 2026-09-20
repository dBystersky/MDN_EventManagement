import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const JWT_SECRET = process.env.JWT_SECRET || 'mdn_event_management_secret_key_change_in_production_2026';
export const AUTH_COOKIE_NAME = 'mdn_auth_token';

export interface UserSession {
  member_id: number;
  email: string;
  name: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function signToken(user: UserSession): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

export async function getAuthSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Guests are external, read-only visitors — calendar access only. */
export function isGuest(session: UserSession | null): boolean {
  return session?.role === 'Guest';
}

/** Server Component page guard: bounces guests to the one page they're allowed on. */
export async function requireNonGuestPage(): Promise<UserSession | null> {
  const session = await getAuthSession();
  if (isGuest(session)) {
    redirect('/calendar');
  }
  return session;
}
