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
  | 'email_source'
  | 'extract'
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
  /^\s*(?:post|publish|schedule|queue)\b.*\b(?:linkedin|social|content|blog|tweet|video|carousel)\b/i;

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

function normalizeApprovalAction(value: string): string {
  const cleaned = cleanTaskSentence(value)
    .replace(/^(?:to\s+)?/i, '')
    .replace(/^sending\b/i, 'Send')
    .replace(/^posting\b/i, 'Post')
    .replace(/^publishing\b/i, 'Publish')
    .replace(/^scheduling\b/i, 'Schedule')
    .replace(/^reminding\b/i, 'Remind')
    .trim();

  if (!cleaned) return 'Run the final action';

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

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

    // One phrase often hides two jobs: detect urgency, then send the alert.
    if (
      /\b(alerts?|notifies?|notify|sends?|send)\b/i.test(low) &&
      /\b(urgent|critical|high priority|emergency)\b/i.test(low)
    ) {
      expanded.push('Detect urgent or critical problems');
      expanded.push('Send an alert about urgent or critical problems');
      continue;
    }

    // "Send me a weekly summary" means create the summary, then deliver it.
    const deliveredSummaryMatch = clause.match(
      /\b(?:sends?|emails?)\s+(?:me|the user|us)?\s*(?:a|an|the)?\s*([^,;]*(?:summary|report|digest)[^,;]*)/i
    );

    if (deliveredSummaryMatch) {
      const summaryObject = cleanTaskSentence(deliveredSummaryMatch[1]) || 'summary';
      expanded.push(`Create the ${summaryObject}`);
      expanded.push(`Send the ${summaryObject} to the user`);
      continue;
    }

    // Preserve the actual action that must happen after approval.
    if (APPROVAL_PATTERN.test(low)) {
      const afterApprovalMatch = clause.match(/\bbefore\s+(.+)$/i);

      if (afterApprovalMatch) {
        const finalAction = normalizeApprovalAction(afterApprovalMatch[1]);
        expanded.push(`Request human approval before ${afterApprovalMatch[1]}`);
        expanded.push(`${finalAction} only after approval`);
        continue;
      }
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

function normalizeIntentText(text: string): string {
  return text
    .toLowerCase()
    .replace(/^\s*(checks?)\b/, 'check')
    .replace(/^\s*(collects?)\b/, 'collect')
    .replace(/^\s*(fetches?)\b/, 'fetch')
    .replace(/^\s*(retrieves?)\b/, 'retrieve')
    .replace(/^\s*(pulls?)\b/, 'pull')
    .replace(/^\s*(gets?)\b/, 'get')
    .replace(/^\s*(finds?)\b/, 'find')
    .replace(/^\s*(identifies?)\b/, 'identify')
    .replace(/^\s*(analy[sz]es?)\b/, 'analyze')
    .replace(/^\s*(classifies?)\b/, 'classify')
    .replace(/^\s*(filters?)\b/, 'filter')
    .replace(/^\s*(removes?)\b/, 'remove')
    .replace(/^\s*(scores?)\b/, 'score')
    .replace(/^\s*(ranks?)\b/, 'rank')
    .replace(/^\s*(selects?)\b/, 'select')
    .replace(/^\s*(summari[sz]es?)\b/, 'summarize')
    .replace(/^\s*(drafts?)\b/, 'draft')
    .replace(/^\s*(writes?)\b/, 'write')
    .replace(/^\s*(creates?)\b/, 'create')
    .replace(/^\s*(generates?)\b/, 'generate')
    .replace(/^\s*(designs?)\b/, 'design')
    .replace(/^\s*(alerts?)\b/, 'alert')
    .replace(/^\s*(notifies?)\b/, 'notify')
    .replace(/^\s*(sends?)\b/, 'send')
    .replace(/^\s*(asks?)\b/, 'ask')
    .replace(/^\s*(requests?)\b/, 'request')
    .replace(/^\s*(reviews?)\b/, 'review')
    .replace(/^\s*(approves?)\b/, 'approve')
    .replace(/^\s*(posts?)\b/, 'post')
    .replace(/^\s*(publishes?)\b/, 'publish')
    .replace(/^\s*(schedules?)\b/, 'schedule')
    .replace(/^\s*(stores?)\b/, 'store')
    .replace(/^\s*(tracks?)\b/, 'track')
    .replace(/^\s*(flags?)\b/, 'flag')
    .replace(/^\s*(detects?)\b/, 'detect')
    .replace(/^\s*(monitors?)\b/, 'monitor')
    .replace(/^\s*(tailors?)\b/, 'tailor')
    .replace(/^\s*(reminds?)\b/, 'remind')
    .replace(/^\s*(extracts?)\b/, 'extract')
    .trim();
}

function inferTaskKind(text: string): TaskKind {
  const low = normalizeIntentText(text);

  if (APPROVAL_PATTERN.test(low)) return 'approval';

  if (
    /^\s*(?:check|collect|fetch|retrieve|pull|get|monitor|read)\b.*\b(email|emails|inbox|gmail|outlook|attachment)\b/i.test(low) ||
    /\b(email|emails|inbox|gmail|outlook|attachment)\b.*\b(?:check|collect|fetch|retrieve|pull|get|monitor|read)\b/i.test(low)
  ) {
    return 'email_source';
  }

  if (
    /^\s*(?:extract|parse|capture|read|pull)\b.*\b(details?|fields?|data|invoice|document|pdf|receipt|attachment|form|image)\b/i.test(low) ||
    /\b(ocr|document extraction|invoice extraction|structured fields?)\b/i.test(low)
  ) {
    return 'extract';
  }

  if (
    /^\s*(?:check|collect|fetch|retrieve|monitor|sync)\b.*\b(reviews?|feedback|linkedin|crm|salesforce|hubspot|shopify|stripe|tickets?|orders?|leads?|applications?|forms?|calendar)\b/i.test(low)
  ) {
    return 'automate';
  }

  if (
    /^\s*(?:send|alert|notify|remind|email|message|deliver)\b/i.test(low) ||
    /\b(alert|notification|reminder)\b/i.test(low)
  ) {
    return 'notify';
  }

  if (
    /^\s*(?:draft|write|rewrite|tailor|personalize|caption|create copy|generate copy)\b/i.test(low) ||
    /\b(cover letter|resume|reply draft|response draft|outreach email)\b/i.test(low)
  ) {
    return 'write';
  }

  if (PUBLISH_PATTERN.test(low)) return 'publish';

  if (
    /^\s*(?:post|publish|send|submit|apply|update|create|sync|upload)\b.*\b(approved|original platform|review|reply|response|application|record|crm|ticket|form)\b/i.test(low) ||
    /\b(approved|original platform|review|reply|response|application|record|crm|ticket|form)\b.*\b(?:post|publish|send|submit|apply|update|create|sync|upload)\b/i.test(low)
  ) {
    return 'automate';
  }

  if (/^\s*(?:design|render|layout)\b|\b(graphic|image|illustration|slides?|carousel|presentation|thumbnail)\b/i.test(low)) {
    return 'design';
  }

  if (/^\s*(?:summarize|synthesize|create)\b.*\b(summary|digest|report|key points)\b|^\s*summarize\b/i.test(low)) {
    return 'summarize';
  }

  if (
    /^\s*(?:search|research|discover|find|monitor|collect|fetch|scrape|source)\b.*\b(news|articles?|web|website|jobs?|companies|market|trends?|sources?|rss)\b/i.test(low)
  ) {
    return 'research';
  }

  if (
    /^\s*(?:analyze|identify|find|detect|flag|score|rank|select|prioritize|evaluate|assess|classify|compare|verify|fact-check)\b/i.test(low) ||
    /\b(themes?|sentiment|complaints?|overdue|urgent|critical|quality|duplicates?)\b/i.test(low)
  ) {
    return 'analyze';
  }

  if (/^\s*(?:filter|deduplicate|remove|clean|validate|moderate)\b/i.test(low)) {
    return 'filter';
  }

  if (/^\s*(?:save|store|log|archive|record|track)\b|\b(database|spreadsheet|crm|table)\b/i.test(low)) {
    return 'store';
  }

  if (/^\s*(?:connect|integrate|automate|trigger|route|orchestrate|map|collect|fetch|monitor|check|sync|schedule)\b/i.test(low)) {
    return 'automate';
  }

  return 'general';
}

function preferredToolSlugsForTask(task: CanonicalTask): string[] {
  const text = `${task.title} ${task.purpose}`.toLowerCase();
  const kind = inferTaskKind(text);

  switch (kind) {
    case 'email_source':
      return ['gmail', 'outlook', 'make', 'n8n', 'zapier'];
    case 'extract':
      return ['gemini', 'chatgpt', 'claude', 'openrouter'];
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
      if (/slack/i.test(text)) return ['slack', 'gmail', 'make', 'n8n'];
      if (/(email|gmail|invoice|payment|reminder|candidate|customer|weekly summary|report)/i.test(text)) {
        return ['gmail', 'slack', 'make', 'n8n', 'zapier'];
      }
      return ['gmail', 'slack', 'make', 'n8n', 'zapier'];
    case 'publish':
      return ['buffer', 'make', 'n8n'];
    case 'design':
      return ['canva', 'recraft'];
    case 'filter':
      return ['make', 'n8n', 'zapier', 'pipedream', 'gemini', 'chatgpt'];
    case 'research':
      if (/(rss|news|article|newsletter)/i.test(text)) {
        return ['feedly', 'perplexity', 'google-search'];
      }
      return ['perplexity', 'google-search', 'feedly'];
    case 'store':
      return ['airtable', 'google-sheets', 'notion', 'supabase'];
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
    case 'email_source':
      return {
        kind,
        requiredCapabilities: [
          'email_reading',
          'attachment_access',
          'search_filters'
        ],
        preferredToolCategories: ['productivity'],
        requiresApi: true,
        requiresWebhook: true,
        requiresHumanApproval: false,
        defaultInput: ['Mailbox, sender, subject, or attachment filters'],
        defaultOutput: ['Matched emails and attachments']
      };

    case 'extract':
      return {
        kind,
        requiredCapabilities: [
          'document_analysis',
          'ocr',
          'structured_json_output'
        ],
        preferredToolCategories: ['research'],
        requiresApi: true,
        requiresWebhook: false,
        requiresHumanApproval: false,
        defaultInput: ['Document, PDF, image, or attachment'],
        defaultOutput: ['Structured extracted fields']
      };

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

function isPostApprovalTask(task: CanonicalTask): boolean {
  return (
    !isApprovalTask(task) &&
    /\b(only after approval|approved)\b/i.test(
      `${task.title} ${task.purpose}`
    )
  );
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
  const publishIndex = nextTasks.findIndex(
    (task) => isPublishTask(task) || isPostApprovalTask(task)
  );

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

  const currentPublishIndex = nextTasks.findIndex(
    (task) => isPublishTask(task) || isPostApprovalTask(task)
  );

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
        : `${inferCategoryFromGoal(goal).replace(/_/g, ' ')} Workflow`,
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
  const text = `${step.title} ${step.purpose}`;
  return (
    PUBLISH_PATTERN.test(text) ||
    /\b(only after approval|approved)\b/i.test(text)
  );
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
5. Any final sending, posting, publishing, or execution action must occur after approval.
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
          const taskRunsAfterApproval = isPostApprovalTask(task);

          let humanAction: string | null = null;

          if (taskIsApproval) {
            humanAction =
              'Approve, reject, or request changes. The workflow must not continue until the status is Approved.';
          } else if (
            (taskIsPublish || taskRunsAfterApproval) &&
            extracted.humanApprovalRequired
          ) {
            humanAction =
              'Confirm the previous approval status is Approved before running this final action.';
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
5. For the final action, explicitly block execution unless approval is Approved.
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
                    ? 'Verify the final action remains blocked until the approval status is Approved.'
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
                  'The final action must remain blocked until the human approval step returns Approved.'
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
