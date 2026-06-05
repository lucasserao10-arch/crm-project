import { auth } from "@/auth"
import { NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/reset-password", "/api/auth", "/api/health"]
const AUTH_REDIRECT_PATHS = ["/login", "/reset-password"]
const PROTECTED_PATHS = ["/dashboard", "/contacts", "/deals", "/profile"]
const ADMIN_PATHS = ["/admin"]

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString("base64")
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}

export default auth((req) => {
  const nonce = generateNonce()
  const csp = buildCsp(nonce)
  const { pathname } = req.nextUrl
  const session = req.auth

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)

  function next(opts?: Parameters<typeof NextResponse.next>[0]) {
    const res = NextResponse.next({
      ...opts,
      request: { headers: requestHeaders },
    })
    res.headers.set("Content-Security-Policy", csp)
    return res
  }

  function redirect(url: URL) {
    const res = NextResponse.redirect(url)
    res.headers.set("Content-Security-Policy", csp)
    return res
  }

  // Public paths — allow all
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (session && AUTH_REDIRECT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return redirect(new URL("/dashboard", req.url))
    }
    return next()
  }

  // Admin paths — require admin role
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session) return redirect(new URL("/login", req.url))
    if (session.user.role !== "admin") return redirect(new URL("/dashboard", req.url))
    return next()
  }

  // Protected paths — require any authenticated session
  if (PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session) return redirect(new URL("/login", req.url))
    return next()
  }

  return next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
