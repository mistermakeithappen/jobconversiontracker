import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    // Delete or deactivate the GHL integration
    const { error } = await supabase
      .from('integrations')
      .update({ is_active: false })
      .eq('organization_id', organization.organizationId)
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