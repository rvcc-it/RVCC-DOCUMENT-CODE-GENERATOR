import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "dcg_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

const key = () => {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
};

/**
 * The session is a JWT signed with the Supabase project's JWT secret. PostgREST accepts it as an
 * "authenticated" user, so auth.uid() inside RLS policies and SQL functions equals the user's id.
 */
export async function createSessionToken(userId: string, sessionVersion: number) {
  return new SignJWT({ role: "authenticated", sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function readSessionToken() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "authenticated", algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { token, userId: payload.sub, version: Number(payload.sv ?? 0) };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
