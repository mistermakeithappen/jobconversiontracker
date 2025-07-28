import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const searchParams = request.nextUrl.searchParams;
    const opportunityId = searchParams.get('opportunityId');
    
    if (!opportunityId) {
      return NextResponse.json({ error: 'Opportunity ID required' }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    
    const { data: commissions, error } = await supabase
      .from('opportunity_commissions')
      .select('*')
      .eq('user_id', userId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching commissions:', error);
      return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
    }
    
    return NextResponse.json({ commissions: commissions || [] });
  } catch (error) {
    console.error('Error in GET /api/opportunity-commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const body = await request.json();
    
    const {
      opportunityId,
      integrationId,
      ghlUserId,
      userName,
      userEmail,
      commissionType,
      commissionPercentage,
      notes
    } = body;
    
    if (!opportunityId || !integrationId || !ghlUserId || !commissionType || 
        commissionPercentage === undefined || commissionPercentage === null || 
        isNaN(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
      return NextResponse.json({ 
        error: 'Missing or invalid required fields. Commission percentage must be a number between 0 and 100.' 
      }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    
    const insertData = {
      user_id: userId,
      opportunity_id: opportunityId,
      integration_id: integrationId,
      ghl_user_id: ghlUserId,
      user_name: userName,
      user_email: userEmail,
      commission_type: commissionType,
      commission_percentage: commissionPercentage,
      notes
    };
    
    const { data: commission, error } = await supabase
      .from('opportunity_commissions')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating commission:', error);
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ 
          error: 'This team member already has a commission assignment for this opportunity' 
        }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create commission' }, { status: 500 });
    }
    
    return NextResponse.json({ commission });
  } catch (error) {
    console.error('Error in POST /api/opportunity-commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const body = await request.json();
    
    const {
      id,
      commissionType,
      commissionPercentage,
      notes
    } = body;
    
    if (!id || !commissionType || commissionPercentage === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    
    const { data: commission, error } = await supabase
      .from('opportunity_commissions')
      .update({
        commission_type: commissionType,
        commission_percentage: commissionPercentage,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating commission:', error);
      return NextResponse.json({ error: 'Failed to update commission' }, { status: 500 });
    }
    
    return NextResponse.json({ commission });
  } catch (error) {
    console.error('Error in PUT /api/opportunity-commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Commission ID required' }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    
    const { error } = await supabase
      .from('opportunity_commissions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting commission:', error);
      return NextResponse.json({ error: 'Failed to delete commission' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/opportunity-commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}