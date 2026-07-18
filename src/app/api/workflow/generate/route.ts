import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { generateOpenRouterCompletion } from '@/src/lib/ai/openrouter';
import { rankToolsForTask } from '@/src/lib/ranking-engine';
import { INITIAL_TOOLS } from '@/src/lib/config/tools-catalogue';
import { TEMPLATE_WORKFLOWS } from '@/src/templates';
import {
  CategoryType,
  Tool,
  Workflow,
  WorkflowRequirements,
  WorkflowStep
} from '@/src/types';

type CanonicalTask = WorkflowRequirements['tasks'][number];

type TaskKind =
  | 'research'
  | 'filter'
  | 'analyze'
  | 'summarize'
  | 'write'
  | 'design'
  | 'approval'
  | 'publish'
  | 'store'
  | 'notify'
  | 'automate'
  | 'general';

type TaskMetadata = {
  kind: TaskKind;
  requiredCapabilities: string[];
  preferredToolCategories: string[];
  requiresApi: boolean;
  requiresWebhook: boolean;
  requiresHumanApproval: boolean;
  defaultInput: string[];
  defaultOutput: string[];
};

const APPROVAL_PATTERN =
  /\b(human approval|approval gate|manual approval|approve before|review before|approve or reject|sign[- ]?off|verification gate|never publish without(?: human)? approval|asks?(?: me| the user| a human)? for approval|asks?(?: me| the user| a human)? to approve|approval before (?:posting|publishing|sending)|approve(?: it| this| the response)? before (?:posting|publishing|sending))\b/i;

const PUBLISH_PATTERN =
  /\b(publish|publishing|schedule|scheduling|post to linkedin|post on linkedin|social publishing|queue post|dispatch post)\b/i;

function inferCategoryFromGoal(goal: string): CategoryType {
  const low = goal.toLowerCase();

  if (
    low.includes('linkedin') ||
    low.includes('post') ||
    low.includes('tweet') ||
    low.includes('social') ||
    low.includes('blog') ||
    low.includes('video')
  ) {
    return 'content_creation';
  }

  if (
    low.includes('job') ||
    low.includes('resume') ||
    low.includes('cv') ||
    low.includes('application') ||
    low.includes('hiring')
  ) {
    return 'job_search';
  }

  if (
    low.includes('review') ||
    low.includes('sentiment') ||
    low.includes('feedback') ||
    low.includes('complaint')
  ) {
    return 'data_reporting';
  }

  if (
    low.includes('customer') ||
    low.includes('support') ||
    low.includes('ticket') ||
    low.includes('email') ||
    low.includes('chat')
  ) {
    return 'customer_support';
  }

  if (
    low.includes('sell') ||
    low.includes('lead') ||
    low.includes('crm') ||
    low.includes('sales')
  ) {
    return 'sales';
  }

  if (
    low.includes('marketing') ||
    low.includes('promote') ||
    low.includes('ad') ||
    low.includes('campaign')
  ) {
    return 'marketing';
  }

  if (
    low.includes('code') ||
    low.includes('develop') ||
    low.includes('build') ||
    low.includes('api') ||
    low.includes('database')
  ) {
    return 'development';
  }

  if (
    low.includes('money') ||
    low.includes('price') ||
    low.includes('billing') ||
    low.includes('stripe') ||
    low.includes('invoice') ||
    low.includes('bitcoin')
  ) {
    return 'finance';
  }

  if (
    low.includes('search') ||
    low.includes('scrape') ||
    low.includes('research') ||
    low.includes('learn')
  ) {
    return 'research';
  }

  return 'productivity';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function cleanTaskSentence(value: string): string {
  return value
    .trim()
    .replace(/^[-–—•]\s*/, '')
    .replace(/[.,;]+$/, '')
    .trim();
}

function toTaskTitle(value: string): string {
  const cleaned = cleanTaskSentence(value);

  if (!cleaned) return 'Workflow Task';

  const short = cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}...` : cleaned;

  return short.charAt(0).toUpperCase() + short.slice(1);
}

function extractNumberedGoalSteps(goal: string): string[] {
  const matches: { order: number; text: string }[] = [];
  const regex = /(?:^|\n)\s*(\d{1,2})\s*[\.\)]\s+([^\n]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(goal)) !== null) {
    const order = Number(match[1]);
    const text = cleanTaskSentence(match[2]);

    if (Number.isFinite(order) && text) {
      matches.push({ order, text });
    }
  }

  if (matches.length < 2) return [];

  matches.sort((a, b) => a.order - b.order);
  return matches.map((item) => item.text);
}


const ACTION_VERB_SOURCE =
  'checks?|collects?|fetches?|retrieves?|pulls?|gets?|finds?|identifies?|analy[sz]es?|classifies?|filters?|removes?|scores?|ranks?|selects?|summari[sz]es?|drafts?|writes?|creates?|generates?|designs?|alerts?|notifies?|sends?|asks?|requests?|reviews?|approves?|posts?|publishes?|schedules?|stores?|tracks?|flags?|detects?|monitors?|tailors?|reminds?|extracts?';

function extractNaturalGoalSteps(goal: string): string[] {
  const cleanedGoal = goal
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /^(?:(?:please\s+)?(?:create|build|make|design|set up)\s+(?:me\s+)?(?:a|an)?\s*workflow\s+(?:that|to)\s+|(?:please\s+)?help me\s+)/i,
      ''
    );

  if (!cleanedGoal) return [];

  const splitter = new RegExp(
    `\\s*(?:,|;|\\band\\b)\\s+(?=(?:then\\s+)?(?:${ACTION_VERB_SOURCE})\\b)`,
    'i'
  );

  const rawClauses = cleanedGoal
    .split(splitter)
    .map(cleanTaskSentence)
    .filter(Boolean);

  if (rawClauses.length < 2) return [];

  const expanded: string[] = [];

  for (const clause of rawClauses) {
    const low = clause.toLowerCase();

    // One phrase often hides two separate workflow jobs:
    // detect urgency, then send the alert.
    if (
      /\b(alerts?|notifies?|notify|sends?|send)\b/i.test(low) &&
      /\b(urgent|critical|high priority|emergency)\b/i.test(low)
    ) {
      expanded.push('Detect urgent or critical problems');
      expanded.push('Send an alert about urgent or critical problems');
      continue;
    }

    // "Ask for approval before posting" must become an approval gate
    // followed by a separate posting step.
    if (
      APPROVAL_PATTERN.test(low) &&
      /\b(post|posting|publish|publishing|send|sending)\b/i.test(low)
    ) {
      expanded.push('Request human approval for the drafted response');
      expanded.push('Post only the approved response to the original platform');
      continue;
    }

    // A design tool and a publishing tool are different jobs.
    if (
      /\b(design|create visual|carousel|graphic|image)\b/i.test(low) &&
      /\b(schedule|publish|post)\b/i.test(low)
    ) {
      expanded.push('Design the final visual asset');
      expanded.push('Schedule and publish the approved content');
      continue;
    }

    expanded.push(clause);
  }

  return uniqueStrings(expanded.map(cleanTaskSentence));
}

function extractGoalSteps(goal: string): string[] {
  const numberedSteps = extractNumberedGoalSteps(goal);
  return numberedSteps.length >= 2
    ? numberedSteps
    : extractNaturalGoalSteps(goal);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function inferTaskKind(text: string): TaskKind {
  const low = text.toLowerCase();

  // Review collection is an API/automation job, not news research.
  if (
    /\b(checks?|collects?|fetches?|retrieves?|pulls?|monitors?|gets?)\b.*\b(reviews?|customer feedback)\b/i.test(
      low
    )
  ) {
    return 'automate';
  }

  // Posting an approved reply back to a review platform usually needs
  // that platform's API or an automation connector, not a social scheduler.
  if (
    /\b(post|publish|send)\b.*\b(review|reply|response)\b|\b(review|reply|response)\b.*\b(post|publish|send)\b/i.test(
      low
    )
  ) {
    return 'automate';
  }

  if (APPROVAL_PATTERN.test(low)) return 'approval';
  if (PUBLISH_PATTERN.test(low)) return 'publish';

  if (
    /\b(common complaints?|recurring issues?|themes?|sentiment|urgent issues?|critical problems?|detect urgency|fact[- ]?check|verify claims?)\b/i.test(
      low
    )
  ) {
    return 'analyze';
  }

  if (
    /\b(summarize|summarise|summary|synthesize|synthesise|key points)\b/i.test(
      low
    )
  ) {
    return 'summarize';
  }

  if (
    /\b(score|scores|rank|ranks|selects?|prioriti[sz]e|evaluate|assess|classify|top \d+|most important)\b/i.test(
      low
    )
  ) {
    return 'analyze';
  }

  if (
    /\b(draft|write|rewrite|caption|copy|headline|hook|script|outline|post text)\b/i.test(
      low
    ) &&
    !/\b(design|visual|graphic|image|illustration|render)\b/i.test(low)
  ) {
    return 'write';
  }

  if (
    /\b(design|visual|graphic|image|illustration|render|layout|slides?|carousel design|presentation)\b/i.test(
      low
    )
  ) {
    return 'design';
  }

  if (
    /\b(filter|deduplicate|de-duplicate|duplicate|remove repeated|low-quality|clean|validate|quality check|moderate)\b/i.test(
      low
    )
  ) {
    return 'filter';
  }

  if (
    /\b(find|fetch|search|research|discover|collect|monitor|latest news|article|rss|scrape|source)\b/i.test(
      low
    )
  ) {
    return 'research';
  }

  if (/\b(save|store|log|database|spreadsheet|archive|record)\b/i.test(low)) {
    return 'store';
  }

  if (
    /\b(notify|notification|alert|send email|email report|message team|slack message)\b/i.test(
      low
    )
  ) {
    return 'notify';
  }

  if (
    /\b(connect|integrate|automation|automate|webhook|trigger|route|orchestrate|map data)\b/i.test(
      low
    )
  ) {
    return 'automate';
  }

  return 'general';
}


function preferredToolSlugsForTask(task: CanonicalTask): string[] {
  const kind = inferTaskKind(`${task.title} ${task.purpose}`);

  switch (kind) {
    case 'automate':
      return ['make', 'n8n', 'zapier', 'pipedream'];
    case 'analyze':
    case 'summarize':
      return ['gemini', 'chatgpt', 'claude', 'openrouter', 'perplexity'];
    case 'write':
      return ['gemini', 'chatgpt', 'claude', 'openrouter'];
    case 'approval':
      return ['airtable', 'notion', 'google-sheets'];
    case 'notify':
      return ['gmail', 'slack', 'make', 'n8n', 'zapier'];
    case 'publish':
      return ['buffer'];
    case 'design':
      return ['canva', 'recraft'];
    case 'filter':
      return ['make', 'n8n', 'zapier', 'pipedream', 'gemini', 'chatgpt'];
    case 'research':
      return ['feedly', 'perplexity', 'google-search'];
    case 'store':
      return ['airtable', 'notion', 'google-sheets', 'supabase'];
    default:
      return [];
  }
}

function findPreferredToolForTask(
  task: CanonicalTask,
  tools: Tool[]
): Tool | null {
  for (const slug of preferredToolSlugsForTask(task)) {
    const tool = tools.find(
      (candidate) =>
        candidate.slug === slug &&
        candidate.is_active !== false &&
        candidate.verification_status !== 'unverified'
    );

    if (tool) return tool;
  }

  return null;
}

function metadataForTask(text: string): TaskMetadata {
  const kind = inferTaskKind(text);

  switch (kind) {
    case 'research':
      return {
        kind,
        requiredCapabilities: [
          'rss_feed',
          'article_monitoring',
          'web_search',
          'web_browsing'
        ],
        preferredToolCategories: ['research'],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Trusted news sources and topics'],
        defaultOutput: ['Article titles, URLs, dates, and source names']
      };

    case 'filter':
      return {
        kind,
        requiredCapabilities: [
          'conditional_routing',
          'data_mapping',
          'reasoning'
        ],
        preferredToolCategories: ['productivity', 'development'],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Raw article list'],
        defaultOutput: ['Cleaned, deduplicated article list']
      };

    case 'analyze':
      return {
        kind,
        requiredCapabilities: [
          'reasoning',
          'data_analysis',
          'text_generation',
          'structured_json_output'
        ],
        preferredToolCategories: ['research'],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Filtered items and scoring criteria'],
        defaultOutput: ['Ranked shortlist with reasons and scores']
      };

    case 'summarize':
      return {
        kind,
        requiredCapabilities: [
          'text_generation',
          'document_analysis',
          'reasoning'
        ],
        preferredToolCategories: ['research'],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Selected source articles'],
        defaultOutput: ['Fact-grounded summaries with source links']
      };

    case 'write':
      return {
        kind,
        requiredCapabilities: [
          'text_generation',
          'reasoning',
          'structured_json_output'
        ],
        preferredToolCategories: ['research'],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Approved facts and summaries'],
        defaultOutput: ['Draft copy and structured content outline']
      };

    case 'design':
      return {
        kind,
        requiredCapabilities: [
          'image_editing',
          'presentation_creation',
          'ai_image_magic'
        ],
        preferredToolCategories: ['content_creation'],
        requiresApi: false,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Approved copy and visual outline'],
        defaultOutput: ['Designed visual asset or carousel']
      };

    case 'approval':
      return {
        kind,
        requiredCapabilities: [
          'data_storage',
          'form_input',
          'view_filtering',
          'real_time_collaboration'
        ],
        preferredToolCategories: ['productivity'],
        requiresApi: false,
        requiresWebhook: false,
        requiresHumanApproval: true,
        defaultInput: ['Draft content and supporting sources'],
        defaultOutput: ['Approved, rejected, or revision-requested status']
      };

    case 'publish':
      return {
        kind,
        requiredCapabilities: [
          'post_scheduling',
          'social_publishing'
        ],
        preferredToolCategories: ['marketing'],
        requiresApi: true,
        requiresWebhook: true,
        requiresHumanApproval: false,
        defaultInput: ['Approved final copy and media'],
        defaultOutput: ['Scheduled or published social post']
      };

    case 'store':
      return {
        kind,
        requiredCapabilities: [
          'data_storage',
          'relational_data',
          'real_time_collaboration'
        ],
        preferredToolCategories: ['productivity'],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Workflow output'],
        defaultOutput: ['Stored and retrievable record']
      };

    case 'notify':
      return {
        kind,
        requiredCapabilities: [
          'email_sending',
          'channel_alerts',
          'team_messaging'
        ],
        preferredToolCategories: ['productivity'],
        requiresApi: true,
        requiresWebhook: true,
        requiresHumanApproval: false,
        defaultInput: ['Status or report payload'],
        defaultOutput: ['Delivered notification']
      };

    case 'automate':
      return {
        kind,
        requiredCapabilities: [
          'webhook_handling',
          'api_integration',
          'conditional_routing',
          'data_mapping'
        ],
        preferredToolCategories: ['productivity', 'development'],
        requiresApi: true,
        requiresWebhook: true,
        requiresHumanApproval: false,
        defaultInput: ['Upstream event or payload'],
        defaultOutput: ['Mapped downstream action']
      };

    default:
      return {
        kind,
        requiredCapabilities: [],
        preferredToolCategories: [],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Previous step output'],
        defaultOutput: ['Processed result']
      };
  }
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const converted = value
      .map((item) => String(item).trim())
      .filter(Boolean);

    return converted.length > 0 ? converted : fallback;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return fallback;
}

function normalizeAiTasks(raw: unknown): CanonicalTask[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((task: any, index: number) => ({
    id: task.id || `task-${index + 1}`,
    order: Number(task.order || task.position || index + 1),
    title:
      task.title ||
      task.stepTitle ||
      task.name ||
      `Task ${index + 1}`,
    purpose:
      task.purpose ||
      task.explanation ||
      task.description ||
      'Process the previous step output.',
    requiredCapabilities: toStringArray(
      task.requiredCapabilities,
      []
    ),
    inputType: toStringArray(
      task.inputType ?? task.input,
      ['Previous step output']
    ),
    outputType: toStringArray(
      task.outputType ?? task.output,
      ['Processed result']
    ),
    preferredToolCategories: toStringArray(
      task.preferredToolCategories,
      []
    ),
    requiresApi:
      task.requiresApi !== undefined ? Boolean(task.requiresApi) : true,
    requiresWebhook:
      task.requiresWebhook !== undefined
        ? Boolean(task.requiresWebhook)
        : false,
    requiresHumanApproval:
      task.requiresHumanApproval !== undefined
        ? Boolean(task.requiresHumanApproval)
        : false
  }));
}

function approvalRequested(
  goal: string,
  extractedApproval: boolean
): boolean {
  return extractedApproval || APPROVAL_PATTERN.test(goal);
}

function isApprovalTask(task: CanonicalTask): boolean {
  return (
    task.requiresHumanApproval ||
    APPROVAL_PATTERN.test(`${task.title} ${task.purpose}`)
  );
}

function isPublishTask(task: CanonicalTask): boolean {
  return PUBLISH_PATTERN.test(`${task.title} ${task.purpose}`);
}

function reindexTasks(tasks: CanonicalTask[]): CanonicalTask[] {
  return tasks.map((task, index) => ({
    ...task,
    id: `task-${index + 1}`,
    order: index + 1
  }));
}

function enforceApprovalBeforePublishing(
  tasks: CanonicalTask[],
  goal: string,
  extractedApproval: boolean
): CanonicalTask[] {
  if (!approvalRequested(goal, extractedApproval)) {
    return reindexTasks(tasks);
  }

  let nextTasks = [...tasks];
  let approvalIndex = nextTasks.findIndex(isApprovalTask);
  const publishIndex = nextTasks.findIndex(isPublishTask);

  if (approvalIndex === -1) {
    const metadata = metadataForTask(
      'Require human approval before publishing'
    );

    const approvalTask: CanonicalTask = {
      id: 'task-approval',
      order: 0,
      title: 'Require human approval before publishing',
      purpose:
        'Pause the workflow until a person approves, rejects, or requests changes.',
      requiredCapabilities: metadata.requiredCapabilities,
      inputType: metadata.defaultInput,
      outputType: metadata.defaultOutput,
      preferredToolCategories: metadata.preferredToolCategories,
      requiresApi: metadata.requiresApi,
      requiresWebhook: metadata.requiresWebhook,
      requiresHumanApproval: true
    };

    const insertAt = publishIndex >= 0 ? publishIndex : nextTasks.length;
    nextTasks.splice(insertAt, 0, approvalTask);
    approvalIndex = insertAt;
  }

  const updatedApprovalTask = {
    ...nextTasks[approvalIndex],
    requiresHumanApproval: true
  };

  nextTasks[approvalIndex] = updatedApprovalTask;

  const currentPublishIndex = nextTasks.findIndex(isPublishTask);

  if (
    currentPublishIndex >= 0 &&
    approvalIndex > currentPublishIndex
  ) {
    const [approvalTask] = nextTasks.splice(approvalIndex, 1);
    nextTasks.splice(currentPublishIndex, 0, approvalTask);
  }

  return reindexTasks(nextTasks);
}

function buildCanonicalTasks(
  goal: string,
  aiTasks: CanonicalTask[],
  extractedApproval: boolean
): CanonicalTask[] {
  const explicitSteps = extractGoalSteps(goal);

  let tasks: CanonicalTask[];

  if (explicitSteps.length >= 2) {
    tasks = explicitSteps.map((sentence, index) => {
      const metadata = metadataForTask(sentence);
      const aiTask = aiTasks[index];

      const requiredCapabilities =
        metadata.kind === 'general'
          ? uniqueStrings([
              ...(aiTask?.requiredCapabilities || []),
              ...metadata.requiredCapabilities
            ])
          : metadata.requiredCapabilities;

      const preferredToolCategories =
        metadata.kind === 'general'
          ? uniqueStrings([
              ...(aiTask?.preferredToolCategories || []),
              ...metadata.preferredToolCategories
            ])
          : metadata.preferredToolCategories;

      return {
        id: `task-${index + 1}`,
        order: index + 1,
        title: toTaskTitle(sentence),
        purpose: sentence,
        requiredCapabilities,
        inputType:
          aiTask?.inputType?.length > 0
            ? aiTask.inputType
            : metadata.defaultInput,
        outputType:
          aiTask?.outputType?.length > 0
            ? aiTask.outputType
            : metadata.defaultOutput,
        preferredToolCategories,
        requiresApi: metadata.requiresApi,
        requiresWebhook: metadata.requiresWebhook,
        requiresHumanApproval:
          metadata.requiresHumanApproval ||
          Boolean(aiTask?.requiresHumanApproval)
      };
    });
  } else {
    tasks = aiTasks.map((task, index) => {
      const metadata = metadataForTask(
        `${task.title} ${task.purpose}`
      );

      return {
        ...task,
        id: `task-${index + 1}`,
        order: index + 1,
        requiredCapabilities:
          task.requiredCapabilities.length > 0
            ? task.requiredCapabilities
            : metadata.requiredCapabilities,
        preferredToolCategories:
          task.preferredToolCategories.length > 0
            ? task.preferredToolCategories
            : metadata.preferredToolCategories,
        requiresHumanApproval:
          task.requiresHumanApproval ||
          metadata.requiresHumanApproval
      };
    });
  }

  return enforceApprovalBeforePublishing(
    tasks,
    goal,
    extractedApproval
  );
}

function normalizeRequirements(
  raw: any,
  goal: string,
  skill: string,
  budget: string,
  automation: string,
  dataSensitivity: string
): WorkflowRequirements {
  const normalizedSkill: WorkflowRequirements['technicalSkill'] =
    ['non_technical', 'beginner', 'intermediate', 'developer'].includes(
      raw?.technicalSkill
    )
      ? raw.technicalSkill
      : (skill as WorkflowRequirements['technicalSkill']);

  const normalizedAutomation: WorkflowRequirements['automationLevel'] =
    ['manual', 'assisted', 'mostly_automated', 'fully_automated'].includes(
      raw?.automationLevel
    )
      ? raw.automationLevel
      : (automation as WorkflowRequirements['automationLevel']);

  const normalizedSensitivity: WorkflowRequirements['dataSensitivity'] =
    [
      'public',
      'internal',
      'personal',
      'financial',
      'highly_sensitive'
    ].includes(raw?.dataSensitivity)
      ? raw.dataSensitivity
      : (dataSensitivity as WorkflowRequirements['dataSensitivity']);

  const budgetType: WorkflowRequirements['budget']['type'] =
    ['free', 'limited', 'flexible', 'custom'].includes(raw?.budget?.type)
      ? raw.budget.type
      : (budget as WorkflowRequirements['budget']['type']);

  return {
    workflowTitle:
      typeof raw?.workflowTitle === 'string' && raw.workflowTitle.trim()
        ? raw.workflowTitle.trim()
        : 'AI-Powered Custom Automation',
    goalSummary:
      typeof raw?.goalSummary === 'string' && raw.goalSummary.trim()
        ? raw.goalSummary.trim()
        : goal,
    category:
      raw?.category || inferCategoryFromGoal(goal),
    userType:
      typeof raw?.userType === 'string' && raw.userType.trim()
        ? raw.userType.trim()
        : 'General user',
    technicalSkill: normalizedSkill,
    preferredImplementation:
      raw?.preferredImplementation || 'no_code',
    budget: {
      type: budgetType,
      maximumMonthlyAmount:
        typeof raw?.budget?.maximumMonthlyAmount === 'number'
          ? raw.budget.maximumMonthlyAmount
          : null,
      currency:
        typeof raw?.budget?.currency === 'string'
          ? raw.budget.currency
          : 'INR'
    },
    frequency:
      typeof raw?.frequency === 'string' ? raw.frequency : null,
    automationLevel: normalizedAutomation,
    humanApprovalRequired: Boolean(raw?.humanApprovalRequired),
    dataSensitivity: normalizedSensitivity,
    inputs: toStringArray(raw?.inputs, []),
    outputs: toStringArray(raw?.outputs, []),
    existingTools: toStringArray(raw?.existingTools, []),
    requiredCapabilities: toStringArray(
      raw?.requiredCapabilities,
      []
    ),
    assumptions: toStringArray(raw?.assumptions, []),
    risks: toStringArray(raw?.risks, []),
    clarificationQuestions: Array.isArray(raw?.clarificationQuestions)
      ? raw.clarificationQuestions
      : [],
    tasks: []
  };
}

function workflowStepIsApproval(step: WorkflowStep): boolean {
  return APPROVAL_PATTERN.test(
    `${step.title} ${step.purpose} ${step.humanAction || ''}`
  );
}

function workflowStepIsPublish(step: WorkflowStep): boolean {
  return PUBLISH_PATTERN.test(`${step.title} ${step.purpose}`);
}

function validateFinalWorkflow(
  workflow: Workflow,
  expectedNumberedStepCount: number,
  mustHaveApproval: boolean
): string | null {
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    return 'Workflow generation returned no steps';
  }

  if (
    expectedNumberedStepCount >= 2 &&
    workflow.steps.length !== expectedNumberedStepCount
  ) {
    return `Expected ${expectedNumberedStepCount} user-requested steps but generated ${workflow.steps.length}`;
  }

  if (mustHaveApproval) {
    const approvalIndex = workflow.steps.findIndex(
      workflowStepIsApproval
    );
    const publishIndex = workflow.steps.findIndex(
      workflowStepIsPublish
    );

    if (approvalIndex === -1) {
      return 'Human approval was requested but no approval step was generated';
    }

    if (publishIndex >= 0 && approvalIndex > publishIndex) {
      return 'Human approval must occur before publishing';
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const { goal, preferences } = await request.json();

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json(
        { error: 'Please describe what you want to accomplish!' },
        { status: 400 }
      );
    }

    const budget = preferences?.budget || 'flexible';
    const skill = preferences?.skill || 'beginner';
    const automation =
      preferences?.automation || 'mostly_automated';
    const dataSensitivity =
      preferences?.dataSensitivity || 'internal';
    const freeToolsOnly = Boolean(
      preferences?.freeToolsOnly
    );

    console.log(
      `[Workflow Route] Goal: "${goal}" (Budget: ${budget}, Skill: ${skill}, Automation: ${automation})`
    );

    const lowGoal = goal.toLowerCase();
    let selectedTemplate: Workflow | null = null;

    if (lowGoal.includes('linkedin') || lowGoal.includes('post')) {
      selectedTemplate = JSON.parse(
        JSON.stringify(TEMPLATE_WORKFLOWS.linkedin)
      );
    } else if (
      lowGoal.includes('job') ||
      lowGoal.includes('resume') ||
      lowGoal.includes('cv')
    ) {
      selectedTemplate = JSON.parse(
        JSON.stringify(TEMPLATE_WORKFLOWS.jobs)
      );
    } else if (
      lowGoal.includes('review') ||
      lowGoal.includes('sentiment') ||
      lowGoal.includes('complaint')
    ) {
      selectedTemplate = JSON.parse(
        JSON.stringify(TEMPLATE_WORKFLOWS.reviews)
      );
    }

    let toolsCatalogue: Tool[] = INITIAL_TOOLS.map((tool) => ({
      ...tool,
      is_active: tool.is_active ?? true
    }));

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (data && data.length > 0) {
        toolsCatalogue = data.map((tool) => ({
          ...tool,
          is_active: tool.is_active ?? true
        }));
      }
    } catch (error: any) {
      console.warn(
        '[Workflow Gen Route] Supabase tools fetch skipped, using static catalogue:',
        error.message
      );
    }

    const apiKey =
      process.env.OPENROUTER_API_KEY ||
      process.env.GEMINI_API_KEY;

    const isKeyAvailable =
      typeof apiKey === 'string' &&
      apiKey.length > 5 &&
      !apiKey.includes('MY_GEMINI_API_KEY');

    if (isKeyAvailable) {
      try {
        const explicitGoalSteps = extractGoalSteps(goal);

        const call1System =
          'You are an elite AI Workflow Architect. Return only valid JSON. Preserve every user action detected by the server in the same order and with the same meaning. Do not replace requested tasks with different tasks.';

        const call1Prompt = `Analyze this user goal and preferences.

User Goal:
${goal}

User Skill: ${skill}
Budget Category: ${budget}
Automation level requested: ${automation}
Data Sensitivity: ${dataSensitivity}
Free tools only: ${freeToolsOnly}
Explicit action step count detected by server: ${explicitGoalSteps.length}

STRICT RULES:
1. Return exactly one task for every server-detected user action.
2. Preserve their order and meaning.
3. Do not invent substitute tasks such as "idea generation" when the user requested filtering, scoring, summarising, approval, design, or publishing.
4. Human approval must be its own task whenever requested.
5. Publishing must occur after approval.
6. Return JSON only.

Use this exact shape:
{
  "workflowTitle": "Elegant title",
  "goalSummary": "Faithful summary",
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
  "inputs": ["input"],
  "outputs": ["output"],
  "existingTools": [],
  "requiredCapabilities": ["text_generation"],
  "assumptions": [],
  "risks": [],
  "clarificationQuestions": [],
  "tasks": [
    {
      "id": "task-1",
      "order": 1,
      "title": "Task title",
      "purpose": "What this exact task accomplishes",
      "requiredCapabilities": ["capability_key"],
      "inputType": ["Input"],
      "outputType": ["Output"],
      "preferredToolCategories": ["research"],
      "requiresApi": true,
      "requiresWebhook": false,
      "requiresHumanApproval": false
    }
  ]
}`;

        console.log(
          '[Workflow Gen Route] Call 1: Extracting requirements...'
        );

        let rawExtracted: any = {};

        try {
          const call1Text = await withTimeout(
            generateOpenRouterCompletion(
              call1Prompt,
              call1System,
              true
            ),
            20000,
            'Workflow planning request'
          );

          const cleanedCall1 = call1Text
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();

          rawExtracted = JSON.parse(cleanedCall1);
        } catch (error: any) {
          console.warn(
            '[Workflow Gen Route] Call 1 failed. Using the deterministic action plan:',
            error.message
          );
        }

        const extracted = normalizeRequirements(
          rawExtracted,
          goal,
          skill,
          budget,
          automation,
          dataSensitivity
        );

        const rawTasks =
          rawExtracted.tasks ||
          rawExtracted.steps ||
          rawExtracted.workflowSteps ||
          rawExtracted.workflow_steps ||
          rawExtracted.nodes ||
          rawExtracted.actions ||
          rawExtracted.toolchain ||
          [];

        const aiTasks = normalizeAiTasks(rawTasks);

        const tasksArray = buildCanonicalTasks(
          goal,
          aiTasks,
          extracted.humanApprovalRequired
        );

        extracted.tasks = tasksArray;
        extracted.humanApprovalRequired = approvalRequested(
          goal,
          extracted.humanApprovalRequired
        );

        console.info(
          '[API Workflow Generate Diagnostics] Canonical task plan',
          {
            detectedActionCount: explicitGoalSteps.length,
            aiTaskCount: aiTasks.length,
            canonicalTaskCount: tasksArray.length,
            humanApprovalRequired:
              extracted.humanApprovalRequired,
            titles: tasksArray.map((task) => task.title)
          }
        );

        const workflowSteps: WorkflowStep[] = [];
        let previousToolSlug: string | null = null;
        let maximumDifficultyScore = 1;

        const paidToolSlugs = new Set<string>();
        let optionalPaidMaximum = 0;
        let requiredPaidMinimum = 0;
        const costCurrencies = new Set<string>();

        for (const task of tasksArray) {
          const scoredTools = rankToolsForTask(
            task,
            extracted,
            toolsCatalogue,
            previousToolSlug
          );

          const deterministicTool = findPreferredToolForTask(
            task,
            toolsCatalogue
          );

          if (scoredTools.length === 0 && !deterministicTool) {
            throw new Error(
              `No eligible tool found for task: ${task.title}`
            );
          }

          const topScored = scoredTools[0];
          const recommendedTool =
            deterministicTool ||
            toolsCatalogue.find(
              (tool) => tool.id === topScored?.toolId
            ) ||
            toolsCatalogue[0];

          const selectedScore =
            scoredTools.find(
              (score) => score.toolId === recommendedTool.id
            ) || topScored;

          const alternatives = scoredTools
            .filter(
              (alternative) =>
                alternative.toolId !== recommendedTool.id
            )
            .slice(0, 3)
            .map((alternative) => {
              const alternativeTool =
                toolsCatalogue.find(
                  (tool) => tool.id === alternative.toolId
                ) || recommendedTool;

              const recommendedPrice =
                recommendedTool.starting_monthly_price || 0;
              const alternativePrice =
                alternativeTool.starting_monthly_price || 0;

              const costDifference =
                alternativePrice === recommendedPrice
                  ? 'Equal listed starting price'
                  : alternativePrice > recommendedPrice
                    ? `+${alternativeTool.pricing_currency} ${Math.abs(
                        alternativePrice - recommendedPrice
                      )}/mo`
                    : `-${alternativeTool.pricing_currency} ${Math.abs(
                        recommendedPrice - alternativePrice
                      )}/mo`;

              return {
                toolId: alternativeTool.id,
                toolSlug: alternativeTool.slug,
                toolName: alternativeTool.name,
                score: alternative.totalScore,
                strength:
                  alternativeTool.best_for ||
                  'General usage',
                costDiff: costDifference,
                difficultyDiff:
                  alternativeTool.technical_difficulty ===
                  recommendedTool.technical_difficulty
                    ? 'Equal level'
                    : `Requires ${alternativeTool.technical_difficulty} skills`,
                compatibilityDiff: 'Compatible via API'
              };
            });

          if (
            !paidToolSlugs.has(recommendedTool.slug) &&
            (recommendedTool.starting_monthly_price || 0) > 0
          ) {
            paidToolSlugs.add(recommendedTool.slug);
            costCurrencies.add(
              recommendedTool.pricing_currency
            );

            if (recommendedTool.free_plan_available) {
              optionalPaidMaximum +=
                recommendedTool.starting_monthly_price || 0;
            } else {
              requiredPaidMinimum +=
                recommendedTool.starting_monthly_price || 0;
              optionalPaidMaximum +=
                recommendedTool.starting_monthly_price || 0;
            }
          }

          const difficultyMap: Record<string, number> = {
            non_technical: 1,
            beginner: 2,
            intermediate: 3,
            developer: 4
          };

          const difficultyScore =
            difficultyMap[
              recommendedTool.technical_difficulty
            ] || 1;

          maximumDifficultyScore = Math.max(
            maximumDifficultyScore,
            difficultyScore
          );

          const taskIsApproval = isApprovalTask(task);
          const taskIsPublish = isPublishTask(task);

          let humanAction: string | null = null;

          if (taskIsApproval) {
            humanAction =
              'Approve, reject, or request changes. The workflow must not continue until the status is Approved.';
          } else if (
            taskIsPublish &&
            extracted.humanApprovalRequired
          ) {
            humanAction =
              'Confirm the previous approval status is Approved before scheduling or publishing.';
          }

          const estimatedCost =
            recommendedTool.pricing_type === 'free'
              ? 'Free'
              : recommendedTool.free_plan_available
                ? recommendedTool.starting_monthly_price
                  ? `Free plan; paid from ${recommendedTool.pricing_currency} ${recommendedTool.starting_monthly_price}/mo`
                  : 'Free plan available'
                : `${recommendedTool.pricing_currency} ${
                    recommendedTool.starting_monthly_price || 0
                  }/mo`;

          workflowSteps.push({
            id: `step-${task.id}`,
            order: task.order,
            title: task.title,
            purpose: task.purpose,
            toolId: recommendedTool.id,
            toolSlug: recommendedTool.slug,
            toolName: recommendedTool.name,
            toolLogo: recommendedTool.logo_url,
            toolCategory: recommendedTool.category,
            whySelected:
              selectedScore?.reasons
                ?.slice(0, 2)
                .join('. ') ||
              `Selected for the ${inferTaskKind(
                `${task.title} ${task.purpose}`
              )} role using a fixed task-to-tool rule.`,
            input: task.inputType.join(', '),
            output: task.outputType.join(', '),
            setupInstructions: [],
            expectedOutput: '',
            humanAction,
            limitationNotes:
              recommendedTool.not_recommended_for
                ? [recommendedTool.not_recommended_for]
                : [],
            estimatedCost,
            difficulty:
              recommendedTool.technical_difficulty,
            isFree: recommendedTool.free_plan_available,
            requiresApi: task.requiresApi,
            requiresWebhook: task.requiresWebhook,
            privacyNotes:
              recommendedTool.data_retention_notes ||
              'Standard security terms apply.',
            alternatives
          });

          previousToolSlug = recommendedTool.slug;
        }

        const difficultyLabels = [
          'Non-technical',
          'Beginner',
          'Intermediate',
          'Developer'
        ] as const;

        const finalDifficulty =
          difficultyLabels[maximumDifficultyScore - 1] ||
          'Beginner';

        const stepsSummary = workflowSteps
          .map(
            (step) =>
              `Step ${step.order}, ID "${step.id}": "${step.title}" using "${step.toolName}" (${step.toolSlug}). Input: ${step.input}. Output: ${step.output}.`
          )
          .join('\n');

        const call2System =
          'You are a senior automation consultant. Return only valid JSON. Explain the supplied canonical workflow without changing, deleting, merging, renaming, or reordering its steps.';

        const call2Prompt = `Write actionable setup instructions for this locked workflow.

Original goal:
${goal}

Skill: ${skill}
Budget: ${budget}
Human approval required: ${extracted.humanApprovalRequired}
Locked step count: ${workflowSteps.length}

LOCKED STEPS:
${stepsSummary}

RULES:
1. Return exactly ${workflowSteps.length} explanation objects.
2. Use the exact taskId shown for each step.
3. Do not add, remove, merge, rename, or reorder steps.
4. For an approval step, explain an Approved/Rejected/Needs changes status.
5. For publishing, explicitly block execution unless approval is Approved.
6. Do not claim a free plan provides paid-only API features.
7. Return JSON only.

Use this exact structure:
{
  "summary": "One sentence summary",
  "outcome": "Outcome",
  "assumptions": [],
  "steps": [
    {
      "taskId": "Exact locked step ID",
      "stepTitle": "Exact locked step title",
      "explanation": "Why this tool fits",
      "setupInstructions": [
        "Action 1",
        "Action 2"
      ],
      "humanAction": null,
      "expectedOutput": "Specific success indicator",
      "limitationNotes": []
    }
  ],
  "overallSetupInstructions": [],
  "privacyWarnings": [],
  "riskWarnings": [],
  "optimisationSuggestions": []
}`;

        let explanation: any = {};

        try {
          console.log(
            '[Workflow Gen Route] Call 2: Explaining locked workflow steps...'
          );

          const call2Text = await withTimeout(
            generateOpenRouterCompletion(
              call2Prompt,
              call2System,
              true
            ),
            15000,
            'Workflow explanation request'
          );

          const cleanedCall2 = call2Text
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();

          explanation = JSON.parse(cleanedCall2);
        } catch (error: any) {
          console.warn(
            '[Workflow Gen Route] Call 2 failed. Using deterministic instructions:',
            error.message
          );
        }

        const explanationSteps = Array.isArray(
          explanation?.steps
        )
          ? explanation.steps
          : [];

        const finalSteps = workflowSteps.map((step) => {
          const matchingExplanation =
            explanationSteps.find(
              (candidate: any) =>
                candidate.taskId === step.id
            ) ||
            explanationSteps.find(
              (candidate: any) =>
                candidate.stepTitle &&
                candidate.stepTitle
                  .toLowerCase()
                  .trim() ===
                  step.title.toLowerCase().trim()
            );

          if (matchingExplanation) {
            step.setupInstructions = toStringArray(
              matchingExplanation.setupInstructions,
              []
            );
            step.expectedOutput =
              matchingExplanation.expectedOutput ||
              'A verified completion status.';

            if (
              matchingExplanation.humanAction &&
              !step.humanAction
            ) {
              step.humanAction =
                matchingExplanation.humanAction;
            }

            const explanationLimitations =
              toStringArray(
                matchingExplanation.limitationNotes,
                []
              );

            step.limitationNotes = uniqueStrings([
              ...step.limitationNotes,
              ...explanationLimitations
            ]);
          }

          if (step.setupInstructions.length === 0) {
            step.setupInstructions = [
              `Create or open your ${step.toolName} account.`,
              `Configure this step to receive: ${step.input}.`,
              `Test until it produces: ${step.output}.`
            ];
          }

          if (!step.expectedOutput) {
            step.expectedOutput =
              'A verified completion status.';
          }

          return step;
        });

        const costCurrency =
          costCurrencies.size === 1
            ? [...costCurrencies][0]
            : costCurrencies.size > 1
              ? 'MIXED'
              : extracted.budget.currency || 'INR';

        const finalWorkflow: Workflow = {
          id: `wf-${Date.now()}-${slugify(
            extracted.workflowTitle
          )}`,
          title: extracted.workflowTitle,
          description:
            explanation?.summary ||
            `A faithful workflow for: ${goal}`,
          category:
            extracted.category ||
            inferCategoryFromGoal(goal),
          difficulty: finalDifficulty,
          automationLevel:
            extracted.automationLevel === 'fully_automated'
              ? 'Fully automated'
              : extracted.automationLevel ===
                  'mostly_automated'
                ? 'Mostly automated'
                : extracted.automationLevel === 'manual'
                  ? 'Manual'
                  : 'Semi-automated',
          estimatedCostMin: freeToolsOnly
            ? 0
            : Math.round(requiredPaidMinimum),
          estimatedCostMax: freeToolsOnly
            ? 0
            : Math.round(optionalPaidMaximum),
          currency: costCurrency,
          setupTimeEstimate:
            extracted.technicalSkill === 'developer'
              ? '25 minutes'
              : '45 minutes',
          humanApprovalRequired:
            extracted.humanApprovalRequired,
          privacyRisk:
            extracted.dataSensitivity ===
              'highly_sensitive' ||
            extracted.dataSensitivity === 'financial'
              ? 'High'
              : extracted.dataSensitivity === 'personal'
                ? 'Medium'
                : 'Low',
          steps: finalSteps,
          overallInstructions:
            toStringArray(
              explanation?.overallSetupInstructions,
              []
            ).length > 0
              ? toStringArray(
                  explanation?.overallSetupInstructions,
                  []
                )
              : [
                  'Create the required tool accounts.',
                  'Connect and test each step using sample data.',
                  extracted.humanApprovalRequired
                    ? 'Verify publishing remains blocked until the approval status is Approved.'
                    : 'Run an end-to-end test before enabling the schedule.'
                ],
          privacyWarnings: toStringArray(
            explanation?.privacyWarnings,
            []
          ),
          riskWarnings: uniqueStrings([
            ...toStringArray(
              explanation?.riskWarnings,
              []
            ),
            ...(extracted.humanApprovalRequired
              ? [
                  'Publishing must remain blocked until the human approval step returns Approved.'
                ]
              : [])
          ]),
          optimisationSuggestions: toStringArray(
            explanation?.optimisationSuggestions,
            []
          ),
          requirementsSummary:
            extracted.goalSummary || goal,
          costNotes:
            costCurrency === 'MIXED'
              ? 'Tool prices use multiple currencies and were not converted.'
              : 'Minimum reflects required paid plans; maximum includes optional paid upgrades.',
          preferences: {
            budget,
            skill,
            automation,
            freeToolsOnly
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const validationError = validateFinalWorkflow(
          finalWorkflow,
          explicitGoalSteps.length,
          extracted.humanApprovalRequired
        );

        if (validationError) {
          console.error(
            '[Workflow Final Response Error]',
            validationError
          );

          return NextResponse.json(
            {
              success: false,
              error: validationError
            },
            { status: 500 }
          );
        }

        console.info('[Workflow Final Response]', {
          stepCount: finalWorkflow.steps.length,
          expectedDetectedActionCount:
            explicitGoalSteps.length,
          humanApprovalRequired:
            finalWorkflow.humanApprovalRequired,
          approvalStepCount:
            finalWorkflow.steps.filter(
              workflowStepIsApproval
            ).length
        });

        return NextResponse.json(finalWorkflow);
      } catch (error: any) {
        console.error(
          '[Workflow Route] OpenRouter generation failed, falling back:',
          error.message
        );
      }
    }

    console.log(
      '[Workflow Route] Serving fallback template workflow...'
    );

    if (!selectedTemplate) {
      const category = inferCategoryFromGoal(goal);
      const matchingTools = toolsCatalogue.filter(
        (tool) =>
          tool.category === category ||
          tool.subcategories.includes(category)
      );

      const toolsToUse =
        matchingTools.length >= 3
          ? matchingTools.slice(0, 3)
          : [
              toolsCatalogue[0],
              toolsCatalogue[5],
              toolsCatalogue[12]
            ].filter(Boolean);

      const steps: WorkflowStep[] = toolsToUse.map(
        (tool, index) => ({
          id: `step-${index + 1}`,
          order: index + 1,
          title:
            index === 0
              ? 'Initial Data Query & Collection'
              : index === 1
                ? 'Automated Processing & Filtering'
                : 'Dispatch & Review Queue',
          purpose:
            index === 0
              ? `Retrieve target information using ${tool.name}.`
              : index === 1
                ? `Process the payload using ${tool.name}.`
                : `Send results downstream using ${tool.name}.`,
          toolId: tool.id,
          toolSlug: tool.slug,
          toolName: tool.name,
          toolLogo: tool.logo_url,
          toolCategory: tool.category,
          whySelected: `Fallback choice from the ${tool.category} catalogue.`,
          input:
            index === 0
              ? 'Target search terms'
              : 'Previous step output',
          output:
            index === 2
              ? 'Reviewable final result'
              : 'Processed result',
          setupInstructions: [
            `Create an account on ${tool.name}.`,
            'Configure the input mapping.',
            'Test this step with sample data.'
          ],
          expectedOutput:
            'Successful task transition status.',
          humanAction:
            index === 2
              ? 'Review the final result before acting.'
              : null,
          limitationNotes:
            tool.not_recommended_for
              ? [tool.not_recommended_for]
              : [],
          estimatedCost: tool.free_plan_available
            ? 'Free plan available'
            : `${tool.pricing_currency} ${
                tool.starting_monthly_price || 0
              }/mo`,
          difficulty: tool.technical_difficulty,
          isFree: tool.free_plan_available,
          requiresApi: true,
          requiresWebhook: false,
          privacyNotes:
            tool.data_retention_notes ||
            'Standard SaaS terms apply.',
          alternatives: []
        })
      );

      selectedTemplate = {
        id: `wf-custom-${Date.now()}`,
        title: `${
          goal.length > 40
            ? `${goal.slice(0, 40)}...`
            : goal
        } Automation`,
        description: `Fallback workflow for: "${goal}".`,
        category,
        difficulty: 'Beginner',
        automationLevel: 'Mostly automated',
        estimatedCostMin: 0,
        estimatedCostMax: freeToolsOnly ? 0 : 1000,
        currency: 'INR',
        setupTimeEstimate: '35 minutes',
        humanApprovalRequired: true,
        privacyRisk: 'Medium',
        steps,
        overallInstructions: [
          `Create accounts for: ${steps
            .map((step) => step.toolName)
            .join(', ')}.`,
          'Connect variables through Make.com or another integration service.',
          'Test with dummy data before enabling live execution.'
        ],
        privacyWarnings: [
          'Never place secret tokens in public prompts.'
        ],
        riskWarnings: [
          'Quota limits may pause the workflow.'
        ],
        optimisationSuggestions: [
          'Use a reviewable data store before irreversible actions.'
        ],
        requirementsSummary: goal,
        preferences: {
          budget,
          skill,
          automation,
          freeToolsOnly
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (freeToolsOnly && selectedTemplate) {
      selectedTemplate.estimatedCostMin = 0;
      selectedTemplate.estimatedCostMax = 0;
      selectedTemplate.steps = selectedTemplate.steps.map(
        (step) => ({
          ...step,
          estimatedCost: 'Free plan available',
          isFree: true
        })
      );
    }

    if (
      !selectedTemplate ||
      !Array.isArray(selectedTemplate.steps) ||
      selectedTemplate.steps.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow generation returned no steps'
        },
        { status: 500 }
      );
    }

    selectedTemplate.requirementsSummary = goal;

    console.info('[Workflow Final Response]', {
      stepCount: selectedTemplate.steps.length,
      fallback: true
    });

    return NextResponse.json(selectedTemplate);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
