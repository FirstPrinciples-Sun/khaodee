/**
 * Auth: bcrypt password + opaque session token in a cookie.
 *
 * Simple session table (created lazily) — no JWT, no third party. Sessions
 * in DB so we can revoke. For multi-shop, the session carries the user id
 * and the chosen shop id (X-Shop-Id header per request).
 */

import type { Context, MiddlewareHandler } from "hono";
import { db } from "./db";
import { schema } from "./db";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
}

export interface AppEnv {
  Variables: {
    user: SessionUser;
  };
}

const SESSION_COOKIE = "khaodee_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const sessions = new Map<string, { userId: string; expiresAt: number }>();

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

export async function checkPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed);
}

export async function createUser(email: string, password: string, name: string): Promise<string> {
  const id = randomUUID();
  const ph = await hashPassword(password);
  db.insert(schema.users).values({ id, email, passwordHash: ph, name }).run();
  return id;
}

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email));
  return rows[0];
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("base64url");
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}

function readSession(token: string): SessionUser | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  // Hydrate user (sync select via better-sqlite3 prepared cache is fast)
  const userRow = db.select().from(schema.users).where(eq(schema.users.id, s.userId)).all()[0];
  if (!userRow) return null;
  return { userId: userRow.id, email: userRow.email, name: userRow.name };
}

export function readSessionFromRequest(c: Context): SessionUser | null {
  const cookieHeader = c.req.header("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return readSession(match[1]);
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = readSessionFromRequest(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  c.set("user", user);
  await next();
};

export function setSessionCookie(c: Context, token: string) {
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
  );
}

export function clearSessionCookie(c: Context) {
  c.header("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}
