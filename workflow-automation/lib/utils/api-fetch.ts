/**
 * Utility function for making authenticated API requests with automatic token refresh
 */
export async function authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
  // Make the initial request
  let response = await fetch(url, options);
  
  // If we get a 401 or token expired error, try to refresh
  if (response.status === 401) {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST'
    });
    
    if (refreshResponse.ok) {
      // Retry the original request
      response = await fetch(url, options);
    }
  }
  
  return response;
}