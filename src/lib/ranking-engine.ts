import {
  Tool,
  ToolScore,
  CompatibilityResult,
  WorkflowRequirements
} from '@/src/types';
import { INITIAL_INTEGRATIONS } from './config/tools-catalogue';

type WorkflowTask = {
  title?: string;
  purpose?: string;
  requiredCapabilities: string[];
  preferredToolCategories: string[];
  inputType?: string[];
  outputType?: string[];
  requiresApi?: boolean;
  requiresWebhook?: boolean;
  requiresHumanApproval?: boolean;
};

type TaskRole =
  | 'research'
  | 'filter'
  | 'summarize'
  | 'write'
  | 'design'
  | 'approval'
  | 'publish'
  | 'store'
  | 'notify'
  | 'automate'
  | 'general';

type RoleRule = {
  keywords: string[];
  capabilities: string[];
  preferredSlugs: string[];
  preferredCategories: string[];
};

const ROLE_RULES: Record<Exclude<TaskRole, 'general'>, RoleRule> = {
  research: {
    keywords: [
      'find',
      'fetch',
      'search',
      'research',
      'discover',
      'collect',
      'monitor',
      'track news',
      'latest news',
      'article',
      'rss',
      'scrape',
      'source'
    ],
    capabilities: [
      'web_search',
      'news_fetching',
      'rss_feed',
      'article_monitoring',
      'newsletter_tracking',
      'link_scraping',
      'web_browsing',
      'text_synthesis'
    ],
    preferredSlugs: ['feedly', 'perplexity', 'google-search'],
    preferredCategories: ['research']
  },

  filter: {
    keywords: [
      'filter',
      'deduplicate',
      'de-duplicate',
      'duplicate',
      'remove repeated',
      'clean',
      'validate',
      'rank',
      'score',
      'classify',
      'quality check',
      'moderate'
    ],
    capabilities: [
      'conditional_routing',
      'conditional_logic',
      'data_mapping',
      'data_analysis',
      'view_filtering',
      'code_execution',
      'structured_json_output',
      'reasoning',
      'text_generation'
    ],
    preferredSlugs: [
      'make',
      'n8n',
      'zapier',
      'pipedream',
      'gemini',
      'claude',
      'chatgpt',
      'airtable',
      'google-sheets'
    ],
    preferredCategories: ['productivity', 'development', 'research']
  },

  summarize: {
    keywords: [
      'summarize',
      'summarise',
      'summary',
      'synthesize',
      'synthesise',
      'extract insights',
      'key points',
      'analyze text',
      'analyse text'
    ],
    capabilities: [
      'text_generation',
      'text_synthesis',
      'document_analysis',
      'data_analysis',
      'structured_json_output',
      'reasoning',
      'long_context'
    ],
    preferredSlugs: ['gemini', 'claude', 'chatgpt', 'openrouter', 'perplexity'],
    preferredCategories: ['research']
  },

  write: {
    keywords: [
      'draft',
      'write',
      'rewrite',
      'caption',
      'copy',
      'post text',
      'email copy',
      'script',
      'outline',
      'headline',
      'hook',
      'description'
    ],
    capabilities: [
      'text_generation',
      'reasoning',
      'structured_json_output',
      'long_context'
    ],
    preferredSlugs: ['gemini', 'claude', 'chatgpt', 'openrouter'],
    preferredCategories: ['research']
  },

  design: {
    keywords: [
      'design',
      'visual',
      'graphic',
      'image',
      'illustration',
      'render',
      'layout',
      'slides',
      'carousel design',
      'create carousel',
      'presentation'
    ],
    capabilities: [
      'image_editing',
      'presentation_creation',
      'video_layout',
      'ai_image_magic',
      'vector_generation',
      'style_control',
      'icon_design',
      'palette_matching',
      'image_generation'
    ],
    preferredSlugs: ['canva', 'recraft'],
    preferredCategories: ['content_creation']
  },

  approval: {
    keywords: [
      'approve',
      'approval',
      'human review',
      'manual review',
      'verification gate',
      'sign off',
      'sign-off',
      'review before'
    ],
    capabilities: [
      'data_storage',
      'relational_data',
      'form_input',
      'view_filtering',
      'real_time_collaboration',
      'automation_triggers',
      'interactive_buttons',
      'team_messaging',
      'email_sending'
    ],
    preferredSlugs: [
      'airtable',
      'google-sheets',
      'notion',
      'slack',
      'gmail'
    ],
    preferredCategories: ['productivity']
  },

  publish: {
    keywords: [
      'publish',
      'schedule',
      'post to linkedin',
      'post to social',
      'social publishing',
      'dispatch post',
      'queue post'
    ],
    capabilities: [
      'post_scheduling',
      'social_publishing',
      'performance_analytics'
    ],
    preferredSlugs: ['buffer'],
    preferredCategories: ['marketing']
  },

  store: {
    keywords: [
      'save',
      'store',
      'log',
      'database',
      'spreadsheet',
      'archive',
      'record',
      'content calendar'
    ],
    capabilities: [
      'data_storage',
      'relational_data',
      'csv_export',
      'real_time_collaboration',
      'view_filtering',
      'form_input'
    ],
    preferredSlugs: ['google-sheets', 'airtable', 'notion', 'supabase'],
    preferredCategories: ['productivity', 'development']
  },

  notify: {
    keywords: [
      'notify',
      'notification',
      'alert',
      'send email',
      'email report',
      'message team',
      'slack message'
    ],
    capabilities: [
      'email_sending',
      'channel_alerts',
      'team_messaging',
      'webhook_handling'
    ],
    preferredSlugs: ['gmail', 'slack', 'make', 'zapier', 'n8n'],
    preferredCategories: ['productivity']
  },

  automate: {
    keywords: [
      'connect',
      'integrate',
      'automation',
      'automate',
      'webhook',
      'trigger',
      'route',
      'orchestrate',
      'map data'
    ],
    capabilities: [
      'webhook_handling',
      'api_integration',
      'conditional_routing',
      'conditional_logic',
      'data_mapping',
      'automation_triggers',
      'code_execution'
    ],
    preferredSlugs: ['make', 'zapier', 'n8n', 'pipedream'],
    preferredCategories: ['productivity', 'development']
  }
};

const normalize = (value: string): string =>
  value.toLowerCase().trim().replace(/[\s-]+/g, '_');

const includesAny = (text: string, values: string[]): boolean =>
  values.some((value) => text.includes(value));

function inferTaskRole(task: WorkflowTask): TaskRole {
  const text = [
    task.title || '',
    task.purpose || '',
    ...(task.requiredCapabilities || []),
    ...(task.preferredToolCategories || [])
  ]
    .join(' ')
    .toLowerCase();

  // Priority matters. "Save and schedule for publishing" must be publishing,
  // while "carousel outline" is writing rather than visual design.
  if (includesAny(text, ROLE_RULES.approval.keywords)) return 'approval';
  if (includesAny(text, ROLE_RULES.publish.keywords)) return 'publish';
  if (includesAny(text, ROLE_RULES.summarize.keywords)) return 'summarize';

  if (
    includesAny(text, ROLE_RULES.write.keywords) &&
    !includesAny(text, [
      'carousel design',
      'design carousel',
      'visual carousel',
      'create graphic',
      'create image'
    ])
  ) {
    return 'write';
  }

  if (includesAny(text, ROLE_RULES.design.keywords)) return 'design';
  if (includesAny(text, ROLE_RULES.filter.keywords)) return 'filter';
  if (includesAny(text, ROLE_RULES.research.keywords)) return 'research';
  if (includesAny(text, ROLE_RULES.notify.keywords)) return 'notify';
  if (includesAny(text, ROLE_RULES.store.keywords)) return 'store';
  if (includesAny(text, ROLE_RULES.automate.keywords)) return 'automate';

  return 'general';
}

function roleFit(tool: Tool, role: TaskRole) {
  if (role === 'general') {
    return {
      eligible: true,
      score: 0,
      reason: ''
    };
  }

  const rule = ROLE_RULES[role];
  const toolCapabilities = new Set(
    (tool.capabilities || []).map((capability) => normalize(capability))
  );

  const capabilityMatches = rule.capabilities.filter((capability) =>
    toolCapabilities.has(normalize(capability))
  );

  const slugMatch = rule.preferredSlugs.includes(tool.slug);
  const categoryMatch = rule.preferredCategories.includes(tool.category);

  const eligible = capabilityMatches.length > 0 || slugMatch;

  let score = 0;
  if (slugMatch) score += 22;
  score += Math.min(18, capabilityMatches.length * 6);
  if (categoryMatch) score += 5;

  return {
    eligible,
    score,
    reason:
      capabilityMatches.length > 0
        ? `Fits the ${role} role through: ${capabilityMatches.join(', ')}`
        : slugMatch
          ? `Purpose-built choice for the ${role} role`
          : ''
  };
}

/**
 * Deterministic Tool-Ranking Engine
 *
 * Key rules:
 * - Missing is_active means active; only explicit false disables a tool.
 * - A tool must be able to perform the task role.
 * - Broad category matches cannot overpower a missing capability.
 * - Visual tools cannot win summarization or writing tasks.
 * - Publishing tools cannot win drafting or design tasks.
 */
export function rankToolsForTask(
  task: WorkflowTask,
  requirements: WorkflowRequirements,
  tools: Tool[],
  previousToolSlug: string | null
): ToolScore[] {
  const role = inferTaskRole(task);

  const activeVerifiedTools = tools.filter(
    (tool) =>
      tool.is_active !== false &&
      tool.verification_status !== 'unverified'
  );

  const roleEligibleTools =
    role === 'general'
      ? activeVerifiedTools
      : activeVerifiedTools.filter((tool) => roleFit(tool, role).eligible);

  // Never return zero candidates merely because catalogue capability labels are
  // incomplete. The scoring below still strongly penalizes weak fallbacks.
  const candidateTools =
    roleEligibleTools.length > 0 ? roleEligibleTools : activeVerifiedTools;

  const normalizedRequiredCapabilities = (
    task.requiredCapabilities || []
  ).map(normalize);

  return candidateTools
    .map((tool) => {
      let capabilityFit = 0;
      let compatibilityFit = 0;
      let budgetFit = 0;
      let skillFit = 0;
      let privacyFit = 0;
      let reliabilityFit = 0;

      const reasons: string[] = [];
      const penalties: string[] = [];

      const fit = roleFit(tool, role);

      if (fit.score > 0) {
        capabilityFit += fit.score;
        if (fit.reason) reasons.push(fit.reason);
      }

      const toolCapabilities = (tool.capabilities || []).map(normalize);
      const exactCapabilityMatches = normalizedRequiredCapabilities.filter(
        (requiredCapability) =>
          toolCapabilities.includes(requiredCapability)
      );

      if (exactCapabilityMatches.length > 0) {
        const exactScore = Math.min(
          15,
          exactCapabilityMatches.length * 5
        );
        capabilityFit += exactScore;
        reasons.push(
          `Supports requested capabilities: ${exactCapabilityMatches.join(', ')}`
        );
      }

      const preferredCategories = task.preferredToolCategories || [];
      const isPreferredCategory = preferredCategories.some(
        (category) =>
          tool.category.toLowerCase() === category.toLowerCase() ||
          (tool.subcategories || []).some(
            (subcategory) =>
              subcategory.toLowerCase() === category.toLowerCase()
          )
      );

      if (isPreferredCategory) {
        capabilityFit += 5;
        reasons.push(`Matches preferred category: ${tool.category}`);
      }

      if (
        role !== 'general' &&
        !fit.eligible &&
        roleEligibleTools.length === 0
      ) {
        capabilityFit -= 25;
        penalties.push(
          `Catalogue fallback: no verified ${role} capability match was available.`
        );
      }

      // Recurring monitoring is usually better with RSS/feed tooling than a
      // conversational search session.
      const taskText = `${task.title || ''} ${task.purpose || ''}`.toLowerCase();
      if (
        role === 'research' &&
        tool.slug === 'feedly' &&
        includesAny(taskText, [
          'daily',
          'every morning',
          'monitor',
          'latest news',
          'recurring'
        ])
      ) {
        capabilityFit += 14;
        reasons.push('Strong fit for recurring feed and news monitoring.');
      }

      // Filtering and deduplication benefit from deterministic routing.
      if (
        role === 'filter' &&
        ['make', 'n8n', 'zapier', 'pipedream'].includes(tool.slug)
      ) {
        capabilityFit += 10;
        reasons.push(
          'Supports deterministic filters, routing, and duplicate checks.'
        );
      }

      // Prevent nonsensical tool assignments even if catalogue metadata is
      // broad or imperfect.
      if (
        ['summarize', 'write'].includes(role) &&
        ['canva', 'recraft', 'buffer', 'gmail', 'slack'].includes(tool.slug)
      ) {
        capabilityFit -= 60;
        penalties.push(
          `${tool.name} should not perform text summarization or drafting.`
        );
      }

      if (
        role === 'design' &&
        ['buffer', 'gmail', 'slack', 'google-sheets'].includes(tool.slug)
      ) {
        capabilityFit -= 60;
        penalties.push(`${tool.name} is not a visual design tool.`);
      }

      if (role === 'publish' && tool.slug !== 'buffer') {
        capabilityFit -= 40;
        penalties.push(
          `${tool.name} is not the preferred social scheduling endpoint.`
        );
      }

      // Integration & compatibility fit
      if (previousToolSlug) {
        const directIntegration = INITIAL_INTEGRATIONS.find(
          (integration) =>
            (integration.source_tool_slug === previousToolSlug &&
              integration.target_tool_slug === tool.slug) ||
            (integration.source_tool_slug === tool.slug &&
              integration.target_tool_slug === previousToolSlug)
        );

        if (directIntegration) {
          if (directIntegration.status === 'verified') {
            compatibilityFit += 20;
            reasons.push(
              `Verified direct integration with prior step (${previousToolSlug}).`
            );
          } else if (directIntegration.status === 'likely') {
            compatibilityFit += 15;
            reasons.push(
              `Likely direct connection to prior step (${previousToolSlug}).`
            );
          }
        } else {
          const connectsThroughAutomation =
            (tool.direct_integrations || []).some((slug) =>
              ['make', 'zapier', 'n8n'].includes(slug)
            );

          if (connectsThroughAutomation) {
            compatibilityFit += 10;
            reasons.push(
              'Integrates through Make, Zapier, or n8n.'
            );
          } else {
            compatibilityFit += 4;
            penalties.push(
              'May require a custom API, webhook, or manual handoff.'
            );
          }
        }
      } else {
        compatibilityFit = 20;
      }

      // Reusing one tool is sensible for adjacent AI writing steps, but broad
      // repetition elsewhere can create low-quality stacks.
      if (
        previousToolSlug === tool.slug &&
        !['summarize', 'write'].includes(role)
      ) {
        compatibilityFit -= 8;
        penalties.push('Repeated tool; a more specialized next step may exist.');
      }

      // Budget fit
      const userMaxAmount = requirements.budget.maximumMonthlyAmount;
      const budgetType = requirements.budget.type;

      if (budgetType === 'free') {
        if (tool.free_plan_available) {
          budgetFit += 15;
          reasons.push('Has a free plan.');
        } else {
          budgetFit -= 15;
          penalties.push('No verified free plan.');
        }
      } else if (tool.free_plan_available) {
        budgetFit += 15;
        reasons.push('Offers a free plan.');
      } else if (
        tool.starting_monthly_price === 0 ||
        tool.starting_monthly_price === null
      ) {
        budgetFit += 12;
        reasons.push('Pay-as-you-go, trial, or zero starting price.');
      } else if (
        userMaxAmount !== null &&
        tool.starting_monthly_price <= userMaxAmount
      ) {
        budgetFit += 10;
        reasons.push('Within the stated monthly budget.');
      } else if (
        userMaxAmount !== null &&
        tool.starting_monthly_price > userMaxAmount
      ) {
        budgetFit -= 8;
        penalties.push('Exceeds the stated monthly budget.');
      } else {
        budgetFit += 6;
      }

      // Technical skill fit
      const difficultyMap: Record<string, number> = {
        non_technical: 0,
        beginner: 1,
        intermediate: 2,
        developer: 3
      };

      const toolDifficulty =
        difficultyMap[tool.technical_difficulty] ?? 0;
      const userDifficulty =
        difficultyMap[requirements.technicalSkill] ?? 0;

      if (toolDifficulty <= userDifficulty) {
        skillFit += 15;
        reasons.push(
          `Difficulty matches ${requirements.technicalSkill} skill level.`
        );
      } else if (toolDifficulty - userDifficulty === 1) {
        skillFit += 7;
        penalties.push(
          `Slightly above the selected skill level (${tool.technical_difficulty}).`
        );
      } else {
        skillFit -= 5;
        penalties.push(
          `Too technical for the selected skill level (${tool.technical_difficulty}).`
        );
      }

      // Privacy fit
      if (
        requirements.dataSensitivity === 'highly_sensitive' ||
        requirements.dataSensitivity === 'financial'
      ) {
        if (tool.privacy_level === 'high') {
          privacyFit += 10;
          reasons.push('Strong privacy fit for sensitive data.');
        } else if (tool.privacy_level === 'medium') {
          privacyFit += 4;
          penalties.push('Only a medium privacy rating for sensitive data.');
        } else {
          privacyFit -= 10;
          penalties.push('Low privacy rating for sensitive data.');
        }
      } else if (tool.privacy_level === 'high') {
        privacyFit += 10;
      } else if (tool.privacy_level === 'medium') {
        privacyFit += 8;
      } else {
        privacyFit += 4;
      }

      // Reliability fit
      const reliabilityContribution =
        (tool.reliability_score || 8) * 0.7;
      const verificationContribution =
        tool.verification_status === 'verified' ? 3 : 1;

      reliabilityFit = Math.min(
        10,
        reliabilityContribution + verificationContribution
      );

      if (tool.verification_status === 'verified') {
        reasons.push('Verified catalogue entry.');
      }

      const totalScore =
        capabilityFit +
        compatibilityFit +
        budgetFit +
        skillFit +
        privacyFit +
        reliabilityFit;

      return {
        toolId: tool.id,
        totalScore: Math.round(totalScore * 10) / 10,
        capabilityFit,
        compatibilityFit,
        budgetFit,
        skillFit,
        privacyFit,
        reliabilityFit,
        reasons,
        penalties
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Check compatibility between two tools.
 */
export function checkCompatibility(
  sourceTool: Tool,
  targetTool: Tool
): CompatibilityResult {
  const integration = INITIAL_INTEGRATIONS.find(
    (item) =>
      (item.source_tool_slug === sourceTool.slug &&
        item.target_tool_slug === targetTool.slug) ||
      (item.source_tool_slug === targetTool.slug &&
        item.target_tool_slug === sourceTool.slug)
  );

  if (integration) {
    const isDirect =
      integration.connection_type === 'direct' ||
      integration.connection_type === 'native';

    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: isDirect
        ? 'verified_direct'
        : 'connectable_via_automation_platform',
      connectionMethod: integration.connection_type.toUpperCase(),
      setup_difficulty: integration.setup_difficulty,
      requiresPaidPlan: integration.requires_paid_plan,
      explanation: integration.notes,
      warning: integration.requires_paid_plan
        ? 'Requires a paid automation plan to execute high-volume actions.'
        : null
    };
  }

  if (['make', 'zapier', 'n8n'].includes(targetTool.slug)) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: 'connectable_via_automation_platform',
      connectionMethod: 'NATIVE INTEGRATION',
      setup_difficulty: 'easy',
      requiresPaidPlan: false,
      explanation: `${targetTool.name} has native connectors for ${sourceTool.name} to stream and map step payloads.`,
      warning: null
    };
  }

  const sourceAutomation = (sourceTool.direct_integrations || []).some(
    (slug) => ['make', 'zapier', 'n8n'].includes(slug)
  );
  const targetAutomation = (targetTool.direct_integrations || []).some(
    (slug) => ['make', 'zapier', 'n8n'].includes(slug)
  );

  if (sourceAutomation && targetAutomation) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: 'connectable_via_automation_platform',
      connectionMethod: 'MAKE / ZAPIER BRIDGE',
      setup_difficulty: 'medium',
      requiresPaidPlan: null,
      explanation:
        'Connectable through an intermediate automation platform.',
      warning: 'Requires configuring Make, Zapier, or n8n.'
    };
  }

  if (sourceTool.api_available && targetTool.webhooks_available) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: 'connectable_via_api',
      connectionMethod: 'WEBHOOK / API DISPATCH',
      setup_difficulty: 'advanced',
      requiresPaidPlan: false,
      explanation: `${sourceTool.name} can send JSON to ${targetTool.name}'s webhook or API receiver.`,
      warning: 'Requires API authorization and field mapping.'
    };
  }

  const formatsMatch = (sourceTool.export_formats || []).some((format) =>
    (targetTool.import_formats || []).includes(format)
  );

  if (
    formatsMatch ||
    (sourceTool.export_formats || []).includes('CSV') ||
    (targetTool.import_formats || []).includes('CSV')
  ) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: 'manual_or_file_transfer',
      connectionMethod: 'CSV / FILE EXPORT',
      setup_difficulty: 'easy',
      requiresPaidPlan: false,
      explanation: `Transfer data by exporting from ${sourceTool.name} and importing into ${targetTool.name}.`,
      warning: 'Requires a manual file transfer.'
    };
  }

  return {
    sourceToolId: sourceTool.id,
    targetToolId: targetTool.id,
    status: 'manual_or_file_transfer',
    connectionMethod: 'MANUAL TRANSFER',
    setup_difficulty: 'easy',
    requiresPaidPlan: null,
    explanation: `No verified native integration exists between ${sourceTool.name} and ${targetTool.name}.`,
    warning: 'Not fully automated.'
  };
}
