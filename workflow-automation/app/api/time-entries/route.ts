import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get('opportunityId');
    
    if (!opportunityId) {
      return NextResponse.json({ error: 'Opportunity ID is required' }, { status: 400 });
    }

    const { data: timeEntries, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching time entries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ timeEntries });

  } catch (error) {
    console.error('Error in time entries GET:', error);
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
      user_id: ghl_user_id,
      user_name,
      user_email,
      hours,
      hourly_rate,
      description,
      work_date
    } = body;

    if (!opportunityId || !ghl_user_id || !hours || !work_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: opportunityId, user_id, hours, work_date' 
      }, { status: 400 });
    }

    // Calculate total cost
    const totalCost = hourly_rate ? hours * hourly_rate : 0;

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: userId,
        opportunity_id: opportunityId,
        integration_id: integrationId,
        ghl_user_id: ghl_user_id,
        user_name,
        user_email,
        hours: parseFloat(hours),
        hourly_rate: hourly_rate ? parseFloat(hourly_rate) : null,
        description,
        work_date,
        total_cost: totalCost
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating time entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ timeEntry });

  } catch (error) {
    console.error('Error in time entries POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const body = await request.json();
    
    const {
      id,
      user_id: ghl_user_id,
      user_name,
      user_email,
      hours,
      hourly_rate,
      description,
      work_date
    } = body;

    if (!id || !ghl_user_id || !hours || !description || !work_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, user_id, hours, description, work_date' 
      }, { status: 400 });
    }

    // Calculate total cost
    const totalCost = hourly_rate ? hours * hourly_rate : 0;

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .update({
        ghl_user_id: ghl_user_id,
        user_name,
        user_email,
        hours: parseFloat(hours),
        hourly_rate: hourly_rate ? parseFloat(hourly_rate) : null,
        description,
        work_date,
        total_cost: totalCost
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating time entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ timeEntry });

  } catch (error) {
    console.error('Error in time entries PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Time entry ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting time entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in time entries DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}