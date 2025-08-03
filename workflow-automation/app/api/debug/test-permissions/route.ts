import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';

export async function GET() {
  const supabase = getServiceSupabase();
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as any[]
  };

  // Test 1: Check if we can query organizations table
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('count')
      .limit(1);
    
    results.tests.push({
      test: 'Query organizations table',
      success: !error,
      error: error?.message || null,
      details: error?.details || null
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Query organizations table',
      success: false,
      error: e.message,
      stack: e.stack
    });
  }

  // Test 2: Check if we can insert into organizations
  try {
    const testOrg = {
      name: 'Permission Test Org',
      slug: `test-org-${Date.now()}`,
      subscription_status: 'trial',
      subscription_plan: 'free'
    };

    const { data, error } = await supabase
      .from('organizations')
      .insert(testOrg)
      .select()
      .single();
    
    if (data) {
      // Clean up test data
      await supabase.from('organizations').delete().eq('id', data.id);
    }

    results.tests.push({
      test: 'Insert into organizations table',
      success: !error,
      error: error?.message || null,
      details: error?.details || null,
      hint: error?.hint || null
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Insert into organizations table',
      success: false,
      error: e.message,
      stack: e.stack
    });
  }

  // Test 3: Check current database user
  try {
    const { data, error } = await supabase
      .rpc('current_user')
      .single();
    
    results.tests.push({
      test: 'Get current database user',
      success: !error,
      user: data || null,
      error: error?.message || null
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Get current database user',
      success: false,
      error: 'Function may not exist'
    });
  }

  // Test 4: Check schema permissions
  try {
    const { data, error } = await supabase
      .from('pg_namespace')
      .select('nspname')
      .eq('nspname', 'public')
      .single();
    
    results.tests.push({
      test: 'Access pg_namespace',
      success: !error,
      error: error?.message || null
    });
  } catch (e: any) {
    results.tests.push({
      test: 'Access pg_namespace',
      success: false,
      error: e.message
    });
  }

  // Test 5: Check if extensions are available
  try {
    const { data: uuidExt, error: uuidError } = await supabase
      .rpc('uuid_generate_v4')
      .single();
    
    results.tests.push({
      test: 'UUID extension',
      success: !uuidError,
      error: uuidError?.message || null
    });
  } catch (e: any) {
    results.tests.push({
      test: 'UUID extension',
      success: false,
      error: 'Extension may not be available'
    });
  }

  // Summary
  const allPassed = results.tests.every(t => t.success);
  results.summary = {
    totalTests: results.tests.length,
    passed: results.tests.filter(t => t.success).length,
    failed: results.tests.filter(t => !t.success).length,
    allPassed
  };

  return NextResponse.json(results, { 
    status: allPassed ? 200 : 500,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}