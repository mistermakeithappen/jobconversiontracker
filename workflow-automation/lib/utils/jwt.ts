export function parseJWT(token: string): any {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    
    // The payload is the second part
    const payload = parts[1];
    
    // Decode base64url to base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Pad with = if necessary
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    
    // Decode base64 to string
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    
    // Parse JSON
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}