import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: NextRequest) {
  try {
    const auth = mockAuthServer();
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('company_credit_cards')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching credit cards:', error);
      return NextResponse.json({ error: 'Failed to fetch credit cards' }, { status: 500 });
    }

    // Transform to camelCase for frontend
    const cards = (data || []).map(card => ({
      id: card.id,
      cardName: card.card_name,
      lastFourDigits: card.last_four_digits,
      cardType: card.card_type,
      isReimbursable: card.is_reimbursable,
      notes: card.notes,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
      isActive: card.is_active
    }));

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Error in GET /api/company-credit-cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = mockAuthServer();
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cardName, lastFourDigits, cardType, isReimbursable, notes } = body;

    // Validate required fields
    if (!cardName || !lastFourDigits || !cardType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate last four digits
    if (!/^\d{4}$/.test(lastFourDigits)) {
      return NextResponse.json({ error: 'Last four digits must be exactly 4 numbers' }, { status: 400 });
    }

    // Check for duplicate last four digits for this user
    const { data: existing } = await supabase
      .from('company_credit_cards')
      .select('id')
      .eq('user_id', auth.userId)
      .eq('last_four_digits', lastFourDigits)
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json({ 
        error: 'A credit card with these last four digits already exists' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('company_credit_cards')
      .insert({
        user_id: auth.userId,
        card_name: cardName,
        last_four_digits: lastFourDigits,
        card_type: cardType,
        is_reimbursable: isReimbursable || false,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating credit card:', error);
      return NextResponse.json({ error: 'Failed to create credit card' }, { status: 500 });
    }

    // Transform to camelCase
    const card = {
      id: data.id,
      cardName: data.card_name,
      lastFourDigits: data.last_four_digits,
      cardType: data.card_type,
      isReimbursable: data.is_reimbursable,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isActive: data.is_active
    };

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Error in POST /api/company-credit-cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = mockAuthServer();
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, cardName, lastFourDigits, cardType, isReimbursable, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
    }

    // Validate last four digits
    if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits)) {
      return NextResponse.json({ error: 'Last four digits must be exactly 4 numbers' }, { status: 400 });
    }

    // Check for duplicate last four digits (excluding current card)
    if (lastFourDigits) {
      const { data: existing } = await supabase
        .from('company_credit_cards')
        .select('id')
        .eq('user_id', auth.userId)
        .eq('last_four_digits', lastFourDigits)
        .eq('is_active', true)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({ 
          error: 'A credit card with these last four digits already exists' 
        }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (cardName !== undefined) updateData.card_name = cardName;
    if (lastFourDigits !== undefined) updateData.last_four_digits = lastFourDigits;
    if (cardType !== undefined) updateData.card_type = cardType;
    if (isReimbursable !== undefined) updateData.is_reimbursable = isReimbursable;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('company_credit_cards')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating credit card:', error);
      return NextResponse.json({ error: 'Failed to update credit card' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 });
    }

    // Transform to camelCase
    const card = {
      id: data.id,
      cardName: data.card_name,
      lastFourDigits: data.last_four_digits,
      cardType: data.card_type,
      isReimbursable: data.is_reimbursable,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isActive: data.is_active
    };

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Error in PUT /api/company-credit-cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = mockAuthServer();
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    const { data, error } = await supabase
      .from('company_credit_cards')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting credit card:', error);
      return NextResponse.json({ error: 'Failed to delete credit card' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/company-credit-cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}