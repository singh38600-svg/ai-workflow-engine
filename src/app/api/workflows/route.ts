import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';

export async function GET() {
  try {
    let userId: string | null = null;
    try {
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch (e) {
      console.log('[API Workflows GET] Guest user or no active session:', e);
    }

    const supabaseAdmin = createAdminClient();

    let query = supabaseAdmin.from('workflows').select(`
      *,
      steps:workflow_steps(*)
    `);

    if (userId) {
      query = query.or(`owner_id.eq.${userId},owner_id.is.null,visibility.eq.public`);
    } else {
      // Return public workflows and anonymous guest workflows for guests
      query = query.or(`owner_id.is.null,visibility.eq.public`);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('[API Workflows GET] Supabase workflows fetch failed:', error.message);
      return NextResponse.json({ error: 'Failed to retrieve workflows from library.' }, { status: 500 });
    }

    // Map database fields back to frontend fields
    const mapped = (data || []).map((wf: any) => ({
      id: wf.id,
      title: wf.title,
      description: wf.summary,
      category: wf.category || 'custom',
      difficulty: wf.difficulty,
      automationLevel: wf.automation_level,
      estimatedCostMin: wf.total_cost || 0,
      estimatedCostMax: wf.total_cost ? wf.total_cost * 1.2 : 0,
      currency: wf.currency,
      setupTimeEstimate: wf.difficulty === 'Developer' ? '25 minutes' : '45 minutes',
      humanApprovalRequired: wf.human_approval_required || false,
      privacyRisk: wf.privacy_risk,
      visibility: wf.visibility,
      publicShareToken: wf.public_share_token,
      requirementsSummary: wf.original_goal,
      createdAt: wf.created_at,
      updatedAt: wf.updated_at,
      steps: (wf.steps || [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((step: any) => ({
          id: step.id,
          order: step.position,
          title: step.title,
          purpose: step.purpose,
          toolId: step.selected_tool_id,
          setupInstructions: step.instructions,
          input: step.input_types?.join(', ') || '',
          output: step.output_types?.join(', ') || '',
          alternatives: step.alternatives,
          compatibility_to_next: step.compatibility_to_next,
          humanAction: step.human_approval_required ? "Review outputs" : null,
          personal_notes: step.personal_notes
        }))
    }));

    return NextResponse.json(mapped, { status: 200 });
  } catch (err: any) {
    console.error('[API Workflows GET] Error querying workflows:', err.message);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const wf = await request.json();
    if (!wf || !wf.id) {
      return NextResponse.json({ error: 'Invalid workflow data.' }, { status: 400 });
    }

    let userId: string | null = null;
    try {
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch (e) {
      console.log('[API Workflows POST] Guest user or no active session:', e);
    }

    const dbWorkflow = {
      id: wf.id,
      owner_id: userId,
      title: wf.title,
      original_goal: wf.requirementsSummary || wf.description || '',
      requirements: wf.requirements || {},
      summary: wf.description || '',
      total_cost: wf.estimatedCostMin || 0,
      currency: wf.currency || 'USD',
      difficulty: wf.difficulty || 'beginner',
      automation_level: wf.automationLevel || 'assisted',
      privacy_risk: wf.privacyRisk || 'Medium',
      visibility: wf.visibility || 'private',
      public_share_token: wf.publicShareToken || null,
      category: wf.category || 'custom',
      updated_at: new Date().toISOString()
    };

    const supabaseAdmin = createAdminClient();

    // Upsert the main workflow record
    const { error: wfError } = await supabaseAdmin
      .from('workflows')
      .upsert(dbWorkflow);

    if (wfError) {
      console.error('[API Workflows POST] Supabase workflow upsert failed:', wfError.message);
      return NextResponse.json({ error: 'Failed to persist workflow blueprint.' }, { status: 500 });
    }

    // Save associated steps
    if (wf.steps && wf.steps.length > 0) {
      const dbSteps = wf.steps.map((step: any, idx: number) => ({
        id: step.id || `step-${idx + 1}`,
        workflow_id: wf.id,
        position: idx + 1,
        title: step.title,
        purpose: step.purpose,
        selected_tool_id: step.toolId,
        alternatives: step.alternatives || [],
        instructions: step.setupInstructions || [],
        input_types: step.input ? [step.input] : [],
        output_types: step.output ? [step.output] : [],
        compatibility_to_next: step.compatibility_to_next || null,
        human_approval_required: !!step.humanAction,
        personal_notes: step.personal_notes || null,
        updated_at: new Date().toISOString()
      }));

      // Clear previous steps to allow fresh insertion
      const { error: deleteError } = await supabaseAdmin.from('workflow_steps').delete().eq('workflow_id', wf.id);
      if (deleteError) {
        console.error('[API Workflows POST] Supabase workflow_steps deletion failed:', deleteError.message);
        return NextResponse.json({ error: 'Failed to update workflow steps in library.' }, { status: 500 });
      }

      const { error: stepsError } = await supabaseAdmin
        .from('workflow_steps')
        .insert(dbSteps);

      if (stepsError) {
        console.error('[API Workflows POST] Supabase workflow_steps insert failed:', stepsError.message);
        return NextResponse.json({ error: 'Failed to insert workflow steps in library.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, workflow: wf }, { status: 201 });
  } catch (err: any) {
    console.error('[API Workflows POST] Unexpected error:', err.message);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
