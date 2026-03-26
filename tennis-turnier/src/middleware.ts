import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login?redirect=/admin', request.url))
    }

    // Verify token by checking its structure (full JWT verification happens in API routes)
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return NextResponse.redirect(new URL('/login?redirect=/admin', request.url))
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

      if (payload.rolle !== 'admin') {
        return NextResponse.redirect(new URL('/?error=unauthorized', request.url))
      }

      // Check expiry
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return NextResponse.redirect(new URL('/login?redirect=/admin', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login?redirect=/admin', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
