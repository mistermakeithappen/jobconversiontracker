import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

// GET: Get template by type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    if (!type) {
      return NextResponse.json({ error: 'Template type required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    
    const { data: template, error } = await supabase
      .from('bot_context_templates')
      .select('*')
      .eq('business_type', type)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching template:', error);
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error in GET /api/bot-context-templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}