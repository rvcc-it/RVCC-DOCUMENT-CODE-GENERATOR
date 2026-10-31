import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "dcg_session";

/**
 * Cheap gate: requires a validly signed, unexpired session cookie.
 * Role checks and revocation are enforced in requireSession() and by RLS in the database.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  let valid = false;
  if (token && process.env.SUPABASE_JWT_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET), { audience: "authenticated", algorithms: ["HS256"] });
      valid = true;
    } catch { /* invalid or expired */ }
  }

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!valid && !isLogin) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    if (token) res.cookies.delete(COOKIE);
    return res;
  }
  if (valid && isLogin) return NextResponse.redirect(new URL("/generator", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
