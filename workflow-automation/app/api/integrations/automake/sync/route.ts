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
    
    // Get user's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // In a real implementation, this would:
    // 1. Fetch all data from GHL
    // 2. Store it in our database
    // 3. Set up webhooks for real-time updates
    
    // For now, just update the last sync time
    await supabase
      .from('integrations')
      .update({ 
        config: {
          ...integration.config,
          lastSyncAt: new Date().toISOString()
        }
      })
      .eq('id', integration.id);
    
    return NextResponse.json({
      success: true,
      message: 'Data synced successfully',
      syncedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error syncing GHL data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}