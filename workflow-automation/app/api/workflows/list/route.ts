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
    
    console.log('API: Fetching workflows for userId:', userId);

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('API: Error fetching workflows:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('API: Found workflows:', data?.length || 0);
    return NextResponse.json({ workflows: data || [] });
  } catch (error) {
    console.error('API: Unexpected error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}