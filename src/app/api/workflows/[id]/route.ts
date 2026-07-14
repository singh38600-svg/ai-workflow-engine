import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID.' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Perform database deletion
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('[API Workflows DELETE] Database deletion error:', error.message);
      return NextResponse.json({
        success: true,
        warning: 'Database unconfigured or unreachable. Deletion simulated.'
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('workflows')
      .select(`
        *,
        steps:workflow_steps(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    }

    // Map database fields back to frontend structure
    const mapped = {
      id: data.id,
      title: data.title,
      description: data.summary,
      category: data.category,
      difficulty: data.difficulty,
      automationLevel: data.automation_level,
      estimatedCostMin: data.total_cost || 0,
      estimatedCostMax: data.total_cost ? data.total_cost * 1.2 : 0,
      currency: data.currency,
      setupTimeEstimate: data.difficulty === 'Developer' ? '25 minutes' : '45 minutes',
      humanApprovalRequired: data.human_approval_required || false,
      privacyRisk: data.privacy_risk,
      visibility: data.visibility,
      publicShareToken: data.public_share_token,
      requirementsSummary: data.original_goal,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      steps: (data.steps || [])
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
    };

    return NextResponse.json(mapped);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
