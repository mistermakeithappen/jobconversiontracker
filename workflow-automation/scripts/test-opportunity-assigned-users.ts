import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testOpportunityAssignedUsers() {
  try {
    console.log('Testing GHL Opportunity Assigned Users...\n');

    // Get the first organization's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .limit(1)
      .single();

    if (error || !integration) {
      console.error('No GHL integration found:', error);
      return;
    }

    console.log('Found integration for organization:', integration.organization_id);
    console.log('Location ID:', integration.config.locationId);

    // Create GHL client
    const ghlClient = await createGHLClient(
      integration.config.encryptedTokens,
      async (newTokens) => {
        console.log('Token refresh callback triggered');
      }
    );

    // Fetch opportunities with different methods to see what fields are available
    console.log('\n1. Testing search endpoint for opportunities...');
    
    let searchResponse: any = null;
    
    try {
      // First, let's get a small batch to inspect the data structure
      searchResponse = await ghlClient.makeRequest(
        `/opportunities/search?location_id=${integration.config.locationId}&limit=5`
      );
      
      console.log('\nSearch API Response Structure:');
      console.log('Total opportunities found:', searchResponse.opportunities?.length || 0);
      
      if (searchResponse.opportunities && searchResponse.opportunities.length > 0) {
        console.log('\n--- First Opportunity Full Data ---');
        console.log(JSON.stringify(searchResponse.opportunities[0], null, 2));
        
        console.log('\n--- Assigned User Fields Analysis ---');
        searchResponse.opportunities.forEach((opp: any, index: number) => {
          console.log(`\nOpportunity ${index + 1}: ${opp.name || opp.title || 'Unnamed'}`);
          console.log('  ID:', opp.id);
          console.log('  assignedTo:', opp.assignedTo || 'NOT FOUND');
          console.log('  assigned_to:', opp.assigned_to || 'NOT FOUND');
          console.log('  assignedUserId:', opp.assignedUserId || 'NOT FOUND');
          console.log('  assigned_user_id:', opp.assigned_user_id || 'NOT FOUND');
          console.log('  assignedUser:', opp.assignedUser || 'NOT FOUND');
          console.log('  user:', opp.user || 'NOT FOUND');
          console.log('  userId:', opp.userId || 'NOT FOUND');
          console.log('  owner:', opp.owner || 'NOT FOUND');
          console.log('  ownerId:', opp.ownerId || 'NOT FOUND');
          
          // Check if there's any nested user data
          if (opp.assignedUser && typeof opp.assignedUser === 'object') {
            console.log('  assignedUser object:', JSON.stringify(opp.assignedUser, null, 2));
          }
          
          // List all fields that contain 'user' or 'assign'
          const userFields = Object.keys(opp).filter(key => 
            key.toLowerCase().includes('user') || key.toLowerCase().includes('assign')
          );
          if (userFields.length > 0) {
            console.log('  All user/assign related fields:', userFields);
          }
        });
      }
    } catch (searchError) {
      console.error('Search endpoint error:', searchError);
    }

    // Test getting a single opportunity to see if more fields are available
    console.log('\n\n2. Testing individual opportunity endpoint...');
    
    if (searchResponse.opportunities && searchResponse.opportunities.length > 0) {
      const firstOppId = searchResponse.opportunities[0].id;
      
      try {
        const singleOppResponse = await ghlClient.getOpportunity(firstOppId);
        
        console.log('\nSingle Opportunity API Response:');
        console.log(JSON.stringify(singleOppResponse, null, 2));
        
        // Check for user fields
        console.log('\n--- Single Opportunity User Fields ---');
        const userFields = Object.keys(singleOppResponse).filter(key => 
          key.toLowerCase().includes('user') || key.toLowerCase().includes('assign')
        );
        console.log('User/assign related fields:', userFields);
        
      } catch (singleError) {
        console.error('Single opportunity endpoint error:', singleError);
      }
    }

    // Check what's stored in our database
    console.log('\n\n3. Checking opportunity_cache table...');
    
    const { data: cachedOpps, error: cacheError } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, name, assigned_to, assigned_to_name')
      .eq('organization_id', integration.organization_id)
      .limit(10);

    if (cachedOpps && cachedOpps.length > 0) {
      console.log('\nCached opportunities with assigned users:');
      cachedOpps.forEach(opp => {
        console.log(`- ${opp.name}: assigned_to=${opp.assigned_to || 'NULL'}, assigned_to_name=${opp.assigned_to_name || 'NULL'}`);
      });
    }

    // Check commission assignments
    console.log('\n\n4. Checking commission_assignments table...');
    
    const { data: assignments, error: assignError } = await supabase
      .from('commission_assignments')
      .select('opportunity_id, ghl_user_id, user_name, commission_type, base_rate')
      .eq('organization_id', integration.organization_id)
      .eq('assignment_type', 'opportunity')
      .limit(10);

    if (assignments && assignments.length > 0) {
      console.log('\nExisting commission assignments:');
      assignments.forEach(assign => {
        console.log(`- Opportunity ${assign.opportunity_id}: User ${assign.user_name || assign.ghl_user_id}, ${assign.commission_type} @ ${assign.base_rate}%`);
      });
    } else {
      console.log('\nNo commission assignments found for opportunities.');
    }

    // Check payment structures
    console.log('\n\n5. Checking user_payment_assignments...');
    
    const { data: paymentAssignments, error: payError } = await supabase
      .from('user_payment_assignments')
      .select(`
        ghl_user_id,
        payment_structures:user_payment_structures!inner(
          ghl_user_name,
          commission_percentage
        )
      `)
      .eq('organization_id', integration.organization_id)
      .eq('is_active', true);

    if (paymentAssignments && paymentAssignments.length > 0) {
      console.log('\nActive payment structures:');
      paymentAssignments.forEach(pa => {
        console.log(`- User ID: ${pa.ghl_user_id}, Name: ${pa.payment_structures.ghl_user_name}, Commission: ${pa.payment_structures.commission_percentage}%`);
      });
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testOpportunityAssignedUsers();