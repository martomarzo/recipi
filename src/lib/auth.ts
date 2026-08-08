import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SESSION_COOKIE = "recipi_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  // COOKIE_SECURE=false permite login por HTTP plano en la LAN (sin TLS);
  // por defecto la cookie es Secure en producción (acceso HTTPS vía tailnet).
  const secure =
    process.env.COOKIE_SECURE != null && process.env.COOKIE_SECURE !== ""
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production";
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

/** Token de la sesión actual (para excluirla al invalidar sesiones ajenas). */
export function getSessionToken() {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export async function getSessionUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** Para route handlers: devuelve el usuario o lanza Response 401. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.delete({ where: { id: token } }).catch(() => {});
  cookies().delete(SESSION_COOKIE);
}

export function registrationOpen() {
  return process.env.REGISTRATION_OPEN !== "false";
}

// ── Rate limit básico en memoria (login) ────────────────────────────────
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function loginRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}
