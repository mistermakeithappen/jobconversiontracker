import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;

    const supabase = getServiceSupabase();
    const data = await request.json();
    const estimateId = params.id;

    // First, verify the estimate belongs to this organization
    const { data: existingEstimate, error: fetchError } = await supabase
      .from('ghl_estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !existingEstimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    // Only update fields that were provided
    if (data.estimate_number !== undefined) updateData.estimate_number = data.estimate_number;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.line_items !== undefined) updateData.line_items = data.line_items;
    if (data.terms !== undefined) updateData.terms = data.terms;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.expiry_date !== undefined) updateData.expiry_date = data.expiry_date;
    
    // Handle status-specific date updates
    if (data.status === 'sent' && existingEstimate.status !== 'sent') {
      updateData.sent_date = new Date().toISOString();
    }
    if (data.status === 'viewed' && existingEstimate.status !== 'viewed' && !existingEstimate.viewed_date) {
      updateData.viewed_date = new Date().toISOString();
    }
    if ((data.status === 'accepted' || data.status === 'declined') && !existingEstimate.response_date) {
      updateData.response_date = new Date().toISOString();
    }

    // Update the estimate
    const { data: updatedEstimate, error: updateError } = await supabase
      .from('ghl_estimates')
      .update(updateData)
      .eq('id', estimateId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating estimate:', updateError);
      return NextResponse.json(
        { error: 'Failed to update estimate' },
        { status: 500 }
      );
    }

    // Track status change if status was updated
    if (data.status && data.status !== existingEstimate.status) {
      await supabase
        .from('ghl_estimate_status_history')
        .insert({
          estimate_id: estimateId,
          from_status: existingEstimate.status,
          to_status: data.status,
          changed_at: new Date().toISOString(),
          changed_by: userId,
          metadata: { action: 'manual_update' }
        });
    }

    // In production, you would also:
    // 1. Update the estimate in GoHighLevel via their API
    // 2. Send notifications if status changed to 'sent'
    // 3. Handle conversion to invoice if status is 'accepted'

    return NextResponse.json({
      success: true,
      estimate: updatedEstimate
    });

  } catch (error) {
    console.error('Error updating estimate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}