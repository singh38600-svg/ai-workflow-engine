import { Tool, ToolIntegration, ToolScore, CompatibilityResult, WorkflowRequirements } from '@/src/types';
import { INITIAL_INTEGRATIONS } from './config/tools-catalogue';

/**
 * Deterministic Tool-Ranking Engine
 */
export function rankToolsForTask(
  task: {
    requiredCapabilities: string[];
    preferredToolCategories: string[];
  },
  requirements: WorkflowRequirements,
  tools: Tool[],
  previousToolSlug: string | null
): ToolScore[] {
  return tools
    .filter((t) => t.is_active && t.verification_status !== 'unverified')
    .map((tool) => {
      let capabilityFit = 0;
      let compatibilityFit = 0;
      let budgetFit = 0;
      let skillFit = 0;
      let privacyFit = 0;
      let reliabilityFit = 0;

      const reasons: string[] = [];
      const penalties: string[] = [];

      // 1. Use-case & Capability Fit (30 points)
      // Check category match
      const isPreferredCategory = task.preferredToolCategories.some(
        (cat) => tool.category.toLowerCase() === cat.toLowerCase() || tool.subcategories.some(sub => sub.toLowerCase() === cat.toLowerCase())
      );
      if (isPreferredCategory) {
        capabilityFit += 15;
        reasons.push(`Matches preferred category: ${tool.category}`);
      }

      // Check matching capabilities
      const matchingCaps = tool.capabilities.filter((cap) =>
        task.requiredCapabilities.includes(cap)
      );
      if (matchingCaps.length > 0) {
        const capScore = Math.min(15, matchingCaps.length * 5);
        capabilityFit += capScore;
        reasons.push(`Supports requested capabilities: ${matchingCaps.join(', ')}`);
      } else if (!isPreferredCategory) {
        penalties.push(`No matching capabilities or category for this step.`);
      }

      // 2. Integration & Compatibility Fit (20 points)
      // If we have a previous tool, check if they integrate
      if (previousToolSlug) {
        const directIntegration = INITIAL_INTEGRATIONS.find(
          (i) =>
            (i.source_tool_slug === previousToolSlug && i.target_tool_slug === tool.slug) ||
            (i.source_tool_slug === tool.slug && i.target_tool_slug === previousToolSlug)
        );

        if (directIntegration) {
          if (directIntegration.status === 'verified') {
            compatibilityFit += 20;
            reasons.push(`Verified direct integration with prior step (${previousToolSlug}).`);
          } else if (directIntegration.status === 'likely') {
            compatibilityFit += 15;
            reasons.push(`Likely direct connection to prior step (${previousToolSlug}).`);
          }
        } else {
          // Check if both integrate through Make, Zapier, or n8n
          const toolIntegratesWithAutomation = tool.direct_integrations.some(
            slug => ['make', 'zapier', 'n8n'].includes(slug)
          );
          if (toolIntegratesWithAutomation) {
            compatibilityFit += 10;
            reasons.push(`Integrates via automation platform (Make/Zapier/n8n).`);
          } else {
            compatibilityFit += 5;
            reasons.push(`Requires custom API or webhook bridging.`);
          }
        }
      } else {
        // First step has full baseline compatibility points
        compatibilityFit = 20;
      }

      // 3. Budget Fit (15 points)
      const userMaxAmount = requirements.budget.maximumMonthlyAmount;
      const budgetType = requirements.budget.type;

      if (budgetType === 'free') {
        if (tool.free_plan_available) {
          budgetFit += 15;
          reasons.push("Has completely free tier.");
        } else {
          budgetFit += 0;
          penalties.push("No verified free tier (user requested free tools only).");
        }
      } else {
        if (tool.free_plan_available) {
          budgetFit += 15;
          reasons.push("Has free plan, within budget.");
        } else if (tool.starting_monthly_price === 0 || tool.starting_monthly_price === null) {
          budgetFit += 12;
          reasons.push("Pay-as-you-go or free-trial available.");
        } else if (userMaxAmount !== null && tool.starting_monthly_price <= userMaxAmount) {
          budgetFit += 10;
          reasons.push(`Starting price (${tool.pricing_currency} ${tool.starting_monthly_price}/mo) is within budget.`);
        } else if (userMaxAmount !== null && tool.starting_monthly_price > userMaxAmount) {
          budgetFit += 2;
          penalties.push(`Exceeds specified budget cap.`);
        } else {
          budgetFit += 8;
          reasons.push("Reasonable pricing relative to custom tier.");
        }
      }

      // 4. Technical Skill Fit (15 points)
      // Check user technical difficulty comfort
      const difficultyMap: Record<string, number> = {
        non_technical: 0,
        beginner: 1,
        intermediate: 2,
        developer: 3,
      };

      const toolDiff = difficultyMap[tool.technical_difficulty] || 0;
      const userDiff = difficultyMap[requirements.technicalSkill] || 0;

      if (toolDiff <= userDiff) {
        skillFit += 15;
        reasons.push(`Difficulty matches user's skills (${tool.technical_difficulty}).`);
      } else if (toolDiff - userDiff === 1) {
        skillFit += 8;
        penalties.push(`Slightly above comfort level (requires ${tool.technical_difficulty} setup).`);
      } else {
        skillFit += 2;
        penalties.push(`Requires higher technical expertise (${tool.technical_difficulty}) than selected.`);
      }

      // 5. Privacy Fit (10 points)
      if (requirements.dataSensitivity === 'highly_sensitive' || requirements.dataSensitivity === 'financial') {
        if (tool.privacy_level === 'high') {
          privacyFit += 10;
          reasons.push("Excellent enterprise-grade privacy and zero-data training logs.");
        } else if (tool.privacy_level === 'medium') {
          privacyFit += 6;
          reasons.push("Standard SaaS cloud privacy.");
        } else {
          privacyFit += 1;
          penalties.push("Low-privacy/public model defaults - warning for sensitive data.");
        }
      } else {
        // Standard baseline
        if (tool.privacy_level === 'high') {
          privacyFit += 10;
        } else if (tool.privacy_level === 'medium') {
          privacyFit += 8;
        } else {
          privacyFit += 5;
        }
      }

      // 6. Reliability and Recency Fit (10 points)
      const reliabilityContrib = (tool.reliability_score || 8) * 0.7; // up to 7 pts
      const verificationContrib = tool.verification_status === 'verified' ? 3 : 1; // up to 3 pts
      reliabilityFit = Math.min(10, reliabilityContrib + verificationContrib);

      if (tool.verification_status === 'verified') {
        reasons.push("Verified tool details and fresh compliance checks.");
      }

      // Calculate final weighted total
      const totalScore = capabilityFit + compatibilityFit + budgetFit + skillFit + privacyFit + reliabilityFit;

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
        penalties,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Check compatibility between two tools
 */
export function checkCompatibility(
  sourceTool: Tool,
  targetTool: Tool
): CompatibilityResult {
  // First, look for verified integrations
  const integration = INITIAL_INTEGRATIONS.find(
    (i) =>
      (i.source_tool_slug === sourceTool.slug && i.target_tool_slug === targetTool.slug) ||
      (i.source_tool_slug === targetTool.slug && i.target_tool_slug === sourceTool.slug)
  );

  if (integration) {
    const isDirect = integration.connection_type === 'direct' || integration.connection_type === 'native';
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: isDirect ? "verified_direct" : "connectable_via_automation_platform",
      connectionMethod: integration.connection_type.toUpperCase(),
      setup_difficulty: integration.setup_difficulty,
      requiresPaidPlan: integration.requires_paid_plan,
      explanation: integration.notes,
      warning: integration.requires_paid_plan ? "Requires a paid automation plan to execute high-volume actions." : null
    };
  }

  // Check if target is an automation platform
  if (['make', 'zapier', 'n8n'].includes(targetTool.slug)) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: "connectable_via_automation_platform",
      connectionMethod: "NATIVE INTEGRATION",
      setup_difficulty: "easy",
      requiresPaidPlan: false,
      explanation: `${targetTool.name} has native connectors for ${sourceTool.name} to stream and map step payloads.`,
      warning: null
    };
  }

  // Check if both integrate via some standard automation platform
  const sourceAutomation = sourceTool.direct_integrations.some(slug => ['make', 'zapier', 'n8n'].includes(slug));
  const targetAutomation = targetTool.direct_integrations.some(slug => ['make', 'zapier', 'n8n'].includes(slug));

  if (sourceAutomation && targetAutomation) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: "connectable_via_automation_platform",
      connectionMethod: "MAKE / ZAPIER BRIDGE",
      setup_difficulty: "medium",
      requiresPaidPlan: null,
      explanation: `Connectable via intermediate automation hubs. Both tools feature verified connectors.`,
      warning: "Requires configuring an account on Make or Zapier."
    };
  }

  // Check if both support webhooks/APIs
  if (sourceTool.api_available && targetTool.webhooks_available) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: "connectable_via_api",
      connectionMethod: "WEBHOOK / API DISPATCH",
      setup_difficulty: "advanced",
      requiresPaidPlan: false,
      explanation: `${sourceTool.name} sends outbound JSON calls to ${targetTool.name}'s custom webhook receiver.`,
      warning: "Requires setting up api authorization tokens."
    };
  }

  // Standard manual csv transfer fallback
  const formatsMatch = sourceTool.export_formats.some(f => targetTool.import_formats.includes(f));
  if (formatsMatch || sourceTool.export_formats.includes("CSV") || targetTool.import_formats.includes("CSV")) {
    return {
      sourceToolId: sourceTool.id,
      targetToolId: targetTool.id,
      status: "manual_or_file_transfer",
      connectionMethod: "CSV / FILE EXPORT",
      setup_difficulty: "easy",
      requiresPaidPlan: false,
      explanation: `Transfer data by exporting a file from ${sourceTool.name} and importing it into ${targetTool.name}.`,
      warning: "Requires repetitive manual file download/uploads."
    };
  }

  return {
    sourceToolId: sourceTool.id,
    targetToolId: targetTool.id,
    status: "manual_or_file_transfer",
    connectionMethod: "MANUAL TRANSFER",
    setup_difficulty: "easy",
    requiresPaidPlan: null,
    explanation: `No native integration exists. Manually copy the output variables from ${sourceTool.name} and paste them into ${targetTool.name}.`,
    warning: "Not automated. Perfect for starting out or human-guided workflow gates."
  };
}
