/**
 * Workflow Quality Engine V1
 *
 * Central source of truth for:
 * - task-role detection
 * - allowed and forbidden tool roles
 * - composite tasks that require multiple tools
 *
 * This module is intentionally independent from the UI and database.
 */

export type TaskRole =
  | 'research'
  | 'collect'
  | 'filter'
  | 'deduplicate'
  | 'score'
  | 'summarize'
  | 'write'
  | 'design'
  | 'store'
  | 'approve'
  | 'schedule'
  | 'publish'
  | 'notify'
  | 'orchestrate';

export interface TaskDescriptor {
  title?: string;
  purpose?: string;
  requiredCapabilities?: string[];
  preferredToolCategories?: string[];
}

export interface ToolDescriptor {
  id?: string;
  slug: string;
  name?: string;
  category?: string;
  capabilities?: string[];
}

export interface RolePolicy {
  role: TaskRole;
  keywords: string[];
  preferredToolSlugs: string[];
  forbiddenToolSlugs: string[];
  acceptedCapabilities: string[];
  preferredCategories: string[];
  humanDecisionRequired?: boolean;
}

export interface ToolRoleEvaluation {
  role: TaskRole;
  eligible: boolean;
  preferred: boolean;
  hardRejected: boolean;
  score: number;
  reasons: string[];
}

const normalise = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const textIncludesKeyword = (text: string, keyword: string): boolean =>
  text.includes(keyword.toLowerCase());

const ROLE_POLICIES: Record<TaskRole, RolePolicy> = {
  research: {
    role: 'research',
    keywords: [
      'research',
      'search',
      'discover',
      'find information',
      'find sources',
      'latest news',
      'news research',
      'web search',
      'browse',
      'fact-check',
      'fact check',
      'verify claims',
      'verify key statements',
      'verify statements',
      'original sources',
      'source verification'
    ],
    preferredToolSlugs: [
      'perplexity',
      'google-search-api',
      'google-search',
      'chatgpt',
      'gemini',
      'claude'
    ],
    forbiddenToolSlugs: [
      'canva',
      'buffer',
      'gmail',
      'slack'
    ],
    acceptedCapabilities: [
      'web_search',
      'web_browsing',
      'news_fetching',
      'text_synthesis',
      'source_discovery',
      'source_verification',
      'citation_checking',
      'fact_checking'
    ],
    preferredCategories: ['research']
  },

  collect: {
    role: 'collect',
    keywords: [
      'collect',
      'fetch',
      'gather',
      'monitor',
      'watch',
      'rss',
      'feed',
      'scrape',
      'retrieve'
    ],
    preferredToolSlugs: [
      'feedly',
      'make',
      'n8n',
      'zapier',
      'pipedream',
      'perplexity'
    ],
    forbiddenToolSlugs: [
      'canva',
      'buffer'
    ],
    acceptedCapabilities: [
      'rss_feed',
      'article_monitoring',
      'newsletter_tracking',
      'web_search',
      'web_scraping',
      'automation_triggers'
    ],
    preferredCategories: ['research', 'productivity', 'development']
  },

  filter: {
    role: 'filter',
    keywords: [
      'filter',
      'remove low-quality',
      'remove irrelevant',
      'quality check',
      'clean',
      'exclude',
      'validate'
    ],
    preferredToolSlugs: [
      'make',
      'n8n',
      'zapier',
      'pipedream',
      'airtable',
      'google-sheets'
    ],
    forbiddenToolSlugs: [
      'canva',
      'buffer',
      'gmail',
      'slack'
    ],
    acceptedCapabilities: [
      'conditional_routing',
      'conditional_logic',
      'data_mapping',
      'view_filtering',
      'code_execution',
      'data_analysis'
    ],
    preferredCategories: ['productivity', 'development']
  },

  deduplicate: {
    role: 'deduplicate',
    keywords: [
      'deduplicate',
      'de-duplicate',
      'remove duplicates',
      'duplicate',
      'repeated stories',
      'repeated items'
    ],
    preferredToolSlugs: [
      'make',
      'n8n',
      'zapier',
      'pipedream',
      'airtable',
      'google-sheets'
    ],
    forbiddenToolSlugs: [
      'canva',
      'buffer',
      'gmail',
      'slack'
    ],
    acceptedCapabilities: [
      'conditional_routing',
      'conditional_logic',
      'data_mapping',
      'data_storage',
      'code_execution'
    ],
    preferredCategories: ['productivity', 'development']
  },

  score: {
    role: 'score',
    keywords: [
      'score',
      'rank',
      'prioritize',
      'prioritise',
      'select top',
      'choose best',
      'evaluate importance',
      'rate'
    ],
    preferredToolSlugs: [
      'chatgpt',
      'gemini',
      'claude',
      'openrouter',
      'perplexity'
    ],
    forbiddenToolSlugs: [
      'canva',
      'buffer',
      'gmail',
      'slack'
    ],
    acceptedCapabilities: [
      'reasoning',
      'data_analysis',
      'structured_json_output',
      'text_generation',
      'classification'
    ],
    preferredCategories: ['research']
  },

  summarize: {
    role: 'summarize',
    keywords: [
      'summarize',
      'summarise',
      'summary',
      'synthesize',
      'synthesise',
      'key points',
      'condense'
    ],
    preferredToolSlugs: [
      'chatgpt',
      'gemini',
      'claude',
      'openrouter',
      'perplexity'
    ],
    forbiddenToolSlugs: [
      'canva',
      'recraft',
      'buffer',
      'gmail',
      'slack',
      'airtable',
      'google-sheets'
    ],
    acceptedCapabilities: [
      'text_generation',
      'text_synthesis',
      'document_analysis',
      'long_context',
      'reasoning'
    ],
    preferredCategories: ['research']
  },

  write: {
    role: 'write',
    keywords: [
      'write',
      'draft',
      'rewrite',
      'copy',
      'caption',
      'linkedin post',
      'carousel outline',
      'script',
      'hook',
      'headline',
      'email body'
    ],
    preferredToolSlugs: [
      'chatgpt',
      'gemini',
      'claude',
      'openrouter'
    ],
    forbiddenToolSlugs: [
      'canva',
      'recraft',
      'buffer',
      'gmail',
      'slack',
      'airtable',
      'google-sheets'
    ],
    acceptedCapabilities: [
      'text_generation',
      'long_context',
      'reasoning',
      'structured_json_output'
    ],
    preferredCategories: ['research']
  },

  design: {
    role: 'design',
    keywords: [
      'design',
      'visual',
      'graphic',
      'image',
      'carousel slides',
      'create carousel',
      'presentation',
      'layout',
      'illustration'
    ],
    preferredToolSlugs: [
      'canva',
      'recraft'
    ],
    forbiddenToolSlugs: [
      'buffer',
      'gmail',
      'slack',
      'airtable',
      'google-sheets'
    ],
    acceptedCapabilities: [
      'image_generation',
      'image_editing',
      'presentation_creation',
      'vector_generation',
      'style_control',
      'visual_design'
    ],
    preferredCategories: ['content_creation']
  },

  store: {
    role: 'store',
    keywords: [
      'save',
      'store',
      'record',
      'database',
      'spreadsheet',
      'archive',
      'log results',
      'content calendar'
    ],
    preferredToolSlugs: [
      'airtable',
      'google-sheets',
      'notion',
      'supabase'
    ],
    forbiddenToolSlugs: [
      'canva',
      'buffer'
    ],
    acceptedCapabilities: [
      'data_storage',
      'relational_data',
      'csv_export',
      'view_filtering',
      'real_time_collaboration'
    ],
    preferredCategories: ['productivity', 'development']
  },

  approve: {
    role: 'approve',
    keywords: [
      'approve',
      'approval',
      'human review',
      'manual review',
      'review before publishing',
      'sign off',
      'sign-off',
      'verification gate'
    ],
    preferredToolSlugs: [
      'airtable',
      'notion',
      'google-sheets',
      'slack',
      'gmail'
    ],
    forbiddenToolSlugs: [
      'chatgpt',
      'gemini',
      'claude',
      'openrouter',
      'perplexity',
      'canva',
      'recraft',
      'buffer'
    ],
    acceptedCapabilities: [
      'data_storage',
      'form_input',
      'view_filtering',
      'interactive_buttons',
      'team_messaging',
      'email_sending',
      'real_time_collaboration'
    ],
    preferredCategories: ['productivity'],
    humanDecisionRequired: true
  },

  schedule: {
    role: 'schedule',
    keywords: [
      'schedule',
      'queue post',
      'publishing calendar',
      'set publish time',
      'post later'
    ],
    preferredToolSlugs: [
      'buffer',
      'make',
      'n8n',
      'zapier'
    ],
    forbiddenToolSlugs: [
      'canva',
      'recraft',
      'gmail',
      'slack'
    ],
    acceptedCapabilities: [
      'post_scheduling',
      'automation_triggers',
      'conditional_routing'
    ],
    preferredCategories: ['marketing', 'productivity']
  },

  publish: {
    role: 'publish',
    keywords: [
      'publish',
      'post to linkedin',
      'post on linkedin',
      'social publishing',
      'send live',
      'auto-publish'
    ],
    preferredToolSlugs: [
      'buffer'
    ],
    forbiddenToolSlugs: [
      'canva',
      'recraft',
      'gmail',
      'slack',
      'airtable',
      'google-sheets'
    ],
    acceptedCapabilities: [
      'social_publishing',
      'post_scheduling',
      'performance_analytics'
    ],
    preferredCategories: ['marketing']
  },

  notify: {
    role: 'notify',
    keywords: [
      'notify',
      'notification',
      'alert',
      'send email',
      'message team',
      'slack message'
    ],
    preferredToolSlugs: [
      'gmail',
      'slack',
      'make',
      'n8n',
      'zapier'
    ],
    forbiddenToolSlugs: [
      'canva',
      'recraft',
      'buffer'
    ],
    acceptedCapabilities: [
      'email_sending',
      'channel_alerts',
      'team_messaging',
      'webhook_handling'
    ],
    preferredCategories: ['productivity']
  },

  orchestrate: {
    role: 'orchestrate',
    keywords: [
      'automate',
      'connect',
      'integrate',
      'orchestrate',
      'route',
      'trigger',
      'webhook',
      'map data'
    ],
    preferredToolSlugs: [
      'make',
      'n8n',
      'zapier',
      'pipedream'
    ],
    forbiddenToolSlugs: [
      'canva',
      'recraft',
      'buffer'
    ],
    acceptedCapabilities: [
      'webhook_handling',
      'api_integration',
      'conditional_routing',
      'data_mapping',
      'automation_triggers',
      'code_execution'
    ],
    preferredCategories: ['productivity', 'development']
  }
};

const ROLE_PRIORITY: TaskRole[] = [
  'approve',
  'publish',
  'schedule',
  'design',
  'summarize',
  'score',
  'deduplicate',
  'filter',
  'write',
  'collect',
  'research',
  'store',
  'notify',
  'orchestrate'
];

export const getRolePolicy = (role: TaskRole): RolePolicy =>
  ROLE_POLICIES[role];

export const getAllRolePolicies = (): RolePolicy[] =>
  Object.values(ROLE_POLICIES);

export function inferTaskRoles(task: TaskDescriptor): TaskRole[] {
  const text = [
    task.title || '',
    task.purpose || '',
    ...(task.requiredCapabilities || []),
    ...(task.preferredToolCategories || [])
  ]
    .join(' ')
    .toLowerCase();

  const detected = new Set<TaskRole>();

  for (const role of ROLE_PRIORITY) {
    const policy = ROLE_POLICIES[role];

    if (
      policy.keywords.some((keyword) =>
        textIncludesKeyword(text, keyword)
      )
    ) {
      detected.add(role);
    }
  }

  /*
   * Prevent generic words from creating misleading extra roles.
   * Examples:
   * - "approved content" is not itself an approval step.
   * - "carousel outline" is writing, not visual design.
   */
  const isExplicitApproval =
    /\b(human|manual)\s+(review|approval)\b/i.test(text) ||
    /\brequires?\s+(human|manual)\s+approval\b/i.test(text) ||
    /\bapproval\s+(gate|step|workflow)\b/i.test(text);

  if (!isExplicitApproval) {
    detected.delete('approve');
  }

  const isVisualDesign =
    /\b(design|visual|graphic|image|slides?|layout|illustration)\b/i.test(
      text
    );

  if (!isVisualDesign && /\bcarousel outline\b/i.test(text)) {
    detected.delete('design');
    detected.add('write');
  }

  if (detected.size === 0) {
    // A neutral fallback is orchestration rather than guessing a creative tool.
    detected.add('orchestrate');
  }

  return ROLE_PRIORITY.filter((role) => detected.has(role));
}

export function evaluateToolForRole(
  tool: ToolDescriptor,
  role: TaskRole
): ToolRoleEvaluation {
  const policy = ROLE_POLICIES[role];
  const slug = normalise(tool.slug);
  const capabilities = (tool.capabilities || []).map(normalise);
  const category = normalise(tool.category || '');

  const preferred = policy.preferredToolSlugs
    .map(normalise)
    .includes(slug);

  const forbidden = policy.forbiddenToolSlugs
    .map(normalise)
    .includes(slug);

  const matchedCapabilities = policy.acceptedCapabilities.filter(
    (capability) => capabilities.includes(normalise(capability))
  );

  const categoryMatch = policy.preferredCategories
    .map(normalise)
    .includes(category);

  const reasons: string[] = [];

  if (forbidden) {
    reasons.push(
      `${tool.name || tool.slug} is explicitly forbidden for the ${role} role.`
    );

    return {
      role,
      eligible: false,
      preferred: false,
      hardRejected: true,
      score: -100,
      reasons
    };
  }

  if (preferred) {
    reasons.push(
      `${tool.name || tool.slug} is a preferred tool for the ${role} role.`
    );
  }

  if (matchedCapabilities.length > 0) {
    reasons.push(
      `Matching capabilities: ${matchedCapabilities.join(', ')}.`
    );
  }

  if (categoryMatch) {
    reasons.push(
      `Category ${tool.category} supports the ${role} role.`
    );
  }

  const eligible = preferred || matchedCapabilities.length > 0;

  let score = 0;
  if (preferred) score += 60;
  score += Math.min(30, matchedCapabilities.length * 10);
  if (categoryMatch) score += 10;

  if (!eligible) {
    reasons.push(
      `No verified capability or preferred-tool match for ${role}.`
    );
  }

  return {
    role,
    eligible,
    preferred,
    hardRejected: false,
    score,
    reasons
  };
}

export function evaluateToolForTask(
  tool: ToolDescriptor,
  task: TaskDescriptor
): ToolRoleEvaluation[] {
  return inferTaskRoles(task).map((role) =>
    evaluateToolForRole(tool, role)
  );
}

export function getPreferredToolSlugsForRole(
  role: TaskRole
): string[] {
  return [...ROLE_POLICIES[role].preferredToolSlugs];
}

export function isHumanDecisionRole(role: TaskRole): boolean {
  return ROLE_POLICIES[role].humanDecisionRequired === true;
}

type ToolFamily =
  | 'ai_text'
  | 'automation'
  | 'design'
  | 'approval_tracking'
  | 'publishing'
  | 'research'
  | 'storage'
  | 'communication';

const ROLE_FAMILY: Record<TaskRole, ToolFamily> = {
  research: 'research',
  collect: 'research',
  filter: 'automation',
  deduplicate: 'automation',
  score: 'ai_text',
  summarize: 'ai_text',
  write: 'ai_text',
  design: 'design',
  store: 'storage',
  approve: 'approval_tracking',
  schedule: 'publishing',
  publish: 'publishing',
  notify: 'communication',
  orchestrate: 'automation'
};

export function getRoleFamily(role: TaskRole): ToolFamily {
  return ROLE_FAMILY[role];
}

export function taskRequiresMultipleToolFamilies(
  task: TaskDescriptor
): boolean {
  const families = new Set(
    inferTaskRoles(task).map(getRoleFamily)
  );

  return families.size > 1;
}

export function groupRolesByToolFamily(
  roles: TaskRole[]
): Array<{ family: ToolFamily; roles: TaskRole[] }> {
  const groups = new Map<ToolFamily, TaskRole[]>();

  for (const role of roles) {
    const family = getRoleFamily(role);
    const existing = groups.get(family) || [];
    existing.push(role);
    groups.set(family, existing);
  }

  return Array.from(groups.entries()).map(([family, familyRoles]) => ({
    family,
    roles: familyRoles
  }));
}
