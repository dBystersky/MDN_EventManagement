import { NextRequest, NextResponse } from "next/server";

// Matches AUTH_COOKIE_NAME in lib/auth.ts — hardcoded here to avoid
// importing Node-only dependencies (bcryptjs, jsonwebtoken) into Edge runtime.
const AUTH_COOKIE = "mdn_auth_token";

// Routes that don't require authentication
const PUBLIC_PATHS = new Set(["/login", "/signup", "/api/auth/login", "/api/auth/logout"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths, static files, and Next.js internals
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    // API routes return 401 instead of redirecting
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
