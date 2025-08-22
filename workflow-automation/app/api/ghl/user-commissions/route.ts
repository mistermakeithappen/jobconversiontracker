import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function GET(request: NextRequest) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);

    const supabase = getServiceSupabase();

    // Get user's integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();

    if (!integration) {
      return NextResponse.json({ commissions: [] });
    }

    // Get all user commissions for this integration
    const { data: commissions, error } = await supabase
      .from('ghl_user_commissions')
      .select('*')
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .order('user_name', { ascending: true });

    if (error) {
      console.error('Error fetching user commissions:', error);
      return NextResponse.json({ error: 'Failed to fetch user commissions' }, { status: 500 });
    }

    return NextResponse.json({ commissions: commissions || [] });
  } catch (error) {
    console.error('Error in user commissions GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);

    const body = await request.json();
    const {
      ghl_user_id,
      user_name,
      user_email,
      commission_type,
      commission_percentage,
      subscription_commission_percentage,
      subscription_commission_type,
      subscription_duration_months,
      notes
    } = body;

    // Validation
    if (!ghl_user_id || !user_name || !user_email) {
      return NextResponse.json({ 
        error: 'Missing required fields: ghl_user_id, user_name, user_email' 
      }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get user's integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'GoHighLevel integration not found' }, { status: 404 });
    }

    // Check if commission already exists for this user
    const { data: existing } = await supabase
      .from('ghl_user_commissions')
      .select('id')
      .eq('integration_id', integration.id)
      .eq('ghl_user_id', ghl_user_id)
      .single();

    if (existing) {
      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from('ghl_user_commissions')
        .update({
          user_name,
          user_email,
          commission_type: commission_type || 'gross',
          commission_percentage: commission_percentage || 10,
          subscription_commission_percentage: subscription_commission_percentage || 5,
          subscription_commission_type: subscription_commission_type || 'first_payment_only',
          subscription_duration_months: subscription_duration_months || 12,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user commission:', updateError);
        return NextResponse.json({ error: 'Failed to update user commission' }, { status: 500 });
      }

      return NextResponse.json({ 
        commission: updated,
        message: 'User commission updated successfully'
      });
    } else {
      // Create new record
      const { data: created, error: createError } = await supabase
        .from('ghl_user_commissions')
        .insert({
          user_id: user.id,
          integration_id: integration.id,
          ghl_user_id,
          user_name,
          user_email,
          commission_type: commission_type || 'gross',
          commission_percentage: commission_percentage || 10,
          subscription_commission_percentage: subscription_commission_percentage || 5,
          subscription_commission_type: subscription_commission_type || 'first_payment_only',
          subscription_duration_months: subscription_duration_months || 12,
          notes,
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user commission:', createError);
        return NextResponse.json({ error: 'Failed to create user commission' }, { status: 500 });
      }

      return NextResponse.json({ 
        commission: created,
        message: 'User commission created successfully'
      });
    }
  } catch (error) {
    console.error('Error in user commissions POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Commission ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('ghl_user_commissions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting user commission:', error);
      return NextResponse.json({ error: 'Failed to delete user commission' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User commission removed successfully' });
  } catch (error) {
    console.error('Error in user commissions DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}