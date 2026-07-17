import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { generateOpenRouterCompletion } from '@/src/lib/ai/openrouter';
import { rankToolsForTask } from '@/src/lib/ranking-engine';
import { INITIAL_TOOLS } from '@/src/lib/config/tools-catalogue';
import { TEMPLATE_WORKFLOWS } from '@/src/templates';
import { Workflow, WorkflowStep, WorkflowRequirements, WorkflowExplanation, CategoryType } from '@/src/types';

// Infer general category from user prompt
function inferCategoryFromGoal(goal: string): CategoryType {
  const low = goal.toLowerCase();
  if (low.includes('linkedin') || low.includes('post') || low.includes('tweet') || low.includes('social') || low.includes('blog') || low.includes('video')) {
    return 'content_creation';
  }
  if (low.includes('job') || low.includes('resume') || low.includes('cv') || low.includes('application') || low.includes('hiring')) {
    return 'job_search';
  }
  if (low.includes('review') || low.includes('sentiment') || low.includes('feedback') || low.includes('complaint')) {
    return 'data_reporting';
  }
  if (low.includes('customer') || low.includes('support') || low.includes('ticket') || low.includes('email') || low.includes('chat')) {
    return 'customer_support';
  }
  if (low.includes('sell') || low.includes('lead') || low.includes('crm') || low.includes('sales')) {
    return 'sales';
  }
  if (low.includes('marketing') || low.includes('promote') || low.includes('ad') || low.includes('campaign')) {
    return 'marketing';
  }
  if (low.includes('code') || low.includes('develop') || low.includes('build') || low.includes('api') || low.includes('database')) {
    return 'development';
  }
  if (low.includes('money') || low.includes('price') || low.includes('billing') || low.includes('stripe') || low.includes('invoice') || low.includes('bitcoin')) {
    return 'finance';
  }
  if (low.includes('search') || low.includes('scrape') || low.includes('research') || low.includes('learn')) {
    return 'research';
  }
  return 'productivity';
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export async function POST(request: Request) {
  try {
    const { goal, preferences } = await request.json();

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json({ error: 'Please describe what you want to accomplish!' }, { status: 400 });
    }

    const budget = preferences?.budget || 'flexible';
    const skill = preferences?.skill || 'beginner';
    const automation = preferences?.automation || 'mostly_automated';
    const dataSensitivity = preferences?.dataSensitivity || 'internal';
    const freeToolsOnly = preferences?.freeToolsOnly || false;

    console.log(`[Workflow Route] Goal: "${goal}" (Budget: ${budget}, Skill: ${skill}, Automation: ${automation})`);

    // Detect matched template
    const lowGoal = goal.toLowerCase();
    let selectedTemplate: Workflow | null = null;

    if (lowGoal.includes('linkedin') || lowGoal.includes('post')) {
      selectedTemplate = JSON.parse(JSON.stringify(TEMPLATE_WORKFLOWS.linkedin));
    } else if (lowGoal.includes('job') || lowGoal.includes('resume') || lowGoal.includes('cv')) {
      selectedTemplate = JSON.parse(JSON.stringify(TEMPLATE_WORKFLOWS.jobs));
    } else if (lowGoal.includes('review') || lowGoal.includes('sentiment') || lowGoal.includes('complaint')) {
      selectedTemplate = JSON.parse(JSON.stringify(TEMPLATE_WORKFLOWS.reviews));
    }

    // Attempt to query Supabase for tools first, fall back to catalogue
    let toolsCatalogue = INITIAL_TOOLS;
    try {
      const supabase = await createClient();
      const { data } = await supabase.from('tools').select('*').eq('is_active', true);
      if (data && data.length > 0) {
        toolsCatalogue = data;
      }
    } catch (e: any) {
      console.warn('[Workflow Gen Route] Supabase tools fetch skipped, using static catalog:', e.message);
    }

    // Check OpenRouter key availability
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
    const isKeyAvailable = typeof apiKey === 'string' && apiKey.length > 5 && !apiKey.includes('MY_GEMINI_API_KEY');

    if (isKeyAvailable) {
      try {
        // AI CALL 1: Requirements Extraction (system prompt + user prompt)
        const call1System = "You are an elite AI Workflow Architect. You analyze a user's goal and output structured JSON matching the requested requirements schema.";
        const call1Prompt = `Analyze this user goal and preferences. Break it down into chronological discrete tasks.
User Goal: "${goal}"
User Skill: ${skill}
Budget Category: ${budget}
Automation level requested: ${automation}
Data Sensitivity: ${dataSensitivity}
Free tools only: ${freeToolsOnly}

Generate a valid JSON object matching this structure exactly (DO NOT include any markdown block fences, comments, or prefix text):
{
  "workflowTitle": "Elegant Title",
  "goalSummary": "Summary of goal",
  "category": "content_creation",
  "userType": "Target persona",
  "technicalSkill": "beginner",
  "preferredImplementation": "no_code",
  "budget": {
    "type": "free",
    "maximumMonthlyAmount": null,
    "currency": "INR"
  },
  "frequency": "Daily",
  "automationLevel": "mostly_automated",
  "humanApprovalRequired": true,
  "dataSensitivity": "internal",
  "inputs": ["list input sources"],
  "outputs": ["list output targets"],
  "existingTools": [],
  "requiredCapabilities": ["e.g. text_generation", "web_search"],
  "assumptions": ["List assumptions made"],
  "risks": ["List risks"],
  "clarificationQuestions": [],
  "tasks": [
    {
      "id": "task-1",
      "order": 1,
      "title": "Short Task Title",
      "purpose": "A concise description of what this task accomplishes.",
      "requiredCapabilities": ["capability_key"],
      "inputType": ["JSON"],
      "outputType": ["Text"],
      "preferredToolCategories": ["research"],
      "requiresApi": true,
      "requiresWebhook": false,
      "requiresHumanApproval": false
    }
  ]
}`;

        console.log(`[Workflow Gen Route] Call 1: Extracting requirements...`);
        const res1Text = await generateOpenRouterCompletion(call1Prompt, call1System, true);
        
        // Handle potential markdown fences output by model
        let cleanedJson1 = res1Text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const extracted: WorkflowRequirements = JSON.parse(cleanedJson1);

        // Safe temporary diagnostics
        console.info("[API Workflow Generate Diagnostics] Call 1 keys:", Object.keys(extracted));

        // Dynamically find generated nodes under various potential properties
        const tasksArrayRaw = extracted.tasks || (extracted as any).steps || (extracted as any).workflowSteps || (extracted as any).workflow_steps || (extracted as any).nodes || (extracted as any).actions || (extracted as any).toolchain || [];
        console.info("[API Workflow Generate Diagnostics] Call 1 tasksArray raw exists:", !!tasksArrayRaw, "Array size:", Array.isArray(tasksArrayRaw) ? tasksArrayRaw.length : 'not an array');

        const tasksArray = (Array.isArray(tasksArrayRaw) ? tasksArrayRaw : []).map((t: any, index: number) => {
          return {
            id: t.id || `task-${index + 1}`,
            order: t.order || t.position || index + 1,
            title: t.title || t.stepTitle || t.name || `Task ${index + 1}`,
            purpose: t.purpose || t.explanation || t.description || 'Process data',
            requiredCapabilities: Array.isArray(t.requiredCapabilities) ? t.requiredCapabilities : [],
            inputType: Array.isArray(t.inputType) ? t.inputType : Array.isArray(t.input) ? t.input : [t.input || t.inputType || 'JSON'],
            outputType: Array.isArray(t.outputType) ? t.outputType : Array.isArray(t.output) ? t.output : [t.output || t.outputType || 'JSON'],
            preferredToolCategories: Array.isArray(t.preferredToolCategories) ? t.preferredToolCategories : [],
            requiresApi: t.requiresApi !== undefined ? t.requiresApi : true,
            requiresWebhook: t.requiresWebhook !== undefined ? t.requiresWebhook : false,
            requiresHumanApproval: t.requiresHumanApproval !== undefined ? t.requiresHumanApproval : false
          };
        });

        console.info("[API Workflow Generate Diagnostics] Call 1 tasksArray count:", tasksArray.length);

        // Deterministic server-side ranking & selection
        const workflowSteps: WorkflowStep[] = [];
        let prevToolSlug: string | null = null;
        let totalCostMin = 0;
        let totalCostMax = 0;
        let maxDifficultyScore = 1;

        for (const task of tasksArray) {
          const scoredTools = rankToolsForTask(task, extracted, toolsCatalogue, prevToolSlug);
          if (scoredTools.length === 0) continue;

          const topScored = scoredTools[0];
          const recommendedTool = toolsCatalogue.find(t => t.id === topScored.toolId) || toolsCatalogue[0];

          // Set up top 3 alternatives
          const alternatives = scoredTools.slice(1, 4).map(alt => {
            const altTool = toolsCatalogue.find(t => t.id === alt.toolId) || recommendedTool;
            const costDiff = altTool.starting_monthly_price === recommendedTool.starting_monthly_price
              ? "Equal cost"
              : (altTool.starting_monthly_price || 0) > (recommendedTool.starting_monthly_price || 0)
                ? `+${altTool.pricing_currency} ${Math.abs((altTool.starting_monthly_price || 0) - (recommendedTool.starting_monthly_price || 0))}/mo`
                : `-${altTool.pricing_currency} ${Math.abs((recommendedTool.starting_monthly_price || 0) - (altTool.starting_monthly_price || 0))}/mo`;

            return {
              toolId: altTool.id,
              toolSlug: altTool.slug,
              toolName: altTool.name,
              score: alt.totalScore,
              strength: altTool.best_for || "General usage",
              costDiff,
              difficultyDiff: altTool.technical_difficulty === recommendedTool.technical_difficulty
                ? "Equal level"
                : `Requires ${altTool.technical_difficulty} skills`,
              compatibilityDiff: "Compatible via API"
            };
          });

          const price = recommendedTool.starting_monthly_price || 0;
          totalCostMin += price > 0 ? price : 0;
          totalCostMax += price > 0 ? price * 1.25 : 0;

          const difficultyMap: Record<string, number> = { 'non_technical': 1, 'beginner': 2, 'intermediate': 3, 'developer': 4 };
          const score = difficultyMap[recommendedTool.technical_difficulty] || 1;
          if (score > maxDifficultyScore) maxDifficultyScore = score;

          workflowSteps.push({
            id: `step-${task.id || task.order}`,
            order: task.order,
            title: task.title,
            purpose: task.purpose,
            toolId: recommendedTool.id,
            toolSlug: recommendedTool.slug,
            toolName: recommendedTool.name,
            toolLogo: recommendedTool.logo_url,
            toolCategory: recommendedTool.category,
            whySelected: topScored.reasons.slice(0, 2).join('. ') || `Highly-ranked in ${recommendedTool.category}.`,
            input: task.inputType.join(', '),
            output: task.outputType.join(', '),
            setupInstructions: [], // to expand in next call
            expectedOutput: '',
            humanAction: task.requiresHumanApproval ? "Review generated values" : null,
            limitationNotes: recommendedTool.not_recommended_for ? [recommendedTool.not_recommended_for] : [],
            estimatedCost: recommendedTool.pricing_type === 'free' ? 'Free' : `${recommendedTool.pricing_currency} ${recommendedTool.starting_monthly_price}/mo`,
            difficulty: recommendedTool.technical_difficulty,
            isFree: recommendedTool.free_plan_available,
            requiresApi: task.requiresApi,
            requiresWebhook: task.requiresWebhook,
            privacyNotes: recommendedTool.data_retention_notes || "Standard security.",
            alternatives
          });

          prevToolSlug = recommendedTool.slug;
        }

        if (totalCostMin === 0) {
          totalCostMin = 0;
          totalCostMax = freeToolsOnly ? 0 : 500;
        }

        const reverseDifficulty = ["Non-technical", "Beginner", "Intermediate", "Developer"];
        const finalDifficultyStr = reverseDifficulty[maxDifficultyScore - 1] || "Beginner";

        // AI CALL 2: Instructions and Step Explanations
        const stepsSummaryForPrompt = workflowSteps.map(s => {
          return `Step ${s.order}: "${s.title}" using tool "${s.toolName}" (${s.toolSlug}). Input: ${s.input}. Output: ${s.output}.`;
        }).join('\n');

        const call2System = "You are a helpful senior developer and automation consultant. You write clear explanations and actionable steps for tool-chained workflows.";
        const call2Prompt = `Explain how to setup this completed workflow step-by-step.
Goal: "${goal}"
Total Budget: ${budget}
Skill Level: ${skill}

Workflow steps:
${stepsSummaryForPrompt}

Output a valid JSON matching this exact structure (NO markdown block fences, comments, or preamble):
{
  "summary": "One sentence summary of the workflow.",
  "outcome": "What the user will have accomplished.",
  "assumptions": ["Sensible technical assumptions"],
  "steps": [
    {
      "taskId": "Task ID of each matching step (e.g. step-1, step-2)",
      "stepTitle": "Title of step",
      "explanation": "Clear explanation of how the recommended tool resolves this task.",
      "setupInstructions": [
        "Actionable setup step 1",
        "Actionable setup step 2"
      ],
      "humanAction": "e.g. review trigger configurations, or null",
      "expectedOutput": "Specific indicator of success",
      "limitationNotes": ["Quota warning or rate limit details"]
    }
  ],
  "overallSetupInstructions": [
    "Global setup action 1",
    "Global setup action 2"
  ],
  "privacyWarnings": ["Data storage advisories"],
  "riskWarnings": ["Rate limit risks"],
  "optimisationSuggestions": ["Refinements to make it free or fast"]
}`;

        console.log(`[Workflow Gen Route] Call 2: Explaining workflow steps...`);
        const res2Text = await generateOpenRouterCompletion(call2Prompt, call2System, true);
        
        let cleanedJson2 = res2Text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const explanation: WorkflowExplanation = JSON.parse(cleanedJson2);

        // Merge AI explanations into deterministic steps
        const finalSteps = workflowSteps.map(step => {
          const explanationSteps = explanation.steps || (explanation as any).tasks || (explanation as any).workflowSteps || (explanation as any).workflow_steps || (explanation as any).nodes || (explanation as any).actions || (explanation as any).toolchain || [];
          const matchingAi = (Array.isArray(explanationSteps) ? explanationSteps : []).find((aiStep: any) =>
            aiStep.taskId === step.id ||
            aiStep.id === step.id ||
            (aiStep.stepTitle && aiStep.stepTitle.toLowerCase().includes(step.title.toLowerCase())) ||
            (aiStep.title && aiStep.title.toLowerCase().includes(step.title.toLowerCase()))
          );

          if (matchingAi) {
            step.setupInstructions = matchingAi.setupInstructions || [];
            step.expectedOutput = matchingAi.expectedOutput || "A verified status indicator.";
            if (matchingAi.humanAction) step.humanAction = matchingAi.humanAction;
            if (matchingAi.limitationNotes && matchingAi.limitationNotes.length > 0) {
              step.limitationNotes = [...new Set([...step.limitationNotes, ...matchingAi.limitationNotes])];
            }
          } else {
            step.setupInstructions = [
              `Register a free account on ${step.toolName}.`,
              `Generate your credentials or access keys under integration controls.`,
              `Integrate input properties from adjacent steps.`
            ];
            step.expectedOutput = "A verified JSON response payload.";
          }
          return step;
        });

        const finalWorkflow: Workflow = {
          id: `wf-${Date.now()}-${slugify(extracted.workflowTitle || 'engine')}`,
          title: extracted.workflowTitle || 'AI-Powered Custom Automation',
          description: explanation.summary || `Tailored custom workflow for: ${goal}`,
          category: extracted.category || inferCategoryFromGoal(goal),
          difficulty: finalDifficultyStr as any,
          automationLevel: (extracted.automationLevel === 'fully_automated' ? 'Fully automated' : extracted.automationLevel === 'mostly_automated' ? 'Mostly automated' : 'Semi-automated') as any,
          estimatedCostMin: Math.round(totalCostMin),
          estimatedCostMax: Math.round(totalCostMax),
          currency: extracted.budget.currency || 'INR',
          setupTimeEstimate: extracted.technicalSkill === 'developer' ? '25 minutes' : '45 minutes',
          humanApprovalRequired: extracted.humanApprovalRequired,
          privacyRisk: (extracted.dataSensitivity === 'highly_sensitive' || extracted.dataSensitivity === 'financial') ? 'High' : extracted.dataSensitivity === 'personal' ? 'Medium' : 'Low',
          steps: finalSteps,
          overallInstructions: explanation.overallSetupInstructions || ["Setup credentials.", "Connect step triggers."],
          privacyWarnings: explanation.privacyWarnings || [],
          riskWarnings: explanation.riskWarnings || [],
          optimisationSuggestions: explanation.optimisationSuggestions || [],
          requirementsSummary: extracted.goalSummary || goal,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return NextResponse.json(finalWorkflow);
      } catch (err: any) {
        console.error('[Workflow Route] OpenRouter error, falling back to static/templates:', err.message);
      }
    }

    // Dynamic builder / Offline template matching fallback
    console.log(`[Workflow Route] OpenRouter key unavailable or errored. Serving mock/template workflow...`);

    if (!selectedTemplate) {
      const category = inferCategoryFromGoal(goal);
      const matchingTools = toolsCatalogue.filter(t => t.category === category || t.subcategories.includes(category));
      const toolsToUse = matchingTools.length >= 3 ? matchingTools.slice(0, 3) : [toolsCatalogue[0], toolsCatalogue[5], toolsCatalogue[12]]; // Google Search, Feedly, Buffer

      const steps: WorkflowStep[] = toolsToUse.map((tool, idx) => {
        return {
          id: `step-${idx + 1}`,
          order: idx + 1,
          title: idx === 0 ? "Initial Data Query & Scraping" : idx === 1 ? "Automated Processing & Filtering" : "Dispatch & Alerts Queue",
          purpose: idx === 0 ? `Retrieve target triggers dynamically with ${tool.name}.` : idx === 1 ? `Process payload content utilizing ${tool.name}.` : `Dispatch results to downstream channels using ${tool.name}.`,
          toolId: tool.id,
          toolSlug: tool.slug,
          toolName: tool.name,
          toolLogo: tool.logo_url,
          toolCategory: tool.category,
          whySelected: `Top ranking fit in ${tool.category} with stable API endpoints.`,
          input: idx === 0 ? "Target search terms" : "Raw response lists",
          output: idx === 2 ? "Slack alert or spreadsheet row" : "Processed parameters",
          setupInstructions: [
            `Create a free account on ${tool.name} website.`,
            `Generate API access keys in developer profile settings.`,
            idx === 1 ? `Add system filters to sanitize parameters.` : `Bind parameters to trigger output alerts.`
          ],
          expectedOutput: "Successful task transition status.",
          humanAction: idx === 1 ? "Review output elements manually" : null,
          limitationNotes: tool.not_recommended_for ? [tool.not_recommended_for] : [],
          estimatedCost: tool.free_plan_available ? "Free Plan available" : `${tool.pricing_currency} ${tool.starting_monthly_price || 0}/mo`,
          difficulty: tool.technical_difficulty,
          isFree: tool.free_plan_available,
          requiresApi: true,
          requiresWebhook: false,
          privacyNotes: tool.data_retention_notes || "Standard SaaS terms.",
          alternatives: []
        };
      });

      selectedTemplate = {
        id: `wf-custom-${Date.now()}`,
        title: `${goal.length > 40 ? goal.slice(0, 40) + '...' : goal} Automation`,
        description: `Custom-generated automation workflow designed to process: "${goal}".`,
        category: category,
        difficulty: "Beginner",
        automationLevel: "Mostly automated",
        estimatedCostMin: freeToolsOnly ? 0 : 400,
        estimatedCostMax: freeToolsOnly ? 0 : 1000,
        currency: "INR",
        setupTimeEstimate: "35 minutes",
        humanApprovalRequired: true,
        privacyRisk: "Medium",
        steps: steps,
        overallInstructions: [
          `Register accounts on: ${steps.map(s => s.toolName).join(', ')}.`,
          "Link variables through an integration service like Make.com.",
          "Test scenario execution on dummy triggers before deploying live."
        ],
        privacyWarnings: [
          "Do not share secret tokens in unencrypted public text prompts."
        ],
        riskWarnings: [
          "Quota thresholds can pause workflows unexpectedly."
        ],
        optimisationSuggestions: [
          "Use google sheets as a mid-pipeline buffer to review outputs manually before notifications."
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (freeToolsOnly) {
      selectedTemplate.estimatedCostMin = 0;
      selectedTemplate.estimatedCostMax = 0;
      selectedTemplate.steps = selectedTemplate.steps.map(s => {
        s.estimatedCost = "Free (Static Free Tier)";
        s.isFree = true;
        return s;
      });
    }

    selectedTemplate.requirementsSummary = goal;
    return NextResponse.json(selectedTemplate);

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
