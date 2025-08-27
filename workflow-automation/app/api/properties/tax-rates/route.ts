import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const supabase = getServiceSupabase();
    
    const { searchParams } = new URL(request.url);
    const postalCode = searchParams.get('postalCode');
    
    if (!postalCode) {
      return NextResponse.json({ error: 'Postal code is required' }, { status: 400 });
    }
    
    const { data: taxRate, error } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('postal_code', postalCode)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.log(`No tax rate found for postal code: ${postalCode}`);
      // Return null tax rate if not found, not an error
      return NextResponse.json({ taxRate: null });
    }
    
    return NextResponse.json({ taxRate });
    
  } catch (error) {
    console.error('Error in tax rates GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}