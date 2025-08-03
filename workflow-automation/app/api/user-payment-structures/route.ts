import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('user_payment_structures')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment structures:', error);
      return NextResponse.json({ error: 'Failed to fetch payment structures' }, { status: 500 });
    }

    // Transform to camelCase for frontend
    const structures = (data || []).map(structure => ({
      id: structure.id,
      paymentType: structure.payment_type,
      hourlyRate: structure.hourly_rate,
      annualSalary: structure.annual_salary,
      commissionPercentage: structure.commission_percentage,
      baseSalary: structure.base_salary,
      overtimeRate: structure.overtime_rate,
      notes: structure.notes,
      effectiveDate: structure.effective_date,
      endDate: structure.end_date,
      createdAt: structure.created_at,
      updatedAt: structure.updated_at,
      isActive: structure.is_active
    }));

    return NextResponse.json({ paymentStructures: structures, structures });
  } catch (error) {
    console.error('Error in GET /api/user-payment-structures:', error);
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
    const { 
      paymentType, 
      hourlyRate, 
      annualSalary, 
      commissionPercentage, 
      baseSalary, 
      overtimeRate, 
      notes, 
      effectiveDate 
    } = body;

    // Validate required fields
    if (!paymentType || !effectiveDate) {
      return NextResponse.json({ error: 'Payment type and effective date are required' }, { status: 400 });
    }

    // Validate payment type specific requirements
    if (paymentType === 'hourly' && !hourlyRate) {
      return NextResponse.json({ error: 'Hourly rate is required for hourly payment type' }, { status: 400 });
    }
    if (paymentType === 'salary' && !annualSalary) {
      return NextResponse.json({ error: 'Annual salary is required for salary payment type' }, { status: 400 });
    }
    if ((paymentType === 'commission_gross' || paymentType === 'commission_profit') && !commissionPercentage) {
      return NextResponse.json({ error: 'Commission percentage is required for commission payment type' }, { status: 400 });
    }
    if (paymentType === 'hybrid' && (!baseSalary || !commissionPercentage)) {
      return NextResponse.json({ error: 'Base salary and commission percentage are required for hybrid payment type' }, { status: 400 });
    }

    // Deactivate existing active structures in this organization
    await supabase
      .from('user_payment_structures')
      .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
      .eq('organization_id', organization.organizationId)
      .eq('user_id', userId)
      .eq('is_active', true);

    const { data, error } = await supabase
      .from('user_payment_structures')
      .insert({
        organization_id: organization.organizationId,
        user_id: userId,
        payment_type: paymentType,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        annual_salary: annualSalary ? parseFloat(annualSalary) : null,
        commission_percentage: commissionPercentage ? parseFloat(commissionPercentage) : null,
        base_salary: baseSalary ? parseFloat(baseSalary) : null,
        overtime_rate: overtimeRate ? parseFloat(overtimeRate) : null,
        notes: notes || null,
        effective_date: effectiveDate,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment structure:', error);
      return NextResponse.json({ error: 'Failed to create payment structure' }, { status: 500 });
    }

    // Transform to camelCase
    const structure = {
      id: data.id,
      paymentType: data.payment_type,
      hourlyRate: data.hourly_rate,
      annualSalary: data.annual_salary,
      commissionPercentage: data.commission_percentage,
      baseSalary: data.base_salary,
      overtimeRate: data.overtime_rate,
      notes: data.notes,
      effectiveDate: data.effective_date,
      endDate: data.end_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isActive: data.is_active
    };

    return NextResponse.json({ structure });
  } catch (error) {
    console.error('Error in POST /api/user-payment-structures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Structure ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (updateFields.paymentType !== undefined) updateData.payment_type = updateFields.paymentType;
    if (updateFields.hourlyRate !== undefined) updateData.hourly_rate = updateFields.hourlyRate ? parseFloat(updateFields.hourlyRate) : null;
    if (updateFields.annualSalary !== undefined) updateData.annual_salary = updateFields.annualSalary ? parseFloat(updateFields.annualSalary) : null;
    if (updateFields.commissionPercentage !== undefined) updateData.commission_percentage = updateFields.commissionPercentage ? parseFloat(updateFields.commissionPercentage) : null;
    if (updateFields.baseSalary !== undefined) updateData.base_salary = updateFields.baseSalary ? parseFloat(updateFields.baseSalary) : null;
    if (updateFields.overtimeRate !== undefined) updateData.overtime_rate = updateFields.overtimeRate ? parseFloat(updateFields.overtimeRate) : null;
    if (updateFields.notes !== undefined) updateData.notes = updateFields.notes;
    if (updateFields.effectiveDate !== undefined) updateData.effective_date = updateFields.effectiveDate;

    const { data, error } = await supabase
      .from('user_payment_structures')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', orgMember.organization_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment structure:', error);
      return NextResponse.json({ error: 'Failed to update payment structure' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Payment structure not found' }, { status: 404 });
    }

    // Transform to camelCase
    const structure = {
      id: data.id,
      paymentType: data.payment_type,
      hourlyRate: data.hourly_rate,
      annualSalary: data.annual_salary,
      commissionPercentage: data.commission_percentage,
      baseSalary: data.base_salary,
      overtimeRate: data.overtime_rate,
      notes: data.notes,
      effectiveDate: data.effective_date,
      endDate: data.end_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isActive: data.is_active
    };

    return NextResponse.json({ structure });
  } catch (error) {
    console.error('Error in PUT /api/user-payment-structures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Structure ID is required' }, { status: 400 });
    }

    // Soft delete by setting is_active to false and end_date to today
    const { data, error } = await supabase
      .from('user_payment_structures')
      .update({ 
        is_active: false, 
        end_date: new Date().toISOString().split('T')[0] 
      })
      .eq('id', id)
      .eq('organization_id', orgMember.organization_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting payment structure:', error);
      return NextResponse.json({ error: 'Failed to delete payment structure' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Payment structure not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/user-payment-structures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}