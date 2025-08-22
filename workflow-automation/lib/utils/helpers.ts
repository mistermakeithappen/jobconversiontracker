export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_APP_URL ?? 
    process?.env?.NEXT_PUBLIC_SITE_URL ?? 
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? 
    'http://localhost:3000/';
  url = url.includes('http') ? url : `https://${url}`;
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;
  return url;
};

export const postData = async ({ url, data }: { url: string; data?: any }) => {
  console.log('📤 POST request:', { url, data });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Ensure cookies are included
      body: JSON.stringify(data),
    });
    
    console.log('📥 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        console.error('❌ API Error:', errorData);
      } catch {
        // If response is not JSON, use status text
        console.error('❌ Non-JSON error response');
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('✅ Success response:', result);
    return result;
  } catch (error) {
    console.error('❌ postData error:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unknown error occurred');
    }
  }
}; 