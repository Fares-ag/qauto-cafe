import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const STAFF_PATHS = ['/sell', '/kitchen', '/orders', '/shifts', '/inventory', '/menu'];
const MANAGER_ONLY_PREFIXES = [
  '/dashboard',
  '/finance',
  '/reports',
  '/customers',
  '/ingredients',
  '/procurement',
  '/users',
  '/audit',
  '/settings',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionType = request.cookies.get('qauto_session_type')?.value;
  const hasSession = sessionType === 'staff' || sessionType === 'manager';

  const isAppRoute =
    MANAGER_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ||
    STAFF_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isAppRoute && !hasSession) {
    const login = sessionType === 'staff' ? '/login/pin' : '/login';
    return NextResponse.redirect(new URL(login, request.url));
  }

  if (
    sessionType === 'staff' &&
    MANAGER_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.redirect(new URL('/sell', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/finance/:path*',
    '/sell/:path*',
    '/kitchen/:path*',
    '/orders/:path*',
    '/shifts/:path*',
    '/reports/:path*',
    '/customers/:path*',
    '/inventory',
    '/inventory/:path*',
    '/ingredients/:path*',
    '/procurement/:path*',
    '/menu/:path*',
    '/users/:path*',
    '/audit/:path*',
    '/settings/:path*',
  ],
};
