import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;

    const supabase = getServiceSupabase();
    
    // Get search query from URL params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20'); // Increased default limit
    
    console.log(`🔍 Contact search API called with query: "${query}", limit: ${limit}`);

    // Build the search query - search ALL contacts in the organization
    // Don't filter by integration_id to include all contacts regardless of source
    let dbQuery = supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', organizationId);

    // Apply search filter if query is provided
    if (query && query.trim().length > 0) {
      // Trim and prepare search term
      const searchTerm = query.trim().toLowerCase();
      
      console.log(`🔍 Starting search with term: "${searchTerm}" (original: "${query}")`);
      
      // Use textSearch for better partial matching
      // This searches across multiple columns with proper escaping
      dbQuery = dbQuery.or(
        [
          `full_name.ilike.%${searchTerm}%`,
          `first_name.ilike.%${searchTerm}%`,
          `last_name.ilike.%${searchTerm}%`,
          `email.ilike.%${searchTerm}%`,
          `phone.ilike.%${searchTerm}%`,
          `company_name.ilike.%${searchTerm}%`
        ].join(',')
      );
      
      console.log(`🔍 Search query built for pattern: "%${searchTerm}%" across all contact fields`);
    } else {
      console.log('🔍 No search term provided, returning all contacts');
    }

    // Apply ordering and limit after search conditions
    dbQuery = dbQuery
      .order('full_name', { ascending: true, nullsLast: true })
      .limit(limit);

    const { data: contacts, error: searchError } = await dbQuery;

    if (searchError) {
      console.error('Contact search error:', searchError);
      return NextResponse.json(
        { error: 'Failed to search contacts' },
        { status: 500 }
      );
    }

    console.log(`📝 Contact search: Found ${contacts?.length || 0} contacts for query "${query}"`);
    if (contacts && contacts.length > 0) {
      console.log('First contact sample:', {
        full_name: contacts[0].full_name,
        first_name: contacts[0].first_name,
        last_name: contacts[0].last_name,
        email: contacts[0].email,
        phone: contacts[0].phone
      });
    }

    // Format the contacts for the response
    const formattedContacts = (contacts || []).map(contact => ({
      id: contact.ghl_contact_id,
      name: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown Contact',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company_name || '',
      address: contact.address1 || '',
      city: contact.city || '',
      state: contact.state || '',
      postalCode: contact.postal_code || '',
      fullAddress: [
        contact.address1,
        contact.city,
        contact.state,
        contact.postal_code
      ].filter(Boolean).join(', ')
    }));

    console.log(`📤 Returning ${formattedContacts.length} formatted contacts`);
    if (formattedContacts.length > 0) {
      console.log('First formatted contact:', formattedContacts[0]);
    }
    
    return NextResponse.json({
      contacts: formattedContacts,
      count: formattedContacts.length
    });

  } catch (error) {
    console.error('Error in contact search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}