import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { checkIsAdmin } from '@/src/lib/auth/admin-check';
import { INITIAL_TOOLS } from '@/src/lib/config/tools-catalogue';

export async function POST() {
  const { isAdmin, error: authError } = await checkIsAdmin();

  if (!isAdmin) {
    return NextResponse.json(
      { error: authError || 'Unauthorized. Only admins specified in ADMIN_EMAILS can reset tools.' },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();
    
    // Try resetting database tables
    const { error: deleteError } = await supabase
      .from('tools')
      .delete()
      .neq('id', 'keep-placeholder-always');

    if (deleteError) {
      console.warn('[API Tools Reset] Database delete error:', deleteError.message);
    }

    const { error: insertError } = await supabase
      .from('tools')
      .insert(INITIAL_TOOLS);

    if (insertError) {
      console.warn('[API Tools Reset] Database insert error:', insertError.message);
      return NextResponse.json({
        success: true,
        tools: INITIAL_TOOLS,
        warning: 'Database unconfigured or unreachable. Catalogue reset simulated.'
      });
    }

    return NextResponse.json({ success: true, tools: INITIAL_TOOLS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
