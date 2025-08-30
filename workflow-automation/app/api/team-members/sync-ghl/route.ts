import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ 
        error: 'No organization found'
      }, { status: 404 });
    }

    // Fetch GHL users from the existing endpoint
    const ghlResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/automake/users`, {
      headers: request.headers
    });

    if (!ghlResponse.ok) {
      const error = await ghlResponse.json();
      return NextResponse.json({ 
        error: error.error || 'Failed to fetch GHL users'
      }, { status: ghlResponse.status });
    }

    const ghlData = await ghlResponse.json();
    const ghlUsers = ghlData.users || [];

    if (ghlUsers.length === 0) {
      return NextResponse.json({ 
        message: 'No GHL users found to sync',
        synced: 0
      });
    }

    // Sync each GHL user to team_members table
    let syncedCount = 0;
    const errors = [];

    for (const ghlUser of ghlUsers) {
      try {
        // Check if team member already exists
        const { data: existing } = await supabase
          .from('team_members')
          .select('id')
          .eq('organization_id', organization.organizationId)
          .eq('external_id', ghlUser.id)
          .single();

        if (!existing) {
          // Create new team member
          const { error: insertError } = await supabase
            .from('team_members')
            .insert({
              organization_id: organization.organizationId,
              external_id: ghlUser.id,
              ghl_user_id: ghlUser.id,
              email: ghlUser.email,
              full_name: ghlUser.name || `${ghlUser.firstName || ''} ${ghlUser.lastName || ''}`.trim() || ghlUser.email,
              name: ghlUser.firstName || ghlUser.name?.split(' ')[0] || '',
              phone: ghlUser.phone || null,
              is_active: ghlUser.isActive !== false
            });

          if (insertError) {
            console.error(`Error syncing user ${ghlUser.email}:`, insertError);
            errors.push(`${ghlUser.email}: ${insertError.message}`);
          } else {
            syncedCount++;
          }
        } else {
          // Update existing team member
          const { error: updateError } = await supabase
            .from('team_members')
            .update({
              email: ghlUser.email,
              full_name: ghlUser.name || `${ghlUser.firstName || ''} ${ghlUser.lastName || ''}`.trim() || ghlUser.email,
              name: ghlUser.firstName || ghlUser.name?.split(' ')[0] || '',
              phone: ghlUser.phone || null,
              is_active: ghlUser.isActive !== false,
              ghl_user_id: ghlUser.id
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Error updating user ${ghlUser.email}:`, updateError);
            errors.push(`${ghlUser.email}: ${updateError.message}`);
          } else {
            syncedCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing user ${ghlUser.email}:`, error);
        errors.push(`${ghlUser.email}: ${error}`);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Synced ${syncedCount} of ${ghlUsers.length} users`,
      synced: syncedCount,
      total: ghlUsers.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in sync GHL team-members API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}