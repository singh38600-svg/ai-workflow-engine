import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { INITIAL_TOOLS } from '@/src/lib/config/tools-catalogue';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.warn('[API Tools] Supabase query error, falling back to static catalogue:', error.message);
      return NextResponse.json(INITIAL_TOOLS);
    }

    if (data && data.length > 0) {
      return NextResponse.json(data);
    }

    // Fallback if database is empty
    return NextResponse.json(INITIAL_TOOLS);
  } catch (err: any) {
    console.warn('[API Tools] Failed to query Supabase server, using static catalogue fallback:', err.message);
    return NextResponse.json(INITIAL_TOOLS);
  }
}
