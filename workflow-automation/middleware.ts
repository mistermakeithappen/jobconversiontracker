import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// For now, disable middleware auth checking since Supabase uses localStorage
// Auth will be handled client-side in components
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};