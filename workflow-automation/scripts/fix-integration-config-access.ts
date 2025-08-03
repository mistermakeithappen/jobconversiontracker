import * as fs from 'fs';
import * as path from 'path';

// Files to fix based on the grep results
const filesToFix = [
  '/app/api/integrations/automake/users/route.ts',
  '/app/api/integrations/automake/locations/route.ts',
  '/app/api/integrations/automake/fetch-details/route.ts',
  '/app/api/integrations/automake/pipelines/route.ts',
  '/app/api/integrations/automake/opportunities/pipeline/[pipelineId]/route.ts'
];

const rootDir = path.join(__dirname, '..');

// Patterns to replace
const replacements = [
  // Fix conditional checks
  { from: /!integration\.config\.encryptedTokens/g, to: '!integration.config?.encryptedTokens' },
  { from: /!integration\.config\.locationId/g, to: '!integration.config?.locationId' },
  
  // Fix direct property access in conditionals
  { from: /integration\.config\.companyId\)/g, to: 'integration.config?.companyId)' },
  { from: /integration\.config\.locationId\)/g, to: 'integration.config?.locationId)' },
  { from: /integration\.config\.scope/g, to: 'integration.config?.scope' },
  
  // Fix function calls - need to provide fallback
  { from: /createGHLClient\(\s*integration\.config\.encryptedTokens,/g, to: 'createGHLClient(\n      integration.config?.encryptedTokens || \'\',' },
  { from: /createGHLClient\(integration\.config\.encryptedTokens\)/g, to: 'createGHLClient(integration.config?.encryptedTokens || \'\')' },
  
  // Fix object access in API calls
  { from: /locationId: integration\.config\.locationId,/g, to: 'locationId: integration.config?.locationId || \'\',' },
  { from: /currentScope: integration\.config\.scope,/g, to: 'currentScope: integration.config?.scope,' },
  { from: /companies\/\$\{integration\.config\.companyId\}/g, to: 'companies/${integration.config?.companyId}' },
];

console.log('Fixing integration.config access issues...\n');

filesToFix.forEach(file => {
  const filePath = path.join(rootDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ from, to }) => {
    const originalContent = content;
    content = content.replace(from, to);
    if (content !== originalContent) {
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${file}`);
  } else {
    console.log(`⏭️  No changes needed: ${file}`);
  }
});

console.log('\nDone! All integration.config access issues have been fixed.');
console.log('\nNote: You may need to restart your dev server for changes to take effect.');