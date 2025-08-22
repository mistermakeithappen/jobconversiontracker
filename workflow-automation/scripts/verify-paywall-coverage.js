#!/usr/bin/env node

/**
 * Script to verify complete paywall coverage across all GHL services
 * Run with: node scripts/verify-paywall-coverage.js
 */

const fs = require('fs');
const path = require('path');

const workflowAutomationDir = '.';

// Define all GHL API routes that should have subscription protection
const expectedProtectedRoutes = [
  'app/api/ghl/calendars/route.ts',
  'app/api/ghl/custom-fields/route.ts',
  'app/api/ghl/tags/route.ts',
  'app/api/ghl/invoices/route.ts',
  'app/api/ghl/invoices/[id]/route.ts',
  'app/api/ghl/estimates/route.ts',
  'app/api/ghl/estimates/[id]/route.ts',
  'app/api/ghl/user-commissions/route.ts',
  'app/api/ghl/contacts/count/route.ts',
  'app/api/ghl/contacts/search/route.ts',
  'app/api/ghl/contacts/sync/route.ts',
];

// Define all GHL frontend pages
const expectedProtectedPages = [
  'app/(authenticated)/ghl/layout.tsx',
  'app/(authenticated)/ghl/page.tsx',
  'app/(authenticated)/ghl/opportunities/page.tsx',
  'app/(authenticated)/ghl/contacts/page.tsx',
  'app/(authenticated)/ghl/receipts/page.tsx',
  'app/(authenticated)/ghl/sales/page.tsx',
  'app/(authenticated)/ghl/settings/page.tsx',
];

function checkApiRouteProtection(filePath) {
  const fullPath = path.join(workflowAutomationDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Check for requireSubscription import
  const hasImport = content.includes('requireSubscription');
  
  // Check for requireSubscription usage in export functions
  const hasUsage = content.includes('await requireSubscription(request)');
  
  if (hasImport && hasUsage) {
    console.log(`✅ Protected: ${filePath}`);
    return true;
  } else {
    console.log(`❌ Missing protection: ${filePath}`);
    console.log(`   - Has import: ${hasImport}`);
    console.log(`   - Has usage: ${hasUsage}`);
    return false;
  }
}

function checkPageProtection(filePath) {
  const fullPath = path.join(workflowAutomationDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Check for subscription hook usage
  const hasSubscriptionHook = content.includes('useSubscription');
  
  // Check for paywall components
  const hasPaywallModal = content.includes('PaywallModal');
  const hasPaywallBanner = content.includes('PaywallBanner');
  
  if (hasSubscriptionHook && (hasPaywallModal || hasPaywallBanner)) {
    console.log(`✅ Protected: ${filePath}`);
    return true;
  } else if (filePath.includes('layout.tsx') && hasPaywallBanner) {
    console.log(`✅ Layout Protected: ${filePath}`);
    return true;
  } else {
    console.log(`⚠️  Limited protection: ${filePath}`);
    console.log(`   - Has useSubscription: ${hasSubscriptionHook}`);
    console.log(`   - Has PaywallModal: ${hasPaywallModal}`);
    console.log(`   - Has PaywallBanner: ${hasPaywallBanner}`);
    return false;
  }
}

console.log('🔍 Verifying GHL Paywall Coverage...\n');

console.log('📡 Checking API Routes:\n');
let protectedApiRoutes = 0;
expectedProtectedRoutes.forEach(route => {
  if (checkApiRouteProtection(route)) {
    protectedApiRoutes++;
  }
});

console.log('\n🖥️  Checking Frontend Pages:\n');
let protectedPages = 0;
expectedProtectedPages.forEach(page => {
  if (checkPageProtection(page)) {
    protectedPages++;
  }
});

console.log('\n📊 Summary:');
console.log(`API Routes: ${protectedApiRoutes}/${expectedProtectedRoutes.length} protected`);
console.log(`Frontend Pages: ${protectedPages}/${expectedProtectedPages.length} protected`);

const totalProtection = protectedApiRoutes + protectedPages;
const totalExpected = expectedProtectedRoutes.length + expectedProtectedPages.length;

if (totalProtection === totalExpected) {
  console.log('\n🎉 All GHL services are properly protected with paywalls!');
} else {
  console.log(`\n⚠️  Coverage: ${totalProtection}/${totalExpected} (${Math.round(totalProtection/totalExpected*100)}%)`);
  console.log('\n📋 Next steps:');
  console.log('1. Review and fix missing protections');
  console.log('2. Test subscription checks manually');
  console.log('3. Verify paywall components display correctly');
}
