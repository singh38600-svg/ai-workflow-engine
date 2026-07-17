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
    const mapped = (data || []).map((wf: any) => {
      const requirementsMetadata = wf.requirements?.frontend_metadata || {};
      return {
        id: wf.id,
        title: wf.title,
        description: wf.summary || '',
        category: wf.category || 'custom',
        difficulty: wf.difficulty || 'beginner',
        automationLevel: wf.automation_level || 'assisted',
        estimatedCostMin: wf.total_cost || 0,
        estimatedCostMax: requirementsMetadata.estimatedCostMax || (wf.total_cost ? wf.total_cost * 1.2 : 0),
        currency: wf.currency || 'USD',
        setupTimeEstimate: requirementsMetadata.setupTimeEstimate || (wf.difficulty === 'Developer' ? '25 minutes' : '45 minutes'),
        humanApprovalRequired: wf.human_approval_required || false,
        privacyRisk: wf.privacy_risk || 'Medium',
        visibility: wf.visibility || 'private',
        publicShareToken: wf.public_share_token || null,
        requirementsSummary: wf.original_goal || '',
        createdAt: wf.created_at,
        updatedAt: wf.updated_at,
        overallInstructions: requirementsMetadata.overallInstructions || [],
        privacyWarnings: requirementsMetadata.privacyWarnings || [],
        riskWarnings: requirementsMetadata.riskWarnings || [],
        optimisationSuggestions: requirementsMetadata.optimisationSuggestions || [],
        costNotes: requirementsMetadata.costNotes || '',
        preferences: requirementsMetadata.preferences || {},
        steps: (wf.steps || [])
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
    });

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

    const supabaseAdmin = createAdminClient();

    // Fetch existing tool IDs/slugs to avoid foreign key violations
    const { data: dbTools } = await supabaseAdmin.from('tools').select('id, slug');
    const toolIdMap = new Map<string, string>();
    if (dbTools) {
      for (const t of dbTools) {
        toolIdMap.set(t.id, t.id);
        toolIdMap.set(t.slug, t.id);
      }
    }

    const dbRequirements = {
      ...(wf.requirements || {}),
      frontend_metadata: {
        overallInstructions: wf.overallInstructions || [],
        privacyWarnings: wf.privacyWarnings || [],
        riskWarnings: wf.riskWarnings || [],
        optimisationSuggestions: wf.optimisationSuggestions || [],
        setupTimeEstimate: wf.setupTimeEstimate || '',
        estimatedCostMax: wf.estimatedCostMax || 0,
        costNotes: wf.costNotes || '',
        preferences: wf.preferences || {}
      }
    };

    const dbWorkflow = {
      id: wf.id,
      owner_id: userId,
      title: wf.title,
      original_goal: wf.requirementsSummary || wf.description || '',
      requirements: dbRequirements,
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
      const dbSteps = wf.steps.map((step: any, idx: number) => {
        let dbToolId: string | null = null;
        if (step.toolId && toolIdMap.has(step.toolId)) {
          dbToolId = toolIdMap.get(step.toolId) || null;
        } else if (step.toolSlug && toolIdMap.has(step.toolSlug)) {
          dbToolId = toolIdMap.get(step.toolSlug) || null;
        }

        const compatibilityWithMetadata = {
          original_compatibility: step.compatibility_to_next || null,
          frontend_metadata: {
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
            isFree: step.isFree !== undefined ? step.isFree : true,
            requiresApi: step.requiresApi !== undefined ? step.requiresApi : false,
            requiresWebhook: step.requiresWebhook !== undefined ? step.requiresWebhook : false,
            privacyNotes: step.privacyNotes || '',
            alternatives: step.alternatives || []
          }
        };

        return {
          id: step.id || `step-${idx + 1}`,
          workflow_id: wf.id,
          position: idx + 1,
          title: step.title,
          purpose: step.purpose || '',
          selected_tool_id: dbToolId,
          alternatives: step.alternatives || [],
          instructions: step.setupInstructions || [],
          input_types: step.input ? [step.input] : [],
          output_types: step.output ? [step.output] : [],
          compatibility_to_next: compatibilityWithMetadata,
          human_approval_required: !!step.humanAction,
          personal_notes: step.personal_notes || null,
          updated_at: new Date().toISOString()
        };
      });

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
    } else {
      // If wf has no steps or empty steps, delete any old ones
      const { error: deleteError } = await supabaseAdmin.from('workflow_steps').delete().eq('workflow_id', wf.id);
      if (deleteError) {
        console.error('[API Workflows POST] Supabase workflow_steps deletion failed:', deleteError.message);
        return NextResponse.json({ error: 'Failed to update workflow steps in library.' }, { status: 500 });
      }
    }

    // Fetch the updated/inserted full workflow with steps to return (consistent with GET response format)
    const { data: finalWf, error: fetchError } = await supabaseAdmin
      .from('workflows')
      .select(`
        *,
        steps:workflow_steps(*)
      `)
      .eq('id', wf.id)
      .single();

    if (fetchError || !finalWf) {
      console.error('[API Workflows POST] Failed to fetch saved workflow:', fetchError?.message);
      return NextResponse.json({ success: true, workflow: wf }, { status: 201 });
    }

    const requirementsMetadata = finalWf.requirements?.frontend_metadata || {};
    const responseWf = {
      id: finalWf.id,
      title: finalWf.title,
      description: finalWf.summary || '',
      category: finalWf.category || 'custom',
      difficulty: finalWf.difficulty || 'beginner',
      automationLevel: finalWf.automation_level || 'assisted',
      estimatedCostMin: finalWf.total_cost || 0,
      estimatedCostMax: requirementsMetadata.estimatedCostMax || (finalWf.total_cost ? finalWf.total_cost * 1.2 : 0),
      currency: finalWf.currency || 'USD',
      setupTimeEstimate: requirementsMetadata.setupTimeEstimate || (finalWf.difficulty === 'Developer' ? '25 minutes' : '45 minutes'),
      humanApprovalRequired: finalWf.human_approval_required || false,
      privacyRisk: finalWf.privacy_risk || 'Medium',
      visibility: finalWf.visibility || 'private',
      publicShareToken: finalWf.public_share_token || null,
      requirementsSummary: finalWf.original_goal || '',
      createdAt: finalWf.created_at,
      updatedAt: finalWf.updated_at,
      overallInstructions: requirementsMetadata.overallInstructions || [],
      privacyWarnings: requirementsMetadata.privacyWarnings || [],
      riskWarnings: requirementsMetadata.riskWarnings || [],
      optimisationSuggestions: requirementsMetadata.optimisationSuggestions || [],
      costNotes: requirementsMetadata.costNotes || '',
      preferences: requirementsMetadata.preferences || {},
      steps: (finalWf.steps || [])
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

    return NextResponse.json({ success: true, workflow: responseWf }, { status: 201 });
  } catch (err: any) {
    console.error('[API Workflows POST] Unexpected error:', err.message);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
