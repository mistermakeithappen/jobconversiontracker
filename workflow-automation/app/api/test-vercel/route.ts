import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test basic functionality
    const testData = {
      message: 'Vercel API is working!',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
      nodeVersion: process.version,
    };

    return NextResponse.json(testData);
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { error: 'Test API failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 