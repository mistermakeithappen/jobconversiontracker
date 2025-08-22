#!/usr/bin/env node

/**
 * Script to add subscription checks to all GHL API routes
 * Run with: node scripts/add-subscription-checks.js
 */

const fs = require('fs');
const path = require('path');

// List of GHL API route files that need subscription checks
const ghlApiRoutes = [
  'app/api/ghl/calendars/route.ts',
  'app/api/ghl/contacts/count/route.ts',
  'app/api/ghl/contacts/search/route.ts',
  'app/api/ghl/contacts/route.ts',
  'app/api/ghl/estimates/[id]/route.ts',
  'app/api/ghl/invoices/[id]/route.ts',
  'app/api/mcp/ghl/contacts/route.ts',
  'app/api/mcp/ghl/opportunities/route.ts',
];

const workflowAutomationDir = 'workflow-automation';

function updateRouteFile(filePath) {
  const fullPath = path.join(workflowAutomationDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if already has subscription import
  if (content.includes('requireSubscription')) {
    console.log(`✅ Already updated: ${filePath}`);
    return;
  }

  // Add import for requireSubscription
  if (content.includes("import { requireAuth")) {
    content = content.replace(
      /import { requireAuth/,
      "import { requireAuth"
    );
    
    // Add the subscription utils import after other imports
    const importMatch = content.match(/(import.*from.*['""];?\n)/g);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const afterLastImport = lastImportIndex + lastImport.length;
      
      content = content.slice(0, afterLastImport) + 
                "import { requireSubscription } from '@/lib/utils/subscription-utils';\n" + 
                content.slice(afterLastImport);
    }
  }

  // Replace requireAuth with requireSubscription in export functions
  content = content.replace(
    /const { userId } = await requireAuth\(request\);/g,
    'const { userId } = await requireSubscription(request);'
  );

  // Add comment before the subscription check
  content = content.replace(
    /const { userId } = await requireSubscription\(request\);/g,
    '// Check subscription before proceeding\n    const { userId } = await requireSubscription(request);'
  );

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`🔧 Updated: ${filePath}`);
}

console.log('🚀 Adding subscription checks to GHL API routes...\n');

ghlApiRoutes.forEach(routeFile => {
  updateRouteFile(routeFile);
});

console.log('\n✅ Subscription check updates completed!');
console.log('\n📋 Next steps:');
console.log('1. Review the updated files');
console.log('2. Test the API endpoints');
console.log('3. Update any remaining GHL routes manually if needed');
console.log('4. Commit the changes');
