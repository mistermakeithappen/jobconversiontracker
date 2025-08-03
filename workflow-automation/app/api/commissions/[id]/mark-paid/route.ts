import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const { paid_date, paid_amount, payment_reference } = body;

    // Update the commission assignment
    const { data, error } = await supabase
      .from('commission_assignments')
      .update({
        is_paid: true,
        paid_date: paid_date || new Date().toISOString(),
        paid_amount: paid_amount || 0,
        payment_reference: payment_reference || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error marking commission as paid:', error);
      return NextResponse.json({ error: 'Failed to update commission' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      commission: data 
    });

  } catch (error) {
    console.error('Error in mark-paid API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}