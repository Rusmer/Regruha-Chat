import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';

const encoder = new TextEncoder();

export async function generateToken(
  userId: string,
  secret: string,
  expiresIn: number = 24 * 60 * 60 * 1000 // 24 hours
) {
  const key = encoder.encode(secret);
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn / 1000)
    .sign(key);
  
  return token;
}

export async function verifyToken(token: string, secret: string) {
  try {
    const key = encoder.encode(secret);
    const verified = await jwtVerify(token, key);
    return verified.payload as { userId: string };
  } catch (e) {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  // In production, use bcrypt or argon2
  // This is a placeholder
  return Promise.resolve(
    Array.from(new Uint8Array(Buffer.from(password)))
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hash2 = await hashPassword(password);
  return hash === hash2;
}

export function generateUserId(): string {
  return 'user_' + nanoid(12);
}

export function generateConversationId(): string {
  return 'conv_' + nanoid(12);
}

export function generateMessageId(): string {
  return 'msg_' + nanoid(12);
}
