import 'server-only'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Secure video playback tokens
//
// The real video file (on UploadThing) is never exposed to the browser. Instead
// the player receives a short-lived, signed token that is redeemed through the
// streaming proxy (`/api/lectures/[lessonId]/stream`). The token is bound to:
//   • the lesson id
//   • the student's auth user id
//   • a random session id ("sid") that is rotated on every lecture open
//
// Because only the LATEST sid (stored in `lecture_playback_sessions`) is
// accepted, re-opening the lecture — anywhere — instantly invalidates every
// previously issued link. A link copied from DevTools is therefore useless to
// anyone else (it needs that student's login cookie) and stops working for the
// student too as soon as they open the lecture again.
// ─────────────────────────────────────────────────────────────────────────────

// never reaches the client.
const SECRET = process.env.VIDEO_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Token lifetime. Long enough for a full lecture, short enough to limit misuse.
const TOKEN_TTL_SECONDS = 3 * 60 * 60 // 3 hours

export type VideoTokenPayload = {
  /** lessons.id (UUID) */
  lessonId: string
  /** auth user id of the student the token was issued to */
  userId: string
  /** random per-open session id — must match the latest stored sid */
  sid: string
  /** expiry (unix seconds) */
  exp: number
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlToBuffer(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function sign(data: string): string {
  return b64url(crypto.createHmac('sha256', SECRET).update(data).digest())
}

/** Signs a payload into a compact `payload.signature` token. */
export function signVideoToken(payload: VideoTokenPayload): string {
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

/** Verifies signature + expiry. Returns the payload or null if invalid. */
export function verifyVideoToken(token: string | null | undefined): VideoTokenPayload | null {
  if (!token || !SECRET) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  // Constant-time signature comparison.
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let payload: VideoTokenPayload
  try {
    payload = JSON.parse(b64urlToBuffer(body).toString('utf8'))
  } catch {
    return null
  }
  if (!payload?.lessonId || !payload?.userId || !payload?.sid || !payload?.exp) {
    return null
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

/**
 * Rotates the playback session for (user, lesson) and returns a fresh signed
 * token. Any token issued for a previous open is invalidated because its sid no
 * longer matches the stored one.
 */
export async function createPlaybackToken(
  userId: string,
  lessonId: string,
): Promise<string> {
  const sid = crypto.randomBytes(16).toString('hex')
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO lecture_playback_sessions (user_id, lesson_id, sid, updated_at)
    VALUES (${userId}::uuid, ${lessonId}::uuid, ${sid}, ${now})
    ON CONFLICT (user_id, lesson_id)
    DO UPDATE SET sid = EXCLUDED.sid, updated_at = EXCLUDED.updated_at
  `
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  return signVideoToken({ lessonId, userId, sid, exp })
}

/** Returns true only if the token's sid matches the latest stored session. */
export async function isLatestSession(
  userId: string,
  lessonId: string,
  sid: string,
): Promise<boolean> {
  const data: any[] = await prisma.$queryRaw`
    SELECT sid FROM lecture_playback_sessions
    WHERE user_id = ${userId}::uuid AND lesson_id = ${lessonId}::uuid
  `
  return data.length > 0 && data[0].sid === sid
}
