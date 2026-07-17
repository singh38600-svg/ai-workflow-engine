import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';

function mapWorkflowRow(wf: any) {
  const requirementsMetadata = wf.requirements?.frontend_metadata || {};

  return {
    id: wf.id,
    title: wf.title,
    description: wf.summary || '',
    category: wf.category || 'custom',
    difficulty: wf.difficulty || 'beginner',
    automationLevel: wf.automation_level || 'assisted',
    estimatedCostMin: wf.total_cost || 0,
    estimatedCostMax:
      requirementsMetadata.estimatedCostMax ||
      (wf.total_cost ? wf.total_cost * 1.2 : 0),
    currency: wf.currency || 'USD',
    setupTimeEstimate:
      requirementsMetadata.setupTimeEstimate ||
      (wf.difficulty === 'Developer' ? '25 minutes' : '45 minutes'),

    // The current database migration does not define a
    // workflows.human_approval_required column. Keep this value inside
    // requirements.frontend_metadata instead.
    humanApprovalRequired:
      requirementsMetadata.humanApprovalRequired || false,

    privacyRisk: wf.privacy_risk || 'Medium',
    visibility: wf.visibility || 'private',
    publicShareToken: wf.public_share_token || null,
    requirementsSummary: wf.original_goal || '',
    createdAt: wf.created_at,
    updatedAt: wf.updated_at,
    overallInstructions: requirementsMetadata.overallInstructions || [],
    privacyWarnings: requirementsMetadata.privacyWarnings || [],
    riskWarnings: requirementsMetadata.riskWarnings || [],
    optimisationSuggestions:
      requirementsMetadata.optimisationSuggestions || [],
    costNotes: requirementsMetadata.costNotes || '',
    preferences: requirementsMetadata.preferences || {},

    steps: (wf.steps || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((step: any) => {
        const metadata =
          step.compatibility_to_next?.frontend_metadata || {};

        return {
          // Preserve the generated frontend ID when available.
          id: metadata.originalStepId || step.id,
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
          humanAction: step.human_approval_required
            ? metadata.humanAction || 'Review outputs'
            : null,
          limitationNotes: metadata.limitationNotes || [],
          estimatedCost: metadata.estimatedCost || '',
          difficulty: metadata.difficulty || 'beginner',
          isFree:
            metadata.isFree !== undefined ? metadata.isFree : true,
          requiresApi:
            metadata.requiresApi !== undefined
              ? metadata.requiresApi
              : false,
          requiresWebhook:
            metadata.requiresWebhook !== undefined
              ? metadata.requiresWebhook
              : false,
          privacyNotes: metadata.privacyNotes || '',
          alternatives:
            step.alternatives || metadata.alternatives || [],
          compatibility_to_next:
            step.compatibility_to_next?.original_compatibility || null,
          personal_notes: step.personal_notes || ''
        };
      })
  };
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const userClient = await createClient();
    const {
      data: { user }
    } = await userClient.auth.getUser();

    return user?.id || null;
  } catch (error) {
    console.log(
      '[API Workflows] Guest user or no active session:',
      error
    );
    return null;
  }
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const supabaseAdmin = createAdminClient();

    let query = supabaseAdmin.from('workflows').select(`
      *,
      steps:workflow_steps(*)
    `);

    if (userId) {
      query = query.or(
        `owner_id.eq.${userId},owner_id.is.null,visibility.eq.public`
      );
    } else {
      query = query.or(`owner_id.is.null,visibility.eq.public`);
    }

    const { data, error } = await query.order('updated_at', {
      ascending: false
    });

    if (error) {
      console.error(
        '[API Workflows GET] Supabase workflows fetch failed:',
        error.message
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve workflows from library.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      (data || []).map(mapWorkflowRow),
      { status: 200 }
    );
  } catch (error: any) {
    console.error(
      '[API Workflows GET] Unexpected error:',
      error.message
    );

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred.'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const workflow = await request.json();

    if (!workflow || !workflow.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid workflow data.'
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(workflow.steps) ||
      workflow.steps.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow steps are required.'
        },
        { status: 400 }
      );
    }

    console.info('[Workflow Save]', {
      workflowId: workflow.id,
      receivedStepCount: workflow.steps.length
    });

    const userId = await getCurrentUserId();
    const supabaseAdmin = createAdminClient();

    const { data: databaseTools, error: toolsError } =
      await supabaseAdmin.from('tools').select('id, slug');

    if (toolsError) {
      console.warn(
        '[API Workflows POST] Could not read tool IDs:',
        toolsError.message
      );
    }

    const toolIdMap = new Map<string, string>();

    for (const tool of databaseTools || []) {
      toolIdMap.set(tool.id, tool.id);
      toolIdMap.set(tool.slug, tool.id);
    }

    const requirements = {
      ...(workflow.requirements || {}),
      frontend_metadata: {
        overallInstructions: workflow.overallInstructions || [],
        privacyWarnings: workflow.privacyWarnings || [],
        riskWarnings: workflow.riskWarnings || [],
        optimisationSuggestions:
          workflow.optimisationSuggestions || [],
        setupTimeEstimate: workflow.setupTimeEstimate || '',
        estimatedCostMax: workflow.estimatedCostMax || 0,
        humanApprovalRequired:
          !!workflow.humanApprovalRequired,
        costNotes: workflow.costNotes || '',
        preferences: workflow.preferences || {}
      }
    };

    const databaseWorkflow = {
      id: workflow.id,
      owner_id: userId,
      title: workflow.title,
      category: workflow.category || 'custom',
      original_goal:
        workflow.requirementsSummary ||
        workflow.description ||
        '',
      requirements,
      summary: workflow.description || '',
      total_cost: workflow.estimatedCostMin || 0,
      currency: workflow.currency || 'USD',
      difficulty: workflow.difficulty || 'beginner',
      automation_level:
        workflow.automationLevel || 'assisted',
      privacy_risk: workflow.privacyRisk || 'Medium',
      visibility: workflow.visibility || 'private',
      public_share_token:
        workflow.public_share_token ||
        workflow.publicShareToken ||
        null,
      updated_at: new Date().toISOString()
    };

    const { error: workflowError } = await supabaseAdmin
      .from('workflows')
      .upsert(databaseWorkflow);

    if (workflowError) {
      console.error(
        '[API Workflows POST] Workflow upsert failed:',
        workflowError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: `Failed to persist workflow: ${workflowError.message}`
        },
        { status: 500 }
      );
    }

    const databaseSteps = workflow.steps.map(
      (step: any, index: number) => {
        let selectedToolId: string | null = null;

        if (step.toolId && toolIdMap.has(step.toolId)) {
          selectedToolId = toolIdMap.get(step.toolId) || null;
        } else if (
          step.toolSlug &&
          toolIdMap.has(step.toolSlug)
        ) {
          selectedToolId =
            toolIdMap.get(step.toolSlug) || null;
        }

        const originalStepId =
          step.id || `step-${index + 1}`;

        return {
          /*
           * workflow_steps.id is the table-wide primary key.
           * Generated IDs such as "step-task-1" repeat in every
           * workflow, so prefix the database ID with the workflow ID.
           */
          id: `${workflow.id}__step-${index + 1}`,
          workflow_id: workflow.id,
          position: index + 1,
          title: step.title || `Step ${index + 1}`,
          purpose: step.purpose || '',
          selected_tool_id: selectedToolId,
          alternatives: step.alternatives || [],
          instructions: step.setupInstructions || [],
          input_types: step.input ? [step.input] : [],
          output_types: step.output ? [step.output] : [],
          compatibility_to_next: {
            original_compatibility:
              step.compatibility_to_next || null,
            frontend_metadata: {
              originalStepId,
              toolId: step.toolId || '',
              toolSlug: step.toolSlug || '',
              toolName: step.toolName || '',
              toolLogo: step.toolLogo || '',
              toolCategory: step.toolCategory || '',
              whySelected: step.whySelected || '',
              expectedOutput: step.expectedOutput || '',
              humanAction: step.humanAction || null,
              limitationNotes: step.limitationNotes || [],
              estimatedCost: step.estimatedCost || '',
              difficulty: step.difficulty || 'beginner',
              isFree:
                step.isFree !== undefined
                  ? step.isFree
                  : true,
              requiresApi:
                step.requiresApi !== undefined
                  ? step.requiresApi
                  : false,
              requiresWebhook:
                step.requiresWebhook !== undefined
                  ? step.requiresWebhook
                  : false,
              privacyNotes: step.privacyNotes || '',
              alternatives: step.alternatives || []
            }
          },
          human_approval_required: !!step.humanAction,
          personal_notes: step.personal_notes || null,
          updated_at: new Date().toISOString()
        };
      }
    );

    /*
     * Remove only the steps belonging to this workflow.
     * This permits safely saving the same workflow again.
     */
    const { error: deleteStepsError } = await supabaseAdmin
      .from('workflow_steps')
      .delete()
      .eq('workflow_id', workflow.id);

    if (deleteStepsError) {
      console.error(
        '[API Workflows POST] Previous step deletion failed:',
        deleteStepsError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: `Failed to update workflow steps: ${deleteStepsError.message}`
        },
        { status: 500 }
      );
    }

    const { error: insertStepsError } = await supabaseAdmin
      .from('workflow_steps')
      .insert(databaseSteps);

    if (insertStepsError) {
      console.error(
        '[API Workflows POST] Step insertion failed:',
        insertStepsError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: `Failed to insert workflow steps: ${insertStepsError.message}`
        },
        { status: 500 }
      );
    }

    const {
      data: insertedSteps,
      error: verificationError
    } = await supabaseAdmin
      .from('workflow_steps')
      .select('id, position')
      .eq('workflow_id', workflow.id)
      .order('position', { ascending: true });

    if (
      verificationError ||
      !insertedSteps ||
      insertedSteps.length !== databaseSteps.length
    ) {
      console.error(
        '[API Workflows POST] Verification failed:',
        {
          expected: databaseSteps.length,
          actual: insertedSteps?.length || 0,
          error: verificationError?.message
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Workflow step verification failed.'
        },
        { status: 500 }
      );
    }

    const {
      data: savedWorkflow,
      error: readBackError
    } = await supabaseAdmin
      .from('workflows')
      .select(`
        *,
        steps:workflow_steps(*)
      `)
      .eq('id', workflow.id)
      .single();

    if (readBackError || !savedWorkflow) {
      console.warn(
        '[API Workflows POST] Saved, but read-back failed:',
        readBackError?.message
      );

      return NextResponse.json(
        {
          success: true,
          workflow
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        workflow: mapWorkflowRow(savedWorkflow)
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(
      '[API Workflows POST] Unexpected error:',
      error.message
    );

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unexpected workflow save error.'
      },
      { status: 500 }
    );
  }
}
