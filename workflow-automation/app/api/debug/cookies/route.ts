import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  
  const allCookies = cookieStore.getAll();
  
  return NextResponse.json({
    cookies: allCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value.substring(0, 50) + '...', // Truncate for security
      hasValue: !!cookie.value
    })),
    count: allCookies.length,
    hasAuthToken: cookieStore.has('supabase-auth-token'),
    hasMockUser: cookieStore.has('mock-user-id'),
  });
}