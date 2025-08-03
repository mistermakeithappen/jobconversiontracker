import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const opportunityId = searchParams.get('opportunityId');
    
    if (!opportunityId) {
      return NextResponse.json({ error: 'Opportunity ID required' }, { status: 400 });
    }
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    console.log('Fetching commission assignments for opportunity:', opportunityId);
    
    // Fetch commission assignments for this opportunity
    const { data: assignments, error: assignmentsError } = await supabase
      .from('commission_assignments')
      .select(`
        *,
        team_member:team_members(*)
      `)
      .eq('organization_id', organization.organizationId)
      .eq('opportunity_id', opportunityId)
      .eq('assignment_type', 'opportunity')
      .order('created_at', { ascending: false });
    
    if (assignmentsError) {
      console.error('Error fetching commission assignments:', assignmentsError);
      return NextResponse.json({ error: 'Failed to fetch commission assignments' }, { status: 500 });
    }
    
    console.log(`Found ${assignments?.length || 0} commission assignments for opportunity ${opportunityId}`);
    
    // Also fetch any commission records for this opportunity
    const { data: records, error: recordsError } = await supabase
      .from('commission_records')
      .select(`
        *,
        event:commission_events!inner(
          opportunity_id,
          event_type,
          event_amount,
          event_date
        )
      `)
      .eq('organization_id', organization.organizationId)
      .eq('event.opportunity_id', opportunityId)
      .order('created_at', { ascending: false });
    
    if (recordsError) {
      console.error('Error fetching commission records:', recordsError);
    }
    
    // Transform assignments to match expected format
    const commissions = (assignments || []).map(assignment => ({
      id: assignment.id,
      organization_id: assignment.organization_id,
      opportunity_id: assignment.opportunity_id,
      integration_id: assignment.integration_id || null,
      ghl_user_id: assignment.ghl_user_id,
      user_name: assignment.user_name,
      user_email: assignment.user_email,
      commission_type: assignment.commission_type === 'percentage_gross' ? 'gross' : 
                      assignment.commission_type === 'percentage_profit' ? 'profit' : 'custom',
      commission_percentage: assignment.base_rate || 0,
      commission_amount: 0, // Will be calculated based on opportunity value
      notes: assignment.notes,
      is_disabled: assignment.is_disabled || false,
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
      // Additional fields from new schema
      required_stage_id: assignment.required_stage_id,
      required_stage_name: assignment.required_stage_name,
      stage_requirement_type: assignment.stage_requirement_type,
      team_member: assignment.team_member,
      // Include related commission records if any
      records: records?.filter(r => 
        r.event.opportunity_id === opportunityId && 
        (r.ghl_user_id === assignment.ghl_user_id || r.team_member_id === assignment.team_member_id)
      ) || []
    }));
    
    return NextResponse.json({ commissions });
  } catch (error) {
    console.error('Error in GET /api/opportunity-commissions:', error);
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
      opportunityId,
      integrationId,
      ghlUserId,
      userName,
      userEmail,
      commissionType,
      commissionPercentage,
      notes,
      // New fields for pipeline stage requirements
      requiredPipelineId,
      requiredStageId,
      requiredStageName,
      stageRequirementType
    } = body;
    
    if (!opportunityId || !ghlUserId || !commissionType || 
        commissionPercentage === undefined || commissionPercentage === null || 
        isNaN(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
      return NextResponse.json({ 
        error: 'Missing or invalid required fields. Commission percentage must be a number between 0 and 100.' 
      }, { status: 400 });
    }
    
    // Map old commission types to new schema
    const mappedCommissionType = commissionType === 'gross' ? 'percentage_gross' : 
                                commissionType === 'profit' ? 'percentage_profit' : 
                                'fixed_amount';
    
    // First, check if there's already an assignment (active or inactive) for this user and opportunity
    const { data: existingAssignment } = await supabase
      .from('commission_assignments')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('opportunity_id', opportunityId)
      .eq('ghl_user_id', ghlUserId)
      .eq('assignment_type', 'opportunity')
      .single();
    
    if (existingAssignment) {
      return NextResponse.json({ 
        error: 'This team member already has an active commission assignment for this opportunity' 
      }, { status: 409 });
    }
    
    // Create the commission assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('commission_assignments')
      .insert({
        organization_id: organization.organizationId,
        assignment_type: 'opportunity',
        opportunity_id: opportunityId,
        ghl_user_id: ghlUserId,
        user_name: userName,
        user_email: userEmail,
        commission_type: mappedCommissionType,
        base_rate: commissionPercentage,
        notes,
        // Pipeline stage requirements
        required_pipeline_id: requiredPipelineId || null,
        required_stage_id: requiredStageId || null,
        required_stage_name: requiredStageName || null,
        stage_requirement_type: stageRequirementType || 'reached',
        is_active: true,
        created_by: userId
      })
      .select()
      .single();
    
    if (assignmentError) {
      console.error('Error creating commission assignment:', assignmentError);
      return NextResponse.json({ error: 'Failed to create commission assignment' }, { status: 500 });
    }
    
    // Check if we need to create a commission event for an existing opportunity
    if (opportunityId) {
      // Get integration details to check if opportunity is already won
      const { data: integration } = await supabase
        .from('integrations')
        .select('id')
        .eq('organization_id', organization.organizationId)
        .eq('type', 'gohighlevel')
        .eq('is_active', true)
        .single();
      
      // For now, we'll just return the assignment
      // The commission event will be created when the opportunity status changes
    }
    
    // Transform to match expected format
    const commission = {
      id: assignment.id,
      organization_id: assignment.organization_id,
      opportunity_id: assignment.opportunity_id,
      integration_id: integrationId || null,
      ghl_user_id: assignment.ghl_user_id,
      user_name: assignment.user_name,
      user_email: assignment.user_email,
      commission_type: commissionType,
      commission_percentage: assignment.base_rate,
      notes: assignment.notes,
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
      required_stage_id: assignment.required_stage_id,
      required_stage_name: assignment.required_stage_name,
      stage_requirement_type: assignment.stage_requirement_type
    };
    
    return NextResponse.json({ commission });
  } catch (error) {
    console.error('Error in POST /api/opportunity-commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      commissionType,
      commissionPercentage,
      notes,
      // New fields
      requiredPipelineId,
      requiredStageId,
      requiredStageName,
      stageRequirementType
    } = body;
    
    if (!id || !commissionType || commissionPercentage === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Map old commission types to new schema
    const mappedCommissionType = commissionType === 'gross' ? 'percentage_gross' : 
                                commissionType === 'profit' ? 'percentage_profit' : 
                                'fixed_amount';
    
    const { data: assignment, error } = await supabase
      .from('commission_assignments')
      .update({
        commission_type: mappedCommissionType,
        base_rate: commissionPercentage,
        notes,
        // Pipeline stage requirements
        required_pipeline_id: requiredPipelineId || null,
        required_stage_id: requiredStageId || null,
        required_stage_name: requiredStageName || null,
        stage_requirement_type: stageRequirementType || 'reached',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating commission assignment:', error);
      return NextResponse.json({ error: 'Failed to update commission assignment' }, { status: 500 });
    }
    
    // Transform to match expected format
    const commission = {
      id: assignment.id,
      organization_id: assignment.organization_id,
      opportunity_id: assignment.opportunity_id,
      ghl_user_id: assignment.ghl_user_id,
      user_name: assignment.user_name,
      user_email: assignment.user_email,
      commission_type: commissionType,
      commission_percentage: assignment.base_rate,
      notes: assignment.notes,
      updated_at: assignment.updated_at,
      required_stage_id: assignment.required_stage_id,
      required_stage_name: assignment.required_stage_name,
      stage_requirement_type: assignment.stage_requirement_type
    };
    
    return NextResponse.json({ commission });
  } catch (error) {
    console.error('Error in PUT /api/opportunity-commissions:', error);
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
    
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Commission ID required' }, { status: 400 });
    }
    
    // Instead of deleting, we'll deactivate the assignment
    const { error } = await supabase
      .from('commission_assignments')
      .update({
        is_active: false,
        expiry_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organization.organizationId);
    
    if (error) {
      console.error('Error deactivating commission assignment:', error);
      return NextResponse.json({ error: 'Failed to deactivate commission assignment' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/opportunity-commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const body = await request.json();
    const { id, is_disabled } = body;
    
    if (!id || typeof is_disabled !== 'boolean') {
      return NextResponse.json({ error: 'Commission ID and is_disabled status required' }, { status: 400 });
    }
    
    // Update the is_disabled flag for the commission assignment
    const { data: assignment, error } = await supabase
      .from('commission_assignments')
      .update({
        is_disabled: is_disabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating commission assignment:', error);
      return NextResponse.json({ error: 'Failed to update commission assignment' }, { status: 500 });
    }
    
    if (!assignment) {
      return NextResponse.json({ error: 'Commission assignment not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true,
      assignment: {
        id: assignment.id,
        is_disabled: assignment.is_disabled
      }
    });
  } catch (error) {
    console.error('Error in PATCH /api/opportunity-commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}