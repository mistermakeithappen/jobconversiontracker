import { NextResponse } from 'next/server';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = mockAuthServer();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    const { data, error } = await supabase
      .from('executions')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();
      
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}