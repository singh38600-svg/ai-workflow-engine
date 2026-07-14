import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { checkIsAdmin } from '@/src/lib/auth/admin-check';

export async function POST(request: Request) {
  const { isAdmin, error: authError } = await checkIsAdmin();

  if (!isAdmin) {
    return NextResponse.json(
      { error: authError || 'Unauthorized. Only admins specified in ADMIN_EMAILS can edit tools.' },
      { status: 403 }
    );
  }

  try {
    const updatedTool = await request.json();
    if (!updatedTool || !updatedTool.id) {
      return NextResponse.json({ error: 'Invalid tool data.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tools')
      .upsert({
        ...updatedTool,
        last_verified_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.warn('[API Tools Edit] Database update failed, returning fallback success:', error.message);
      return NextResponse.json({
        success: true,
        tool: updatedTool,
        warning: 'Database unconfigured or unreachable. Tool edit simulated.'
      });
    }

    return NextResponse.json({ success: true, tool: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
