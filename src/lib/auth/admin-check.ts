import { createClient } from '@/src/lib/supabase/server';

export async function checkIsAdmin(): Promise<{ isAdmin: boolean; email?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return { isAdmin: false, error: 'Unauthenticated user session.' };
    }

    const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsEnv
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    // Enforce matching against ADMIN_EMAILS
    const isAdmin = adminEmails.includes(user.email.toLowerCase());

    return { isAdmin, email: user.email };
  } catch (err: any) {
    return { isAdmin: false, error: err.message };
  }
}
