import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithOrg } from '@/lib/auth/production-auth-server';

export async function GET(request: NextRequest) {
  // Prevent build-time calls
  if (process.env.NODE_ENV === 'production' && !request.headers.get('cookie')) {
    return NextResponse.json({ error: 'No cookies provided' }, { status: 401 });
  }

  try {
    const { user, organization } = await requireAuthWithOrg(request);
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email
      },
      organization
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { error: 'Authentication required' }, 
      { status: 401 }
    );
  }
}