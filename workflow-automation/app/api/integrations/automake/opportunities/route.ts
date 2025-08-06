import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = getServiceSupabase();

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const startAfterId = searchParams.get('startAfterId') || undefined;
    const pipelineId = searchParams.get('pipelineId') || undefined;
    const fromCache = searchParams.get('fromCache') === 'true';
    
    // Get organization's GHL integration
    let { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration || !integration.config?.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // Check if we have a locationId, if not, we need to fetch it first
    if (!integration.config?.locationId) {
      console.log('No locationId found, attempting to fetch locations first');
      
      // Call the locations endpoint to get and set the locationId
      const locationsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/automake/locations`, {
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });
      
      if (!locationsResponse.ok) {
        return NextResponse.json({ 
          error: 'Unable to fetch location information. Please reconnect GoHighLevel.' 
        }, { status: 400 });
      }
      
      await locationsResponse.json(); // This updates the integration with locationId
      
      // Re-fetch the integration to get the updated locationId
      const { data: updatedIntegration } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', organization.organizationId)
        .eq('type', 'gohighlevel')
        .single();
        
      if (updatedIntegration) {
        integration = updatedIntegration;
      }
      
      // If still no locationId, we can't proceed
      if (!integration.config?.locationId) {
        return NextResponse.json({ 
          error: 'No accessible locations found for this GoHighLevel account.' 
        }, { status: 400 });
      }
    }
    
    // If fromCache is true, load from database first
    if (fromCache) {
      console.log('Loading opportunities from cache first...');
      
      // Get cached opportunities
      const { data: cachedOpps, error: cacheError } = await supabase
        .from('opportunity_cache')
        .select('*')
        .eq('organization_id', organization.organizationId)
        .order('ghl_updated_at', { ascending: false });
      
      if (!cacheError && cachedOpps && cachedOpps.length > 0) {
        console.log(`Found ${cachedOpps.length} cached opportunities`);
        
        // Get pipelines - we need to create a minimal GHL client just for pipelines
        const tempGhlClient = await createGHLClient(
          integration.config?.encryptedTokens || '',
          async () => {} // No token refresh needed for quick pipeline fetch
        );
        
        const pipelinesResponse = await tempGhlClient.getPipelines();
        const pipelines = pipelinesResponse.pipelines || [];
        
        // Transform cached data to match expected format
        const opportunitiesData = await Promise.all(
          cachedOpps.map(async (opp: any) => {
            // Get receipt data
            const { data: receipts } = await supabase
              .from('opportunity_receipts')
              .select('amount')
              .eq('opportunity_id', opp.opportunity_id);
            
            const materialExpenses = receipts?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
            
            // Get labor costs
            const { data: timeEntries } = await supabase
              .from('time_entries')
              .select('total_cost')
              .eq('opportunity_id', opp.opportunity_id);
            
            const laborExpenses = timeEntries?.reduce((sum, t) => sum + Number(t.total_cost), 0) || 0;
            
            // Get commission data
            const { data: commissions } = await supabase
              .from('commission_assignments')
              .select('commission_type, base_rate, ghl_user_id')
              .eq('opportunity_id', opp.opportunity_id)
              .eq('organization_id', organization.organizationId)
              .eq('is_active', true)
              .eq('is_disabled', false);
            
            // Calculate commissions
            let grossCommissions = 0;
            let profitCommissions = 0;
            
            if (commissions && commissions.length > 0) {
              grossCommissions = commissions
                .filter(c => c.commission_type === 'percentage_gross')
                .reduce((sum, c) => sum + (opp.monetary_value * c.base_rate / 100), 0);
              
              const baseExpenses = materialExpenses + laborExpenses + grossCommissions;
              const netBeforeCommissions = opp.monetary_value - baseExpenses;
              
              profitCommissions = commissions
                .filter(c => c.commission_type === 'percentage_profit')
                .reduce((sum, c) => {
                  const percentage = Number(c.base_rate);
                  const commission = Math.max(0, netBeforeCommissions) * percentage / 100;
                  return sum + commission;
                }, 0);
            }
            
            const totalCommissions = grossCommissions + profitCommissions;
            const totalExpenses = materialExpenses + laborExpenses + totalCommissions;
            const netProfit = opp.monetary_value - totalExpenses;
            
            // Get assigned user name
            let assignedToName = null;
            if (opp.assigned_to) {
              const { data: teamMember } = await supabase
                .from('team_members')
                .select('name')
                .eq('organization_id', organization.organizationId)
                .eq('ghl_user_id', opp.assigned_to)
                .single();
              
              assignedToName = teamMember?.name || null;
            }
            
            return {
              id: opp.opportunity_id,
              name: opp.title,
              contactName: opp.contact_name,
              pipelineName: opp.pipeline_name,
              stageName: opp.stage,
              status: opp.status,
              monetaryValue: opp.monetary_value,
              totalExpenses,
              materialExpenses,
              laborExpenses,
              totalCommissions,
              grossCommissions,
              profitCommissions,
              netProfit,
              profitMargin: opp.monetary_value > 0 
                ? (netProfit / opp.monetary_value * 100)
                : 0,
              assignedTo: opp.assigned_to,
              assignedToName,
              createdAt: opp.created_at,
              updatedAt: opp.ghl_updated_at
            };
          })
        );
        
        return NextResponse.json({ 
          opportunities: opportunitiesData,
          pipelines,
          total: opportunitiesData.length,
          fromCache: true
        });
      } else {
        console.log('No cached opportunities found, will fetch from GHL');
      }
    }
    
    // Create GHL client with token refresh callback
    const ghlClient = await createGHLClient(
      integration.config?.encryptedTokens || '',
      async (newTokens) => {
        const encryptedTokens = encrypt(JSON.stringify(newTokens));
        await supabase
          .from('integrations')
          .update({
            config: {
              ...integration.config,
              encryptedTokens,
              lastTokenRefresh: new Date().toISOString()
            }
          })
          .eq('id', integration.id);
      }
    );
    
    try {
      // Get pipelines for mapping (this works)
      const pipelinesResponse = await ghlClient.getPipelines();
      const pipelines = pipelinesResponse.pipelines || [];
      
      console.log('Pipelines response:', JSON.stringify(pipelinesResponse, null, 2));
      console.log('Number of pipelines found:', pipelines.length);
      
      // Fetch and cache GHL users for name lookup
      const userMap = new Map<string, { name: string; email: string }>();
      
      try {
        console.log('Fetching GHL users for name lookup...');
        
        // Check if we have cached users in team_members table
        const { data: cachedUsers } = await supabase
          .from('team_members')
          .select('ghl_user_id, name, email')
          .eq('organization_id', organization.organizationId)
          .not('ghl_user_id', 'is', null);
        
        if (cachedUsers && cachedUsers.length > 0) {
          console.log(`Found ${cachedUsers.length} cached users in team_members`);
          cachedUsers.forEach(user => {
            if (user.ghl_user_id) {
              userMap.set(user.ghl_user_id, {
                name: user.name || 'Unknown User',
                email: user.email || ''
              });
            }
          });
        }
        
        // If we don't have many cached users, try to fetch from GHL API
        if (userMap.size < 5) {
          console.log('Fetching fresh user data from GHL API...');
          
          // Fetch users from the users endpoint if we have the scope
          const hasUsersScope = integration.config?.scope?.includes('users.readonly');
          if (hasUsersScope) {
            try {
              const usersResponse = await ghlClient.getLocationUsers({
                locationId: integration.config?.locationId || '',
                limit: 100
              });
              
              if (usersResponse.users && Array.isArray(usersResponse.users)) {
                console.log(`Fetched ${usersResponse.users.length} users from GHL API`);
                
                // Cache users in team_members table
                for (const user of usersResponse.users) {
                  const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                  userMap.set(user.id, {
                    name: userName,
                    email: user.email || ''
                  });
                  
                  // Upsert to team_members table
                  await supabase
                    .from('team_members')
                    .upsert({
                      organization_id: organization.organizationId,
                      ghl_user_id: user.id,
                      name: userName,
                      email: user.email,
                      is_active: !user.deleted,
                      updated_at: new Date().toISOString()
                    }, {
                      onConflict: 'organization_id,ghl_user_id'
                    });
                }
              }
            } catch (usersError) {
              console.log('Could not fetch users from GHL API:', usersError.message);
            }
          } else {
            console.log('No users.readonly scope available, cannot fetch user details');
          }
        }
        
        console.log(`User lookup map contains ${userMap.size} users`);
      } catch (userFetchError) {
        console.error('Error fetching/caching users:', userFetchError);
      }
      
      // Try to fetch real opportunities using the search endpoint
      console.log('Attempting to fetch real opportunities using search endpoint...');
      
      let opportunities = [];
      let paginationMeta = {};
      
      try {
        // Use getAllOpportunities to fetch ALL opportunities with pagination
        const opportunitiesResponse = await ghlClient.getAllOpportunities({
          locationId: integration.config?.locationId || '',
          pipelineId, // Filter by specific pipeline if provided
          maxResults: 5000 // Reasonable limit to prevent excessive API calls
        });
        
        console.log('All Opportunities API response:', {
          count: opportunitiesResponse.opportunities?.length || 0,
          requestCount: opportunitiesResponse.requestCount,
          hasError: !!opportunitiesResponse.error,
          meta: opportunitiesResponse.meta
        });
        
        if (opportunitiesResponse.opportunities && opportunitiesResponse.opportunities.length > 0) {
          opportunities = opportunitiesResponse.opportunities;
          paginationMeta = {
            requestCount: opportunitiesResponse.requestCount,
            maxResultsReached: opportunitiesResponse.meta?.maxResultsReached,
            totalFetched: opportunitiesResponse.meta?.totalFetched
          };
          console.log(`Successfully fetched ${opportunities.length} real opportunities in ${opportunitiesResponse.requestCount} API requests`);
          
          // Debug: Log the first opportunity to see all available fields
          if (opportunities.length > 0) {
            console.log('Sample opportunity data structure:', JSON.stringify(opportunities[0], null, 2));
          }
        } else if (opportunitiesResponse.error) {
          console.log('Opportunities API failed:', opportunitiesResponse.error);
        } else {
          console.log('No opportunities found');
        }
      } catch (opportunitiesError) {
        console.log('Opportunities search failed:', opportunitiesError);
      }
      
      // Only use real data - no mock data
      const finalOpportunities = opportunities;
      
      // Check if we should analyze pipeline stages for completion stages
      if (pipelines.length > 0 && integration.config) {
        const { data: pipelineStages } = await supabase
          .from('pipeline_stages')
          .select('pipeline_id, is_completion_stage, analyzed_at')
          .eq('integration_id', integration.id)
          .eq('is_completion_stage', true);
        
        const analyzedPipelineIds = pipelineStages?.map(ps => ps.pipeline_id) || [];
        const unanalyzedPipelines = pipelines.filter(
          (p: any) => !analyzedPipelineIds.includes(p.id)
        );
        
        // If we have unanalyzed pipelines, trigger analysis in the background
        if (unanalyzedPipelines.length > 0) {
          console.log(`Found ${unanalyzedPipelines.length} unanalyzed pipelines, triggering analysis...`);
          
          // Fire and forget - don't await
          fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/pipelines/analyze-stages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
              'Authorization': request.headers.get('authorization') || ''
            },
            body: JSON.stringify({
              pipelines: unanalyzedPipelines,
              integrationId: integration.id
            })
          }).catch(err => console.error('Pipeline analysis error:', err));
        }
        
        // Get completion stages for current pipelines
        const completionStages = integration.pipeline_completion_stages || {};
        
        // Check commission eligibility for opportunities in completion stages
        for (const opp of finalOpportunities) {
          const completionStageId = completionStages[opp.pipelineId];
          if (completionStageId && opp.pipelineStageId === completionStageId) {
            // Check if opportunity has commission assignments
            const { data: commissions } = await supabase
              .from('opportunity_commissions')
              .select('id, is_eligible_for_payout')
              .eq('opportunity_id', opp.id)
              .eq('integration_id', integration.id);
            
            if (commissions && commissions.length > 0) {
              // Mark commissions as eligible if not already
              const ineligibleCommissions = commissions.filter(c => !c.is_eligible_for_payout);
              if (ineligibleCommissions.length > 0) {
                await supabase
                  .from('opportunity_commissions')
                  .update({
                    is_eligible_for_payout: true,
                    eligibility_checked_at: new Date().toISOString(),
                    stage_at_eligibility: opp.pipelineStageId
                  })
                  .in('id', ineligibleCommissions.map(c => c.id));
                
                // Log the eligibility change
                await supabase
                  .from('commission_eligibility_log')
                  .insert({
                    opportunity_id: opp.id,
                    integration_id: integration.id,
                    new_stage_id: opp.pipelineStageId,
                    new_stage_name: pipelines.find((p: any) => p.id === opp.pipelineId)
                      ?.stages?.find((s: any) => s.id === opp.pipelineStageId)?.name,
                    became_eligible: true,
                    commission_triggered: true
                  });
              }
            }
          }
        }
      }
      
      const response = {
        opportunities: finalOpportunities,
        total: finalOpportunities.length,
        ...paginationMeta
      };
      
      // Create a map of pipeline and stage info
      const pipelineMap = new Map();
      const stageMap = new Map();
      
      pipelines.forEach((pipeline: any) => {
        pipelineMap.set(pipeline.id, pipeline.name);
        if (pipeline.stages) {
          pipeline.stages.forEach((stage: any) => {
            stageMap.set(stage.id, stage.name);
          });
        }
      });
      
      // Transform and cache opportunities
      const opportunitiesData = await Promise.all(
        (response.opportunities || []).map(async (opp: any) => {
          // Handle both real GHL API format and mock data format
          const opportunityData = {
            organization_id: organization.organizationId,
            opportunity_id: opp.id,
            title: opp.name || opp.title || 'Unnamed Opportunity',
            contact_id: opp.contactId || opp.contact?.id || opp.contact_id,
            contact_name: opp.contact?.name || opp.contact?.firstName + ' ' + opp.contact?.lastName || opp.contact?.email || 'Unknown Contact',
            contact_email: opp.contact?.email || null,
            contact_phone: opp.contact?.phone || null,
            pipeline_id: opp.pipelineId || opp.pipeline_id,
            pipeline_name: pipelineMap.get(opp.pipelineId || opp.pipeline_id) || 'Unknown Pipeline',
            stage: stageMap.get(opp.pipelineStageId || opp.pipeline_stage_id) || 'Unknown Stage',
            status: opp.status || 'open',
            monetary_value: opp.monetaryValue || opp.monetary_value || 0,
            assigned_to: opp.assignedTo || opp.assignedUserId || opp.assigned_to || null,
            total_expenses: 0,  // Will be calculated from receipts
            total_labor_cost: 0,  // Will be calculated from time entries
            ghl_updated_at: opp.updatedAt || opp.dateUpdated || opp.updated_at,
            last_synced_at: new Date().toISOString()
          };
          
          // Upsert to cache
          const { data: cachedOpp, error: cacheError } = await supabase
            .from('opportunity_cache')
            .upsert(opportunityData, { onConflict: 'organization_id,opportunity_id' })
            .select()
            .single();
          
          if (cacheError) {
            console.error('Error caching opportunity:', cacheError);
            console.error('Opportunity data:', opportunityData);
            throw cacheError;
          }
          
          // Store assigned user name for commission assignment
          let assignedUserName = null;
          
          // If we have an assigned user, try to get their name
          if (opportunityData.assigned_to) {
            // Check if we have the name in our map
            if (userMap.has(opportunityData.assigned_to)) {
              assignedUserName = userMap.get(opportunityData.assigned_to)!.name;
            } else {
              // Try to fetch user details individually
              try {
                console.log(`Fetching user details for ${opportunityData.assigned_to}`);
                const userResponse = await ghlClient.makeRequest(`/users/${opportunityData.assigned_to}`);
                if (userResponse && userResponse.name) {
                  const userName = userResponse.name || `${userResponse.firstName || ''} ${userResponse.lastName || ''}`.trim() || userResponse.email;
                  assignedUserName = userName;
                  
                  // Cache the user for future use
                  userMap.set(opportunityData.assigned_to, {
                    name: userName,
                    email: userResponse.email || ''
                  });
                  
                  // Update team_members table
                  await supabase
                    .from('team_members')
                    .upsert({
                      organization_id: organization.organizationId,
                      ghl_user_id: opportunityData.assigned_to,
                      name: userName,
                      email: userResponse.email,
                      is_active: true,
                      updated_at: new Date().toISOString()
                    }, {
                      onConflict: 'organization_id,ghl_user_id'
                    });
                }
              } catch (userError) {
                console.log(`Could not fetch user details for ${opportunityData.assigned_to}:`, userError.message);
              }
            }
          }
          
          // Auto-assign commission structure based on assigned user
          if (opportunityData.assigned_to) {
            console.log('Processing commission assignment for opportunity:', {
              opportunityId: opp.id,
              assignedTo: opportunityData.assigned_to,
              assignedToName: assignedUserName,
              monetaryValue: opportunityData.monetary_value
            });
            
            // Check if commission assignment already exists for this opportunity
            const { data: existingAssignment } = await supabase
              .from('commission_assignments')
              .select('id, ghl_user_id')
              .eq('opportunity_id', opp.id)
              .eq('organization_id', organization.organizationId)
              .eq('assignment_type', 'opportunity')
              .limit(1);
            
            console.log('Existing commission assignments:', existingAssignment);
            
            // Only create/update commission assignment if none exist or assigned user changed
            const needsUpdate = !existingAssignment || existingAssignment.length === 0 || 
                               (existingAssignment[0].ghl_user_id !== opportunityData.assigned_to);
            
            if (needsUpdate) {
              // First try to look up via user_payment_assignments
              let paymentStructure = null;
              
              const { data: paymentAssignment } = await supabase
                .from('user_payment_assignments')
                .select(`
                  ghl_user_id,
                  payment_structure_id,
                  payment_structures:user_payment_structures!inner(
                    user_id,
                    ghl_user_name,
                    ghl_user_email,
                    commission_percentage
                  )
                `)
                .eq('organization_id', organization.organizationId)
                .eq('ghl_user_id', opportunityData.assigned_to)
                .eq('is_active', true)
                .single();
              
              if (paymentAssignment?.payment_structures) {
                paymentStructure = paymentAssignment.payment_structures;
              } else {
                // Fallback: Look up payment structure directly by GHL user ID
                const { data: directStructure } = await supabase
                  .from('user_payment_structures')
                  .select('*')
                  .eq('organization_id', organization.organizationId)
                  .eq('user_id', opportunityData.assigned_to)
                  .eq('is_active', true)
                  .single();
                
                if (directStructure) {
                  paymentStructure = directStructure;
                }
              }
              
              console.log('Payment structure lookup result:', {
                found: !!paymentStructure,
                ghlUserId: opportunityData.assigned_to,
                paymentStructure
              });
              
              if (paymentStructure && paymentStructure.commission_percentage) {
                const structure = paymentStructure;
                
                if (existingAssignment && existingAssignment.length > 0) {
                  // Update existing assignment with new user
                  const { data: updatedAssignment, error: updateError } = await supabase
                    .from('commission_assignments')
                    .update({
                      ghl_user_id: opportunityData.assigned_to,
                      user_name: structure.ghl_user_name || assignedUserName,
                      user_email: structure.ghl_user_email,
                      commission_type: 'percentage_profit', // Default to profit-based
                      base_rate: structure.commission_percentage, // Use actual percentage from payment structure
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', existingAssignment[0].id)
                    .select();
                  
                  if (updateError) {
                    console.error('Error updating commission assignment:', updateError);
                  } else {
                    console.log('Updated commission assignment:', updatedAssignment);
                  }
                } else {
                  // Create new commission assignment for this opportunity
                  const { data: newAssignment, error: assignmentError } = await supabase
                    .from('commission_assignments')
                    .insert({
                      organization_id: organization.organizationId,
                      assignment_type: 'opportunity',
                      opportunity_id: opp.id,
                      ghl_user_id: opportunityData.assigned_to,
                      user_name: structure.ghl_user_name || assignedUserName,
                      user_email: structure.ghl_user_email,
                      commission_type: 'percentage_profit', // Default to profit-based
                      base_rate: structure.commission_percentage, // Use actual percentage from payment structure
                      is_active: true,
                      is_disabled: false, // Start enabled by default
                      notes: 'Auto-assigned based on opportunity assignment',
                      created_by: userId
                    })
                    .select();
                  
                  if (assignmentError) {
                    console.error('Error creating commission assignment:', assignmentError);
                  } else {
                    console.log('Created commission assignment:', newAssignment);
                  }
                }
              } else {
                console.log('No payment structure found for user:', opportunityData.assigned_to);
              }
            } else {
              console.log('Commission assignment already exists with correct user for opportunity:', opp.id);
            }
          } else {
            console.log('No assigned user for opportunity:', opp.id);
            
            // If opportunity is unassigned, deactivate any existing commission assignments
            const { data: existingAssignment } = await supabase
              .from('commission_assignments')
              .select('id')
              .eq('opportunity_id', opp.id)
              .eq('organization_id', organization.organizationId)
              .eq('assignment_type', 'opportunity')
              .eq('is_active', true);
            
            if (existingAssignment && existingAssignment.length > 0) {
              console.log('Deactivating commission assignment for unassigned opportunity:', opp.id);
              await supabase
                .from('commission_assignments')
                .update({
                  is_active: false,
                  updated_at: new Date().toISOString(),
                  notes: 'Deactivated: opportunity unassigned'
                })
                .eq('opportunity_id', opp.id)
                .eq('organization_id', organization.organizationId)
                .eq('assignment_type', 'opportunity');
            }
          }
          
          // Get receipt data for this opportunity
          const { data: receipts } = await supabase
            .from('opportunity_receipts')
            .select('amount')
            .eq('opportunity_id', opp.id);
          
          const materialExpenses = receipts?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
          
          // Get labor costs for this opportunity
          const { data: timeEntries } = await supabase
            .from('time_entries')
            .select('total_cost')
            .eq('opportunity_id', opp.id);
          
          const laborExpenses = timeEntries?.reduce((sum, t) => sum + Number(t.total_cost), 0) || 0;
          
          // Get commission data from commission_assignments table
          const { data: commissions } = await supabase
            .from('commission_assignments')
            .select('commission_type, base_rate, ghl_user_id')
            .eq('opportunity_id', opp.id)
            .eq('organization_id', organization.organizationId)
            .eq('is_active', true)
            .eq('is_disabled', false);
          
          // Remove duplicate commissions (by ghl_user_id and commission_type)
          const uniqueCommissions = commissions?.filter((commission, index, self) => 
            index === self.findIndex(c => 
              c.ghl_user_id === commission.ghl_user_id && 
              c.commission_type === commission.commission_type
            )
          ) || [];
          
          // Calculate commissions
          let grossCommissions = 0;
          let profitCommissions = 0;
          
          if (uniqueCommissions && uniqueCommissions.length > 0) {
            
            // Calculate gross-based commissions first (based on total revenue)
            grossCommissions = uniqueCommissions
              .filter(c => c.commission_type === 'percentage_gross')
              .reduce((sum, c) => sum + (opportunityData.monetary_value * c.base_rate / 100), 0);
            
            // Calculate expenses (material + labor + gross commissions)
            const baseExpenses = materialExpenses + laborExpenses + grossCommissions;
            const netBeforeCommissions = opportunityData.monetary_value - baseExpenses;
            
            // Calculate profit-based commissions on the net profit (before profit commissions)
            profitCommissions = uniqueCommissions
              .filter(c => c.commission_type === 'percentage_profit')
              .reduce((sum, c) => {
                const percentage = Number(c.base_rate);
                const commission = Math.max(0, netBeforeCommissions) * percentage / 100;
                return sum + commission;
              }, 0);
          }
          
          const totalCommissions = grossCommissions + profitCommissions;
          const totalExpenses = materialExpenses + laborExpenses + totalCommissions;
          const netProfit = opportunityData.monetary_value - totalExpenses;
          
          return {
            id: opp.id,
            name: opportunityData.title,
            contactName: opportunityData.contact_name,
            pipelineName: opportunityData.pipeline_name,
            stageName: opportunityData.stage,
            status: opportunityData.status,
            monetaryValue: opportunityData.monetary_value,
            totalExpenses,
            materialExpenses,
            laborExpenses,
            totalCommissions,
            grossCommissions,
            profitCommissions,
            netProfit,
            profitMargin: opportunityData.monetary_value > 0 
              ? (netProfit / opportunityData.monetary_value * 100)
              : 0,
            assignedTo: opportunityData.assigned_to,
            assignedToName: assignedUserName,
            createdAt: opp.createdAt,
            updatedAt: opp.updatedAt
          };
        })
      );
      
      return NextResponse.json({ 
        opportunities: opportunitiesData,
        pipelines,
        total: response.total || opportunitiesData.length,
        limit,
        startAfterId: response.meta?.startAfterId,
      });
      
    } catch (apiError: any) {
      console.error('GHL API error:', apiError);
      console.error('Error details:', {
        message: apiError.message,
        response: apiError.response,
        status: apiError.status
      });
      
      if (apiError.message?.includes('401') || apiError.message?.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Authentication failed. Please reconnect GoHighLevel.' }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: apiError.message || 'Failed to fetch opportunities',
        details: apiError.toString()
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}