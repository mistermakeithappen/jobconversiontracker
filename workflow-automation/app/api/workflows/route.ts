import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mockAuthServer } from "@/lib/auth/mock-auth-server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { userId } = mockAuthServer();

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflows: data });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('POST /api/workflows - Starting request');
    
    const { userId } = mockAuthServer();
    console.log('User ID:', userId);

    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const { name, description, definition } = body;

    if (!name || !definition) {
      console.error('Validation failed: missing name or definition');
      return NextResponse.json(
        { error: "Name and definition are required" },
        { status: 400 }
      );
    }

    console.log('Attempting to insert workflow into database...');
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        user_id: userId,
        name,
        description,
        definition,
        is_active: false
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
    }

    console.log('Workflow created successfully:', data);
    return NextResponse.json({ workflow: data }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/workflows:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 });
  }
}