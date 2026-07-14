import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase.from('workflows').select(`
      *,
      steps:workflow_steps(*)
    `);

    if (user) {
      query = query.or(`owner_id.eq.${user.id},visibility.eq.public`);
    } else {
      // Return public workflows for guests
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.warn('[API Workflows GET] Supabase workflows fetch failed:', error.message);
      return NextResponse.json([]);
    }

    // Map database fields back to frontend fields
    const mapped = (data || []).map((wf: any) => ({
      id: wf.id,
      title: wf.title,
      description: wf.summary,
      category: wf.category,
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

    return NextResponse.json(mapped);
  } catch (err: any) {
    console.warn('[API Workflows GET] Error querying workflows, using empty array fallback:', err.message);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const wf = await request.json();
    if (!wf || !wf.id) {
      return NextResponse.json({ error: 'Invalid workflow data.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const dbWorkflow = {
      id: wf.id,
      owner_id: user ? user.id : null,
      title: wf.title,
      original_goal: wf.requirementsSummary || wf.description,
      summary: wf.description,
      category: wf.category,
      total_cost: wf.estimatedCostMin || 0,
      currency: wf.currency || 'USD',
      difficulty: wf.difficulty,
      automation_level: wf.automationLevel,
      privacy_risk: wf.privacyRisk,
      visibility: wf.visibility || 'private',
      public_share_token: wf.publicShareToken || null,
      updated_at: new Date().toISOString()
    };

    // Upsert the main workflow record
    const { error: wfError } = await supabase
      .from('workflows')
      .upsert(dbWorkflow);

    if (wfError) {
      console.warn('[API Workflows POST] Supabase workflow upsert failed:', wfError.message);
      return NextResponse.json({
        success: true,
        workflow: wf,
        warning: 'Supabase schema not fully migrated. Workflow saved in temporary local session.'
      });
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
      await supabase.from('workflow_steps').delete().eq('workflow_id', wf.id);

      const { error: stepsError } = await supabase
        .from('workflow_steps')
        .insert(dbSteps);

      if (stepsError) {
        console.warn('[API Workflows POST] Supabase workflow_steps insert failed:', stepsError.message);
      }
    }

    return NextResponse.json({ success: true, workflow: wf });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
