export interface Tool {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  logo_url: string;
  short_description: string;
  long_description: string;
  category: string;
  subcategories: string[];
  capabilities: string[];
  best_for: string;
  not_recommended_for: string;
  pricing_type: 'free' | 'freemium' | 'paid' | 'usage_based' | 'unknown';
  free_plan_available: boolean;
  free_trial_available: boolean;
  starting_monthly_price: number | null;
  pricing_currency: string;
  pricing_notes: string;
  api_available: boolean;
  webhooks_available: boolean;
  direct_integrations: string[]; // List of other tool slugs
  import_formats: string[];
  export_formats: string[];
  supported_platforms: string[];
  technical_difficulty: 'non_technical' | 'beginner' | 'intermediate' | 'developer';
  no_code_friendly: boolean;
  open_source: boolean;
  self_hostable: boolean;
  privacy_level: 'high' | 'medium' | 'low';
  data_retention_notes: string;
  supports_india: boolean;
  reliability_score: number; // 1-10
  editorial_quality_score: number; // 1-10
  verification_status: 'verified' | 'unverified' | 'needs_review';
  last_verified_at: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ToolIntegration {
  id: string;
  source_tool_slug: string;
  target_tool_slug: string;
  connection_type: 'direct' | 'native' | 'webhook' | 'API' | 'Zapier' | 'Make' | 'n8n' | 'CSV' | 'Google Sheets' | 'email' | 'manual';
  status: 'verified' | 'likely' | 'manual' | 'unverified' | 'incompatible';
  setup_difficulty: 'easy' | 'medium' | 'advanced';
  requires_paid_plan: boolean | null;
  notes: string;
  documentation_url: string;
  last_verified_at?: string;
  created_at?: string;
}

export type CategoryType =
  | "content_creation"
  | "job_search"
  | "research"
  | "customer_support"
  | "data_reporting"
  | "marketing"
  | "sales"
  | "development"
  | "productivity"
  | "finance"
  | "other";

export interface WorkflowRequirements {
  workflowTitle: string;
  goalSummary: string;
  category: CategoryType;
  userType: string;
  technicalSkill: 'non_technical' | 'beginner' | 'intermediate' | 'developer';
  preferredImplementation: 'no_code' | 'low_code' | 'developer' | 'automatic';
  budget: {
    type: 'free' | 'limited' | 'flexible' | 'custom';
    maximumMonthlyAmount: number | null;
    currency: string;
  };
  frequency: string | null;
  automationLevel: 'manual' | 'assisted' | 'mostly_automated' | 'fully_automated';
  humanApprovalRequired: boolean;
  dataSensitivity: 'public' | 'internal' | 'personal' | 'financial' | 'highly_sensitive';
  inputs: string[];
  outputs: string[];
  existingTools: string[];
  requiredCapabilities: string[];
  assumptions: string[];
  risks: string[];
  clarificationQuestions: {
    id: string;
    question: string;
    whyItMatters: string;
    options?: string[];
  }[];
  tasks: {
    id: string;
    order: number;
    title: string;
    purpose: string;
    requiredCapabilities: string[];
    inputType: string[];
    outputType: string[];
    preferredToolCategories: string[];
    requiresApi: boolean;
    requiresWebhook: boolean;
    requiresHumanApproval: boolean;
  }[];
}

export interface WorkflowExplanation {
  summary: string;
  outcome: string;
  assumptions: string[];
  steps: {
    taskId: string;
    stepTitle: string;
    explanation: string;
    setupInstructions: string[];
    humanAction: string | null;
    expectedOutput: string;
    limitationNotes: string[];
  }[];
  overallSetupInstructions: string[];
  privacyWarnings: string[];
  riskWarnings: string[];
  optimisationSuggestions: string[];
}

export interface CompatibilityResult {
  sourceToolId: string;
  targetToolId: string;
  status:
    | "verified_direct"
    | "connectable_via_api"
    | "connectable_via_automation_platform"
    | "manual_or_file_transfer"
    | "unverified"
    | "incompatible";
  connectionMethod: string;
  setup_difficulty: 'easy' | 'medium' | 'advanced';
  requiresPaidPlan: boolean | null;
  explanation: string;
  warning: string | null;
}

export interface ToolScore {
  toolId: string;
  totalScore: number;
  capabilityFit: number;
  compatibilityFit: number;
  budgetFit: number;
  skillFit: number;
  privacyFit: number;
  reliabilityFit: number;
  reasons: string[];
  penalties: string[];
}

export interface CostEstimate {
  minimumMonthly: number | null;
  maximumMonthly: number | null;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  includedFreeTools: number;
  paidTools: number;
  unknownCostTools: number;
  notes: string[];
}

export interface WorkflowStep {
  id: string;
  order: number;
  title: string;
  purpose: string;
  toolId: string; // Recommended tool ID
  toolSlug: string;
  toolName: string;
  toolLogo: string;
  toolCategory: string;
  whySelected: string;
  input: string;
  output: string;
  setupInstructions: string[];
  expectedOutput: string;
  humanAction: string | null;
  limitationNotes: string[];
  estimatedCost: string;
  difficulty: 'non_technical' | 'beginner' | 'intermediate' | 'developer';
  isFree: boolean;
  requiresApi: boolean;
  requiresWebhook: boolean;
  privacyNotes: string;
  alternatives: {
    toolId: string;
    toolSlug: string;
    toolName: string;
    score: number;
    strength: string;
    costDiff: string;
    difficultyDiff: string;
    compatibilityDiff: string;
  }[];
}

export interface Workflow {
  id: string;
  owner_id?: string | null;
  title: string;
  description: string;
  category: CategoryType;
  difficulty: 'Non-technical' | 'Beginner' | 'Intermediate' | 'Developer';
  automationLevel: 'Manual' | 'Semi-automated' | 'Mostly automated' | 'Fully automated';
  estimatedCostMin: number;
  estimatedCostMax: number;
  currency: string;
  setupTimeEstimate: string;
  humanApprovalRequired: boolean;
  privacyRisk: 'Low' | 'Medium' | 'High';
  steps: WorkflowStep[];
  overallInstructions: string[];
  privacyWarnings: string[];
  riskWarnings: string[];
  optimisationSuggestions: string[];
  createdAt?: string;
  updatedAt?: string;
  requirementsSummary?: string;
  costNotes?: string;
  preferences?: Record<string, any>;
  visibility?: 'public' | 'private';
  public_share_token?: string | null;
}

export interface WorkflowFeedback {
  id: string;
  workflow_id: string;
  rating: number;
  comments?: string;
  created_at?: string;
}

export interface UserPreference {
  id: string;
  user_id: string;
  budget_preference?: string;
  skill_preference?: string;
  automation_preference?: string;
  data_sensitivity_preference?: string;
  free_only_preference?: boolean;
}
