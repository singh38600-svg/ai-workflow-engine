import { NextResponse } from 'next/server';
import { createAdminClient } from '@/src/lib/supabase/admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    
    // Perform database deletion
    const { error } = await supabaseAdmin
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API Workflows DELETE] Database deletion error:', error.message);
      return NextResponse.json({ error: 'Failed to delete workflow from library.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('[API Workflows DELETE] Unexpected error:', err.message);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
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

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
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
    const requirementsMetadata = data.requirements?.frontend_metadata || {};
    const mapped = {
      id: data.id,
      title: data.title,
      description: data.summary || '',
      category: data.category || 'custom',
      difficulty: data.difficulty || 'beginner',
      automationLevel: data.automation_level || 'assisted',
      estimatedCostMin: data.total_cost || 0,
      estimatedCostMax: requirementsMetadata.estimatedCostMax || (data.total_cost ? data.total_cost * 1.2 : 0),
      currency: data.currency || 'USD',
      setupTimeEstimate: requirementsMetadata.setupTimeEstimate || (data.difficulty === 'Developer' ? '25 minutes' : '45 minutes'),
      humanApprovalRequired: data.human_approval_required || false,
      privacyRisk: data.privacy_risk || 'Medium',
      visibility: data.visibility || 'private',
      publicShareToken: data.public_share_token || null,
      requirementsSummary: data.original_goal || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      overallInstructions: requirementsMetadata.overallInstructions || [],
      privacyWarnings: requirementsMetadata.privacyWarnings || [],
      riskWarnings: requirementsMetadata.riskWarnings || [],
      optimisationSuggestions: requirementsMetadata.optimisationSuggestions || [],
      costNotes: requirementsMetadata.costNotes || '',
      preferences: requirementsMetadata.preferences || {},
      steps: (data.steps || [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((step: any) => {
          const metadata = step.compatibility_to_next?.frontend_metadata || {};
          return {
            id: step.id,
            order: step.position,
            title: step.title,
            purpose: step.purpose || '',
            toolId: metadata.toolId || step.selected_tool_id || '',
            toolSlug: metadata.toolSlug || '',
            toolName: metadata.toolName || '',
            toolLogo: metadata.toolLogo || '',
            toolCategory: metadata.toolCategory || '',
            whySelected: metadata.whySelected || '',
            setupInstructions: step.instructions || [],
            input: step.input_types?.join(', ') || '',
            output: step.output_types?.join(', ') || '',
            expectedOutput: metadata.expectedOutput || '',
            humanAction: step.human_approval_required ? (metadata.humanAction || "Review outputs") : null,
            limitationNotes: metadata.limitationNotes || [],
            estimatedCost: metadata.estimatedCost || '',
            difficulty: metadata.difficulty || 'beginner',
            isFree: metadata.isFree !== undefined ? metadata.isFree : true,
            requiresApi: metadata.requiresApi !== undefined ? metadata.requiresApi : false,
            requiresWebhook: metadata.requiresWebhook !== undefined ? metadata.requiresWebhook : false,
            privacyNotes: metadata.privacyNotes || '',
            alternatives: step.alternatives || metadata.alternatives || [],
            compatibility_to_next: step.compatibility_to_next?.original_compatibility || null,
            personal_notes: step.personal_notes || ''
          };
        })
    };

    return NextResponse.json(mapped, { status: 200 });
  } catch (err: any) {
    console.error('[API Workflows ID GET] Unexpected error:', err.message);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
