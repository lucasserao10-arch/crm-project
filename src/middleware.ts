import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/reset-password", "/api/auth", "/api/health"]
const AUTH_REDIRECT_PATHS = ["/login", "/reset-password"]
const PROTECTED_PATHS = ["/dashboard", "/contacts", "/deals", "/profile"]
const ADMIN_PATHS = ["/admin"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Public paths — allow all
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // Redirect authenticated users away from login/reset-password
    if (session && AUTH_REDIRECT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // Admin paths — require admin role
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // Protected paths — require any authenticated session
  if (PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
