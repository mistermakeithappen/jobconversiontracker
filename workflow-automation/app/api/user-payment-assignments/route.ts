import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

interface PaymentAssignment {
  ghl_user_id: string;
  ghl_user_name: string;
  ghl_user_email: string;
  ghl_user_phone?: string;
  payment_type: string;
  hourly_rate?: number;
  annual_salary?: number;
  commission_percentage?: number;
  base_salary?: number;
  overtime_rate?: number;
  notes?: string;
  effective_date: string;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Get all payment assignments with user info for the organization
    const { data: assignments, error } = await supabase
      .from('user_payment_structures')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment assignments:', error);
      return NextResponse.json({ error: 'Failed to fetch payment assignments' }, { status: 500 });
    }

    return NextResponse.json({ assignments: assignments || [] });
  } catch (error) {
    console.error('Error in payment assignments GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const body = await request.json();
    console.log('POST request body:', JSON.stringify(body, null, 2));
    
    const {
      ghl_user_id,
      ghl_user_name,
      ghl_user_email,
      ghl_user_phone,
      payment_type,
      hourly_rate,
      annual_salary,
      commission_percentage,
      base_salary,
      overtime_rate,
      notes,
      effective_date
    }: PaymentAssignment = body;

    console.log('Extracted values:', {
      ghl_user_id,
      ghl_user_name,
      ghl_user_email,
      ghl_user_phone,
      payment_type,
      effective_date
    });

    // Validation
    if (!ghl_user_id || !ghl_user_name || !payment_type || !effective_date) {
      console.error('Validation failed:', { ghl_user_id, ghl_user_name, payment_type, effective_date });
      return NextResponse.json({ 
        error: 'Missing required fields: ghl_user_id, ghl_user_name, payment_type, effective_date' 
      }, { status: 400 });
    }

    // Deactivate any existing active payment structures for this user in this organization
    console.log('Deactivating existing payment structures for user:', ghl_user_id);
    const { data: deactivateData, error: deactivateError } = await supabase
      .from('user_payment_structures')
      .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
      .eq('organization_id', organization.organizationId)
      .eq('user_id', ghl_user_id)
      .eq('is_active', true)
      .select();

    if (deactivateError) {
      console.error('Error deactivating existing payment structures:', deactivateError);
      return NextResponse.json({ 
        error: 'Failed to update existing payment structures',
        details: deactivateError.message 
      }, { status: 500 });
    }

    console.log('Deactivated structures:', deactivateData);

    // Create new payment structure
    const { data: newStructure, error: createError } = await supabase
      .from('user_payment_structures')
      .insert({
        organization_id: organization.organizationId,
        user_id: ghl_user_id,
        ghl_user_name,
        ghl_user_email,
        ghl_user_phone: ghl_user_phone || null,
        payment_type,
        hourly_rate: hourly_rate || null,
        annual_salary: annual_salary || null,
        commission_percentage: commission_percentage || null,
        base_salary: base_salary || null,
        overtime_rate: overtime_rate || null,
        notes: notes || null,
        effective_date,
        is_active: true,
        created_by: userId
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating payment structure:', createError);
      return NextResponse.json({ 
        error: 'Failed to create payment structure',
        details: createError.message,
        code: createError.code 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      assignment: newStructure,
      message: 'Payment structure assigned successfully'
    });
  } catch (error) {
    console.error('Error in payment assignments POST:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      id,
      payment_type,
      hourly_rate,
      annual_salary,
      commission_percentage,
      base_salary,
      overtime_rate,
      notes,
      effective_date
    } = body;

    if (!id || !payment_type || !effective_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, payment_type, effective_date' 
      }, { status: 400 });
    }

    console.log('Updating payment structure with ID:', id);
    console.log('Update data:', { payment_type, hourly_rate, annual_salary, commission_percentage, base_salary, overtime_rate, notes, effective_date });

    const { data: updatedStructure, error } = await supabase
      .from('user_payment_structures')
      .update({
        payment_type,
        hourly_rate: hourly_rate || null,
        annual_salary: annual_salary || null,
        commission_percentage: commission_percentage || null,
        base_salary: base_salary || null,
        overtime_rate: overtime_rate || null,
        notes: notes || null,
        effective_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment structure:', error);
      return NextResponse.json({ 
        error: 'Failed to update payment structure',
        details: error.message 
      }, { status: 500 });
    }

    console.log('Successfully updated payment structure:', updatedStructure);

    return NextResponse.json({ 
      assignment: updatedStructure,
      message: 'Payment structure updated successfully'
    });
  } catch (error) {
    console.error('Error in payment assignments PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    }

    // Soft delete by setting is_active to false and setting end_date
    const { error } = await supabase
      .from('user_payment_structures')
      .update({ 
        is_active: false, 
        end_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organization.organizationId);

    if (error) {
      console.error('Error deleting payment structure:', error);
      return NextResponse.json({ error: 'Failed to delete payment structure' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Payment structure removed successfully' });
  } catch (error) {
    console.error('Error in payment assignments DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}