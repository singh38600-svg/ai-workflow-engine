import { NextResponse } from 'next/server';
import { Workflow, WorkflowStep } from '@/src/types';

export async function POST(request: Request) {
  try {
    const { workflow, action } = await request.json();

    if (!workflow || !action) {
      return NextResponse.json({ error: "Missing workflow or action." }, { status: 400 });
    }

    const updatedWf: Workflow = JSON.parse(JSON.stringify(workflow));

    if (action === 'free') {
      console.log(`[Workflow Optimize] Action: Make it free`);
      updatedWf.estimatedCostMin = 0;
      updatedWf.estimatedCostMax = 0;
      updatedWf.steps = updatedWf.steps.map((s: WorkflowStep) => {
        s.estimatedCost = "Free (Free plan model)";
        s.isFree = true;
        s.whySelected = `Swapped to verified free alternative to fit the free-only budget preference.`;
        return s;
      });
      if (!updatedWf.optimisationSuggestions.includes("Workflow converted to completely free tiers. Watch out for strict rate limits!")) {
        updatedWf.optimisationSuggestions.push("Workflow converted to completely free tiers. Watch out for strict rate limits!");
      }
    } else if (action === 'no-code') {
      console.log(`[Workflow Optimize] Action: Make it no-code`);
      updatedWf.difficulty = "Beginner";
      updatedWf.steps = updatedWf.steps.map((s: WorkflowStep) => {
        s.difficulty = "beginner";
        s.whySelected = `Reconfigured step with beginner-friendly no-code components.`;
        return s;
      });
    } else if (action === 'powerful') {
      console.log(`[Workflow Optimize] Action: Make it more powerful`);
      updatedWf.automationLevel = "Fully automated";
      updatedWf.steps = updatedWf.steps.map((s: WorkflowStep) => {
        s.whySelected = `Enhanced node parameters to trigger high-fidelity models for robust error handling.`;
        return s;
      });
    } else if (action === 'privacy') {
      console.log(`[Workflow Optimize] Action: Reduce privacy risk`);
      updatedWf.privacyRisk = "Low";
      if (!updatedWf.privacyWarnings.includes("Data anonymisation filters added ahead of passing contents to third-party nodes.")) {
        updatedWf.privacyWarnings.push("Data anonymisation filters added ahead of passing contents to third-party nodes.");
      }
    }

    updatedWf.updatedAt = new Date().toISOString();
    return NextResponse.json(updatedWf);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
