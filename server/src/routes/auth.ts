import { Hono } from "hono";
import { z } from "zod";
import {
  checkPassword,
  clearSessionCookie,
  createSession,
  createUser,
  findUserByEmail,
  readSessionFromRequest,
  revokeSession,
  setSessionCookie,
  type AppEnv,
} from "../auth";

const auth = new Hono<AppEnv>();

const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const Register = Credentials.extend({ name: z.string().min(1) });

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = Register.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const existing = await findUserByEmail(parsed.data.email);
  if (existing) return c.json({ error: "email already in use" }, 409);
  const id = await createUser(parsed.data.email, parsed.data.password, parsed.data.name);
  const token = createSession(id);
  setSessionCookie(c, token);
  return c.json({ id, email: parsed.data.email, name: parsed.data.name }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = Credentials.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await checkPassword(parsed.data.password, user.passwordHash))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const token = createSession(user.id);
  setSessionCookie(c, token);
  return c.json({ id: user.id, email: user.email, name: user.name });
});

auth.post("/logout", async (c) => {
  const cookieHeader = c.req.header("cookie") ?? "";
  const match = cookieHeader.match(/khaodee_session=([^;]+)/);
  if (match) revokeSession(match[1]);
  clearSessionCookie(c);
  return c.body(null, 204);
});

auth.get("/me", async (c) => {
  const user = readSessionFromRequest(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  return c.json(user);
});

export { auth };
