import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();

    const { data: settings, error } = await supabase
      .from('chatbot_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching chatbot settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Return default settings if none exist
    if (!settings) {
      const defaultSettings = {
        tonality: 'professional',
        typos_per_100_words: 1,
        max_response_length: 150,
        response_speed: 'instant',
        remember_conversation_history: true,
        use_ghl_contact_data: true
      };

      return NextResponse.json({ settings: defaultSettings });
    }

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Error in chatbot settings GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const settingsData = await request.json();

    // Validate settings data
    const validatedSettings = {
      tonality: settingsData.tonality || 'professional',
      typos_per_100_words: Math.max(0, Math.min(5, settingsData.typos_per_100_words || 1)),
      max_response_length: Math.max(50, settingsData.max_response_length || 150),
      response_speed: settingsData.response_speed || 'instant',
      remember_conversation_history: settingsData.remember_conversation_history !== false,
      use_ghl_contact_data: settingsData.use_ghl_contact_data !== false
    };

    // Upsert settings (update if exists, insert if not)
    const { data: settings, error } = await supabase
      .from('chatbot_settings')
      .upsert([{
        user_id: userId,
        ...validatedSettings
      }], {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving chatbot settings:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Settings saved successfully',
      settings 
    });

  } catch (error) {
    console.error('Error in chatbot settings POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}