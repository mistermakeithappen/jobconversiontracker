import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('Checking GoHighLevel OAuth Configuration...\n');

console.log('GHL_CLIENT_ID:', process.env.GHL_CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('GHL_CLIENT_SECRET:', process.env.GHL_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'Not set');

console.log('\nOAuth Configuration:');
console.log('- Authorization URL: https://marketplace.gohighlevel.com/oauth/chooselocation');
console.log('- Redirect URI:', (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/integrations/automake/callback');
console.log('- Scopes: contacts.readonly contacts.write opportunities.readonly opportunities.write locations.readonly conversations.readonly conversations.write users.readonly products.readonly payments.readonly');

if (!process.env.GHL_CLIENT_ID || !process.env.GHL_CLIENT_SECRET) {
  console.log('\n⚠️  Missing required environment variables!');
  console.log('Make sure GHL_CLIENT_ID and GHL_CLIENT_SECRET are set in your .env.local file');
}