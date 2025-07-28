import { NextRequest, NextResponse } from 'next/server';

// API endpoint testing utility for the developer documentation
export async function POST(request: NextRequest) {
  try {
    const { method, path, headers: testHeaders, body: testBody } = await request.json();

    if (!method || !path) {
      return NextResponse.json({ 
        error: 'Method and path are required' 
      }, { status: 400 });
    }

    // Construct the full URL
    const baseUrl = new URL(request.url).origin;
    const fullUrl = `${baseUrl}${path}`;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...testHeaders
    };

    // Make the API request
    const requestConfig: RequestInit = {
      method: method.toUpperCase(),
      headers: requestHeaders
    };

    if (testBody && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestConfig.body = typeof testBody === 'string' ? testBody : JSON.stringify(testBody);
    }

    const startTime = Date.now();
    const response = await fetch(fullUrl, requestConfig);
    const duration = Date.now() - startTime;

    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch (error) {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    // Return the test result
    return NextResponse.json({
      success: true,
      request: {
        method: method.toUpperCase(),
        url: fullUrl,
        headers: requestHeaders,
        body: testBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData
      },
      meta: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error testing API endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      meta: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}