import { NextRequest, NextResponse } from "next/server"

export function middleware(req: NextRequest) {
  const token = req.cookies.get("firebase-token")

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/signup")

  const isDashboardRoute =
    req.nextUrl.pathname.startsWith("/dashboard")

  if (!token && isDashboardRoute) {
    return NextResponse.redirect(
      new URL("/login", req.url)
    )
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(
      new URL("/dashboard", req.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
}