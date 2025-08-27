import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;

    const supabase = getServiceSupabase();
    const data = await request.json();
    
    // Validate required fields
    if (!data.contact_id || !data.estimate_number || !data.name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get integration ID if not provided
    let integrationId = data.integration_id;
    if (!integrationId) {
      const { data: integrations, error: intError } = await supabase
        .from('integrations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('type', 'gohighlevel')
        .single();
      
      if (intError || !integrations) {
        return NextResponse.json(
          { error: 'No GoHighLevel integration found' },
          { status: 400 }
        );
      }
      integrationId = integrations.id;
    }

    // Generate a GHL estimate ID (in production, this would come from GHL API)
    const ghlEstimateId = `est_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert the estimate
    const { data: estimate, error } = await supabase
      .from('ghl_estimates')
      .insert({
        organization_id: organizationId,
        integration_id: integrationId,
        ghl_estimate_id: ghlEstimateId,
        estimate_number: data.estimate_number,
        opportunity_id: data.opportunity_id || null,
        contact_id: data.contact_id,
        name: data.name,
        description: data.description || null,
        amount: data.amount || 0,
        currency: data.currency || 'USD',
        status: data.status || 'draft',
        created_date: data.created_date || new Date().toISOString(),
        sent_date: data.sent_date || null,
        expiry_date: data.expiry_date || null,
        line_items: data.line_items || [],
        terms: data.terms || null,
        notes: data.notes || null,
        metadata: data.metadata || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating estimate:', error);
      return NextResponse.json(
        { error: 'Failed to create estimate' },
        { status: 500 }
      );
    }

    // If status is 'sent', add to status history
    if (data.status === 'sent') {
      await supabase
        .from('ghl_estimate_status_history')
        .insert({
          estimate_id: estimate.id,
          from_status: 'draft',
          to_status: 'sent',
          changed_at: new Date().toISOString(),
          metadata: { action: 'created_and_sent' }
        });
    }

    // In production, you would also:
    // 1. Create the estimate in GoHighLevel via their API
    // 2. Send email/SMS notification to the client if status is 'sent'
    // 3. Update any related opportunities

    return NextResponse.json({
      success: true,
      estimate
    });

  } catch (error) {
    console.error('Error in estimate creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}