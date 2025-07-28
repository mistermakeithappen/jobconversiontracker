import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // First, check if the table already exists
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'opportunity_commissions');
    
    if (tables && tables.length > 0) {
      return NextResponse.json({ message: 'Table already exists' });
    }
    
    // Create the table using Supabase service client
    // Note: Direct SQL execution is not available through the JS client
    // We need to use Supabase's admin API or dashboard
    
    return NextResponse.json({ 
      message: 'Table needs to be created manually',
      instructions: [
        '1. Go to your Supabase dashboard',
        '2. Navigate to the SQL Editor',
        '3. Run the migration from: supabase/migrations/20250214_opportunity_commissions.sql',
        '4. The table will be created with all necessary indexes and policies'
      ]
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to check/create table' }, { status: 500 });
  }
}