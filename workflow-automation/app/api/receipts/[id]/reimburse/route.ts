import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { requireAuth } from '@/lib/auth/production-auth-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const receiptId = params.id;
    
    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
    
    if (orgError || !orgMember?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    // Update receipt reimbursement status to 'paid'
    const { data: receipt, error } = await supabase
      .from('opportunity_receipts')
      .update({
        reimbursement_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', receiptId)
      .eq('organization_id', orgMember.organization_id)
      .eq('is_reimbursable', true)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating receipt:', error);
      return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 });
    }
    
    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found or not reimbursable' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      receipt 
    });
    
  } catch (error) {
    console.error('Error marking receipt as reimbursed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}