#!/usr/bin/env tsx

/**
 * Multi-Tenant API Test Script
 * 
 * This script tests all updated API endpoints to ensure they work correctly
 * with the new multi-tenant database structure.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const MOCK_USER_ID = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

// Mock cookie for auth
const mockCookie = `mock-user-id=${MOCK_USER_ID}`;

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  data?: any;
}

const testResults: TestResult[] = [];

async function testEndpoint(
  method: string,
  endpoint: string,
  body?: any
): Promise<TestResult> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Cookie': mockCookie,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    const result: TestResult = {
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      data
    };

    if (!response.ok) {
      result.error = data.error || 'Request failed';
    }

    return result;
  } catch (error) {
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Multi-Tenant API Endpoints\n');

  // 1. Test Company Credit Cards API
  console.log('📋 Testing Company Credit Cards API...');
  
  testResults.push(await testEndpoint('GET', '/api/company-credit-cards'));
  
  testResults.push(await testEndpoint('POST', '/api/company-credit-cards', {
    cardName: 'Test Card',
    lastFourDigits: '1234',
    cardType: 'visa',
    notes: 'Test card for multi-tenant verification'
  }));

  // 2. Test Receipts API
  console.log('📋 Testing Receipts API...');
  
  testResults.push(await testEndpoint('GET', '/api/receipts'));
  testResults.push(await testEndpoint('GET', '/api/receipts?opportunityId=test-123'));

  // 3. Test User Payment Structures API
  console.log('📋 Testing User Payment Structures API...');
  
  testResults.push(await testEndpoint('GET', '/api/user-payment-structures'));
  
  // 4. Test User Payment Assignments API
  console.log('📋 Testing User Payment Assignments API...');
  
  testResults.push(await testEndpoint('GET', '/api/user-payment-assignments'));

  // 5. Test GHL Integration APIs
  console.log('📋 Testing GHL Integration APIs...');
  
  testResults.push(await testEndpoint('GET', '/api/integrations/automake/opportunities'));
  testResults.push(await testEndpoint('GET', '/api/integrations/automake/users'));

  // 6. Test Commission APIs
  console.log('📋 Testing Commission APIs...');
  
  testResults.push(await testEndpoint('GET', '/api/commissions/calculate'));
  testResults.push(await testEndpoint('GET', '/api/commissions/rules'));
  
  // 7. Test Sales Transaction API
  console.log('📋 Testing Sales Transaction API...');
  
  testResults.push(await testEndpoint('GET', '/api/sales/transactions'));

  // Print Results
  console.log('\n📊 Test Results Summary:\n');
  
  const successCount = testResults.filter(r => r.success).length;
  const failureCount = testResults.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log('\nDetailed Results:\n');

  testResults.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.method} ${result.endpoint}`);
    console.log(`   Status: ${result.status}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.data && !result.success) {
      console.log(`   Response: ${JSON.stringify(result.data, null, 2)}`);
    }
    
    console.log('');
  });

  // Check organization setup
  console.log('\n🏢 Checking Organization Setup...\n');
  
  const { data: orgMember, error: orgError } = await supabase
    .from('organization_members')
    .select(`
      organization_id,
      role,
      organizations!inner(name, slug)
    `)
    .eq('user_id', MOCK_USER_ID)
    .single();

  if (orgError || !orgMember) {
    console.log('❌ Mock user organization not found!');
    console.log('   Run the database verification script first:');
    console.log('   npm run tsx scripts/verify-database-setup.ts\n');
  } else {
    console.log('✅ Mock user organization found:');
    console.log(`   Organization: ${orgMember.organizations.name}`);
    console.log(`   Organization ID: ${orgMember.organization_id}`);
    console.log(`   User Role: ${orgMember.role}\n`);
  }

  // Summary and recommendations
  console.log('\n📝 Recommendations:\n');
  
  if (failureCount > 0) {
    console.log('1. Check that all API routes have been updated for multi-tenancy');
    console.log('2. Ensure the mock user has an organization (run verify-database-setup.ts)');
    console.log('3. Check the error messages above for specific issues');
    console.log('4. Verify that the database migrations ran successfully');
  } else {
    console.log('🎉 All API endpoints are working correctly with multi-tenancy!');
    console.log('✅ The system is ready for use with the new database structure.');
  }

  // Clean up test data
  if (testResults.some(r => r.endpoint === '/api/company-credit-cards' && r.method === 'POST' && r.success)) {
    console.log('\n🧹 Cleaning up test data...');
    
    const { error: cleanupError } = await supabase
      .from('company_credit_cards')
      .delete()
      .eq('card_name', 'Test Card')
      .eq('last_four_digits', '1234');
    
    if (!cleanupError) {
      console.log('✅ Test data cleaned up successfully');
    }
  }
}

// Run the tests
if (require.main === module) {
  runTests()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { runTests };