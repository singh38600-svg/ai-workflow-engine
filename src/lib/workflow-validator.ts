/**
 * Workflow Quality Engine V1
 *
 * Deterministic validation layer that runs after generation and before a
 * workflow is shown to the user.
 */

import {
  TaskDescriptor,
  TaskRole,
  ToolDescriptor,
  evaluateToolForRole,
  getRoleFamily,
  groupRolesByToolFamily,
  inferTaskRoles
} from './tool-role-policy';

export interface SupportingToolAssignment {
  toolId?: string;
  toolSlug: string;
  toolName: string;
  toolLogo?: string;
  toolCategory?: string;
  role: TaskRole;
  whySelected?: string;
  setupInstructions?: string[];
  estimatedCost?: string;
  isFree?: boolean;
  requiresApi?: boolean;
  requiresWebhook?: boolean;
}

export interface WorkflowStepForValidation extends TaskDescriptor {
  id: string;
  order: number;
  title: string;
  purpose: string;
  toolId?: string;
  toolSlug: string;
  toolName: string;
  toolCategory?: string;
  toolCapabilities?: string[];
  supportingTools?: SupportingToolAssignment[];
  input?: string;
  output?: string;
  expectedOutput?: string;
  setupInstructions?: string[];
  humanAction?: string | null;
  estimatedCost?: string;
}

export interface WorkflowForValidation {
  id?: string;
  title?: string;
  description?: string;
  requirementsSummary?: string;
  humanApprovalRequired?: boolean;
  steps: WorkflowStepForValidation[];
}

export type WorkflowQualityIssueSeverity =
  | 'error'
  | 'warning'
  | 'info';

export type WorkflowQualityIssueCode =
  | 'NO_STEPS'
  | 'STEP_ORDER_INVALID'
  | 'REQUESTED_STEP_COUNT_MISMATCH'
  | 'REQUESTED_ACTION_NOT_PRESERVED'
  | 'PRIMARY_TOOL_ROLE_MISMATCH'
  | 'SUPPORTING_TOOL_ROLE_MISMATCH'
  | 'COMPOSITE_STEP_MISSING_TOOL'
  | 'APPROVAL_STEP_MISSING'
  | 'APPROVAL_AFTER_PUBLISHING'
  | 'APPROVAL_NOT_HUMAN'
  | 'PUBLISHING_TOOL_MISSING'
  | 'STEP_INPUT_MISSING'
  | 'STEP_OUTPUT_MISSING'
  | 'SETUP_INSTRUCTIONS_MISSING'
  | 'COST_UNCLEAR';

export interface WorkflowQualityIssue {
  severity: WorkflowQualityIssueSeverity;
  code: WorkflowQualityIssueCode;
  message: string;
  stepId?: string;
  stepOrder?: number;
  role?: TaskRole;
  suggestedToolSlugs?: string[];
}

export interface WorkflowQualityBreakdown {
  taskCoverage: number;
  toolRoleFit: number;
  approvalSafety: number;
  compatibility: number;
  dataCompleteness: number;
}

export interface WorkflowQualityReport {
  valid: boolean;
  score: number;
  breakdown: WorkflowQualityBreakdown;
  issues: WorkflowQualityIssue[];
  checkedAt: string;
}

interface NumberedRequirement {
  order: number;
  text: string;
  roles: TaskRole[];
}

const clamp = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

const normaliseText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const meaningfulHumanAction = (
  value: string | null | undefined
): boolean => {
  if (!value) return false;

  const normalised = normaliseText(value);
  return (
    normalised.length >= 8 &&
    normalised !== 'null' &&
    normalised !== 'none' &&
    normalised !== 'n a'
  );
};

export function extractNumberedRequirements(
  goal: string
): NumberedRequirement[] {
  const lines = goal.split(/\r?\n/);
  const requirements: NumberedRequirement[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.)-]\s+(.+?)\s*$/);

    if (!match) continue;

    const order = Number(match[1]);
    const text = match[2].trim();

    requirements.push({
      order,
      text,
      roles: inferTaskRoles({
        title: text,
        purpose: text
      })
    });
  }

  return requirements.sort((a, b) => a.order - b.order);
}

const buildToolDescriptor = (
  step: WorkflowStepForValidation
): ToolDescriptor => ({
  id: step.toolId,
  slug: step.toolSlug,
  name: step.toolName,
  category: step.toolCategory,
  capabilities: step.toolCapabilities || []
});

const stepRoles = (
  step: WorkflowStepForValidation
): TaskRole[] =>
  inferTaskRoles({
    title: step.title,
    purpose: step.purpose,
    requiredCapabilities: step.requiredCapabilities,
    preferredToolCategories: step.preferredToolCategories
  });

function toolCoversRole(
  tool: ToolDescriptor,
  role: TaskRole
): boolean {
  return evaluateToolForRole(tool, role).eligible;
}

function getSupportingToolDescriptors(
  step: WorkflowStepForValidation
): ToolDescriptor[] {
  return (step.supportingTools || []).map((tool) => ({
    id: tool.toolId,
    slug: tool.toolSlug,
    name: tool.toolName,
    category: tool.toolCategory,
    capabilities: []
  }));
}

function hasRoleCoverage(
  step: WorkflowStepForValidation,
  role: TaskRole
): boolean {
  if (toolCoversRole(buildToolDescriptor(step), role)) {
    return true;
  }

  return getSupportingToolDescriptors(step).some((tool) =>
    toolCoversRole(tool, role)
  );
}

function calculateTaskCoverage(
  workflow: WorkflowForValidation,
  numberedRequirements: NumberedRequirement[]
): number {
  if (workflow.steps.length === 0) return 0;

  if (numberedRequirements.length === 0) {
    const completeSteps = workflow.steps.filter(
      (step) =>
        step.title.trim().length > 0 &&
        step.purpose.trim().length > 0
    ).length;

    return clamp(
      (completeSteps / workflow.steps.length) * 100
    );
  }

  let covered = 0;

  for (const requirement of numberedRequirements) {
    const correspondingStep =
      workflow.steps.find(
        (step) => step.order === requirement.order
      ) || workflow.steps[requirement.order - 1];

    if (!correspondingStep) continue;

    const correspondingRoles = stepRoles(correspondingStep);

    const rolePreserved = requirement.roles.some((role) =>
      correspondingRoles.includes(role)
    );

    if (rolePreserved) {
      covered += 1;
    }
  }

  return clamp(
    (covered / numberedRequirements.length) * 100
  );
}

function calculateToolRoleFit(
  workflow: WorkflowForValidation
): number {
  const allRoleChecks: boolean[] = [];

  for (const step of workflow.steps) {
    for (const role of stepRoles(step)) {
      allRoleChecks.push(hasRoleCoverage(step, role));
    }
  }

  if (allRoleChecks.length === 0) return 0;

  const successful = allRoleChecks.filter(Boolean).length;

  return clamp(
    (successful / allRoleChecks.length) * 100
  );
}

function calculateApprovalSafety(
  workflow: WorkflowForValidation,
  goal: string
): number {
  const requiresApproval =
    workflow.humanApprovalRequired === true ||
    /\bnever publish without human approval\b/i.test(goal) ||
    /\b(human|manual)\s+(review|approval)\b/i.test(goal);

  if (!requiresApproval) return 100;

  const approvalSteps = workflow.steps.filter((step) =>
    stepRoles(step).includes('approve')
  );

  if (approvalSteps.length === 0) return 0;

  const firstApprovalOrder = Math.min(
    ...approvalSteps.map((step) => step.order)
  );

  const publishingSteps = workflow.steps.filter((step) => {
    const roles = stepRoles(step);
    return roles.includes('publish') || roles.includes('schedule');
  });

  const firstPublishingOrder =
    publishingSteps.length > 0
      ? Math.min(...publishingSteps.map((step) => step.order))
      : Number.POSITIVE_INFINITY;

  const hasHumanAction = approvalSteps.some((step) =>
    meaningfulHumanAction(step.humanAction)
  );

  const approvalBeforePublishing =
    firstApprovalOrder < firstPublishingOrder;

  if (hasHumanAction && approvalBeforePublishing) return 100;
  if (approvalBeforePublishing) return 60;
  return 20;
}

function calculateCompatibility(
  workflow: WorkflowForValidation
): number {
  if (workflow.steps.length <= 1) return 100;

  let compatibleTransitions = 0;
  const totalTransitions = workflow.steps.length - 1;

  for (let index = 0; index < totalTransitions; index += 1) {
    const current = workflow.steps[index];
    const next = workflow.steps[index + 1];

    const currentOutput = normaliseText(current.output || '');
    const nextInput = normaliseText(next.input || '');

    if (!currentOutput || !nextInput) continue;

    const currentTokens = new Set(
      currentOutput.split(' ').filter((token) => token.length >= 4)
    );

    const overlap = nextInput
      .split(' ')
      .filter((token) => currentTokens.has(token));

    if (
      overlap.length > 0 ||
      currentOutput.includes('json') ||
      currentOutput.includes('list') ||
      nextInput.includes('json') ||
      nextInput.includes('list')
    ) {
      compatibleTransitions += 1;
    }
  }

  return clamp(
    (compatibleTransitions / totalTransitions) * 100
  );
}

function calculateDataCompleteness(
  workflow: WorkflowForValidation
): number {
  if (workflow.steps.length === 0) return 0;

  let earned = 0;
  const possible = workflow.steps.length * 4;

  for (const step of workflow.steps) {
    if (step.input?.trim()) earned += 1;
    if (step.output?.trim()) earned += 1;
    if (step.expectedOutput?.trim()) earned += 1;
    if (
      Array.isArray(step.setupInstructions) &&
      step.setupInstructions.length > 0
    ) {
      earned += 1;
    }
  }

  return clamp((earned / possible) * 100);
}

function getRequestedGoal(
  workflow: WorkflowForValidation,
  explicitGoal?: string
): string {
  return (
    explicitGoal ||
    workflow.requirementsSummary ||
    workflow.description ||
    ''
  );
}

export function validateWorkflowQuality(
  workflow: WorkflowForValidation,
  explicitGoal?: string
): WorkflowQualityReport {
  const issues: WorkflowQualityIssue[] = [];
  const goal = getRequestedGoal(workflow, explicitGoal);
  const numberedRequirements =
    extractNumberedRequirements(goal);

  if (
    !Array.isArray(workflow.steps) ||
    workflow.steps.length === 0
  ) {
    issues.push({
      severity: 'error',
      code: 'NO_STEPS',
      message: 'The workflow contains no executable steps.'
    });

    return {
      valid: false,
      score: 0,
      breakdown: {
        taskCoverage: 0,
        toolRoleFit: 0,
        approvalSafety: 0,
        compatibility: 0,
        dataCompleteness: 0
      },
      issues,
      checkedAt: new Date().toISOString()
    };
  }

  const sortedSteps = [...workflow.steps].sort(
    (a, b) => a.order - b.order
  );

  sortedSteps.forEach((step, index) => {
    if (step.order !== index + 1) {
      issues.push({
        severity: 'error',
        code: 'STEP_ORDER_INVALID',
        stepId: step.id,
        stepOrder: step.order,
        message:
          'Workflow step order is not sequential from 1.'
      });
    }
  });

  if (
    numberedRequirements.length > 0 &&
    numberedRequirements.length !== sortedSteps.length
  ) {
    issues.push({
      severity: 'error',
      code: 'REQUESTED_STEP_COUNT_MISMATCH',
      message:
        `The user requested ${numberedRequirements.length} numbered steps, ` +
        `but the workflow contains ${sortedSteps.length}.`
    });
  }

  for (const requirement of numberedRequirements) {
    const step =
      sortedSteps.find(
        (candidate) => candidate.order === requirement.order
      ) || sortedSteps[requirement.order - 1];

    if (!step) {
      issues.push({
        severity: 'error',
        code: 'REQUESTED_ACTION_NOT_PRESERVED',
        stepOrder: requirement.order,
        message:
          `Requested action ${requirement.order} is missing: ${requirement.text}`
      });
      continue;
    }

    const preserved = requirement.roles.some((role) =>
      stepRoles(step).includes(role)
    );

    if (!preserved) {
      issues.push({
        severity: 'error',
        code: 'REQUESTED_ACTION_NOT_PRESERVED',
        stepId: step.id,
        stepOrder: step.order,
        message:
          `Step ${step.order} no longer preserves the requested action: ` +
          requirement.text
      });
    }
  }

  for (const step of sortedSteps) {
    const roles = stepRoles(step);
    const primaryTool = buildToolDescriptor(step);
    const supportingTools =
      getSupportingToolDescriptors(step);

    for (const role of roles) {
      const primaryEvaluation =
        evaluateToolForRole(primaryTool, role);

      const supportingCoverage =
        supportingTools.some((tool) =>
          evaluateToolForRole(tool, role).eligible
        );

      if (
        !primaryEvaluation.eligible &&
        !supportingCoverage
      ) {
        issues.push({
          severity: 'error',
          code: 'PRIMARY_TOOL_ROLE_MISMATCH',
          stepId: step.id,
          stepOrder: step.order,
          role,
          message:
            `${step.toolName || step.toolSlug} cannot perform the ` +
            `${role} action assigned to step ${step.order}.`
        });
      }
    }

    const roleGroups = groupRolesByToolFamily(roles);

    if (roleGroups.length > 1) {
      const coveredFamilies = new Set<string>();

      for (const role of roles) {
        if (toolCoversRole(primaryTool, role)) {
          coveredFamilies.add(getRoleFamily(role));
        }

        for (const tool of supportingTools) {
          if (toolCoversRole(tool, role)) {
            coveredFamilies.add(getRoleFamily(role));
          }
        }
      }

      if (coveredFamilies.size < roleGroups.length) {
        issues.push({
          severity: 'error',
          code: 'COMPOSITE_STEP_MISSING_TOOL',
          stepId: step.id,
          stepOrder: step.order,
          message:
            `Step ${step.order} contains ${roleGroups.length} different ` +
            'tool families but does not include enough primary/supporting tools.'
        });
      }
    }

    for (const supporting of step.supportingTools || []) {
      const evaluation = evaluateToolForRole(
        {
          id: supporting.toolId,
          slug: supporting.toolSlug,
          name: supporting.toolName,
          category: supporting.toolCategory,
          capabilities: []
        },
        supporting.role
      );

      if (!evaluation.eligible) {
        issues.push({
          severity: 'error',
          code: 'SUPPORTING_TOOL_ROLE_MISMATCH',
          stepId: step.id,
          stepOrder: step.order,
          role: supporting.role,
          message:
            `${supporting.toolName} cannot perform its supporting ` +
            `${supporting.role} role.`
        });
      }
    }

    if (!step.input?.trim()) {
      issues.push({
        severity: 'warning',
        code: 'STEP_INPUT_MISSING',
        stepId: step.id,
        stepOrder: step.order,
        message: `Step ${step.order} has no defined input.`
      });
    }

    if (!step.output?.trim()) {
      issues.push({
        severity: 'warning',
        code: 'STEP_OUTPUT_MISSING',
        stepId: step.id,
        stepOrder: step.order,
        message: `Step ${step.order} has no defined output.`
      });
    }

    if (
      !Array.isArray(step.setupInstructions) ||
      step.setupInstructions.length === 0
    ) {
      issues.push({
        severity: 'warning',
        code: 'SETUP_INSTRUCTIONS_MISSING',
        stepId: step.id,
        stepOrder: step.order,
        message:
          `Step ${step.order} has no setup instructions.`
      });
    }

    if (!step.estimatedCost?.trim()) {
      issues.push({
        severity: 'info',
        code: 'COST_UNCLEAR',
        stepId: step.id,
        stepOrder: step.order,
        message:
          `Step ${step.order} does not explain its estimated cost.`
      });
    }
  }

  const requiresApproval =
    workflow.humanApprovalRequired === true ||
    /\bnever publish without human approval\b/i.test(goal) ||
    /\b(human|manual)\s+(review|approval)\b/i.test(goal);

  const approvalSteps = sortedSteps.filter((step) =>
    stepRoles(step).includes('approve')
  );

  const publishingSteps = sortedSteps.filter((step) => {
    const roles = stepRoles(step);
    return roles.includes('publish') || roles.includes('schedule');
  });

  if (requiresApproval && approvalSteps.length === 0) {
    issues.push({
      severity: 'error',
      code: 'APPROVAL_STEP_MISSING',
      message:
        'Human approval was requested, but no approval step exists.'
    });
  }

  if (approvalSteps.length > 0) {
    const firstApprovalOrder = Math.min(
      ...approvalSteps.map((step) => step.order)
    );

    const firstPublishingOrder =
      publishingSteps.length > 0
        ? Math.min(
            ...publishingSteps.map((step) => step.order)
          )
        : Number.POSITIVE_INFINITY;

    if (firstApprovalOrder >= firstPublishingOrder) {
      issues.push({
        severity: 'error',
        code: 'APPROVAL_AFTER_PUBLISHING',
        stepOrder: firstApprovalOrder,
        message:
          'The approval gate must occur before scheduling or publishing.'
      });
    }

    for (const step of approvalSteps) {
      if (!meaningfulHumanAction(step.humanAction)) {
        issues.push({
          severity: 'error',
          code: 'APPROVAL_NOT_HUMAN',
          stepId: step.id,
          stepOrder: step.order,
          message:
            'The approval step must name a real human review action.'
        });
      }
    }
  }

  if (
    /\b(linkedin|social|publish|publishing)\b/i.test(goal) &&
    publishingSteps.length === 0
  ) {
    issues.push({
      severity: 'error',
      code: 'PUBLISHING_TOOL_MISSING',
      message:
        'The workflow requests publishing but contains no publishing step.'
    });
  }

  const breakdown: WorkflowQualityBreakdown = {
    taskCoverage: calculateTaskCoverage(
      workflow,
      numberedRequirements
    ),
    toolRoleFit: calculateToolRoleFit(workflow),
    approvalSafety: calculateApprovalSafety(
      workflow,
      goal
    ),
    compatibility: calculateCompatibility(workflow),
    dataCompleteness:
      calculateDataCompleteness(workflow)
  };

  const score = clamp(
    breakdown.taskCoverage * 0.30 +
      breakdown.toolRoleFit * 0.30 +
      breakdown.approvalSafety * 0.20 +
      breakdown.compatibility * 0.10 +
      breakdown.dataCompleteness * 0.10
  );

  const hasErrors = issues.some(
    (issue) => issue.severity === 'error'
  );

  return {
    valid: !hasErrors && score >= 80,
    score,
    breakdown,
    issues,
    checkedAt: new Date().toISOString()
  };
}

export function buildWorkflowRepairInstructions(
  report: WorkflowQualityReport
): string[] {
  return report.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => {
      const stepPrefix = issue.stepOrder
        ? `Step ${issue.stepOrder}: `
        : '';

      return `${stepPrefix}${issue.message}`;
    });
}
