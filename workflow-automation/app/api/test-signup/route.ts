import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  console.log('Test signup endpoint called');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key exists:', !!supabaseKey);
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      error: 'Missing Supabase configuration',
      url: supabaseUrl || 'missing',
      keyExists: !!supabaseKey
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: Can we query organizations?
    console.log('Testing organizations query...');
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('count')
      .limit(1);
      
    console.log('Organizations query result:', { orgData, orgError });
    
    // Test 2: Can we query users?
    console.log('Testing users query...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
      
    console.log('Users query result:', { userData, userError });
    
    // Test 3: Try to create a test org
    console.log('Testing organization creation...');
    const testOrgName = `Test Org ${Date.now()}`;
    const { data: newOrg, error: createOrgError } = await supabase
      .from('organizations')
      .insert({
        name: testOrgName,
        slug: `test-org-${Date.now()}`,
        subscription_status: 'trial',
        subscription_plan: 'free'
      })
      .select()
      .single();
      
    console.log('Organization creation result:', { newOrg, createOrgError });
    
    // Clean up test org if created
    if (newOrg?.id) {
      await supabase.from('organizations').delete().eq('id', newOrg.id);
    }
    
    return NextResponse.json({
      success: true,
      tests: {
        orgQuery: { success: !orgError, error: orgError },
        userQuery: { success: !userError, error: userError },
        orgCreate: { success: !createOrgError, error: createOrgError }
      }
    });
    
  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}