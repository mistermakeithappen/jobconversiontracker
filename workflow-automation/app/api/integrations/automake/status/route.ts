import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { userId } = mockAuthServer();
    
    // Check if user has GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking GHL status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      connected: !!integration && integration.is_active,
      integrationId: integration?.id || null,
      integration: integration || null
    });
    
  } catch (error) {
    console.error('Error in GHL status check:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}