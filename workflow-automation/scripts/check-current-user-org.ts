import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUserOrganization() {
  try {
    // Check the specific user ID from the logs
    const userId = '12518c46-1422-4321-851b-bd7b467b5dbc';
    
    console.log('Checking user:', userId);
    
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error('User not found:', userError);
      return;
    }
    
    console.log('User found:', user);
    
    // Check organization membership
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        *,
        organizations(*)
      `)
      .eq('user_id', userId)
      .single();
      
    if (orgError) {
      console.error('Organization membership error:', orgError);
      return;
    }
    
    console.log('Organization membership:', orgMember);
    
    // Check all organizations
    const { data: allOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');
      
    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      return;
    }
    
    console.log('All organizations:', allOrgs);
    
    // Check all organization members
    const { data: allMembers, error: membersError } = await supabase
      .from('organization_members')
      .select('*');
      
    if (membersError) {
      console.error('Error fetching members:', membersError);
      return;
    }
    
    console.log('All organization members:', allMembers);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUserOrganization();
