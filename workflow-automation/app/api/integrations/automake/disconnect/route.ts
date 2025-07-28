import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const { userId } = mockAuthServer();
    
    // Delete or deactivate the GHL integration
    const { error } = await supabase
      .from('integrations')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('type', 'gohighlevel');
    
    if (error) {
      console.error('Error disconnecting GHL:', error);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error in disconnect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}