import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Get organization's GHL integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      return NextResponse.json(
        { error: 'No active GoHighLevel integration found' },
        { status: 404 }
      );
    }

    // Build query
    let dbQuery = supabase
      .from('contacts')
      .select('*')
      .eq('integration_id', integration.id)
      .eq('sync_status', 'synced')
      .order('full_name', { ascending: true })
      .limit(limit);

    // Apply search filter if provided
    if (query) {
      const searchTerm = `%${query}%`;
      dbQuery = dbQuery.or(
        `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},full_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`
      );
    }

    const { data: contacts, error: dbError } = await dbQuery;

    if (dbError) {
      console.error('Database search error:', dbError);
      return NextResponse.json(
        { error: 'Failed to search contacts' },
        { status: 500 }
      );
    }

    // Check if database is empty and suggest sync
    if (!contacts || contacts.length === 0) {
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('integration_id', integration.id);

      if (count === 0) {
        return NextResponse.json({
          contacts: [],
          message: 'No contacts found. Run a sync to import contacts from GoHighLevel.',
          needsSync: true
        });
      }
    }

    return NextResponse.json({
      contacts: contacts || [],
      count: contacts?.length || 0,
      query: query || null
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}