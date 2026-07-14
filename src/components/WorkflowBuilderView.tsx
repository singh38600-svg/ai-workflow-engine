"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Compass, Plus, PlayCircle, Layers, Check, Trash, Sparkles } from 'lucide-react';
import { Tool, Workflow, WorkflowStep } from '../types';

interface WorkflowBuilderViewProps {
  tools: Tool[];
  onLoadCustomWorkflow: (wf: Workflow) => void;
}

export default function WorkflowBuilderView({ tools, onLoadCustomWorkflow }: WorkflowBuilderViewProps) {
  const [title, setTitle] = useState("Custom Tailored Scraping & Processing Pipeline");
  const [desc, setDesc] = useState("An interactive pipeline built from scratch to scrape trends and push them.");
  const [steps, setSteps] = useState<Partial<WorkflowStep>[]>([
    { id: "step-1", order: 1, title: "Data Collection Trigger", toolSlug: "google-search", purpose: "Scrape daily trend entries." },
    { id: "step-2", order: 2, title: "AI Filtering and Digest", toolSlug: "gemini", purpose: "Analyze items with high quality metrics." }
  ]);

  const handleAddStep = () => {
    const nextOrder = steps.length + 1;
    setSteps([
      ...steps,
      {
        id: `step-${Date.now()}`,
        order: nextOrder,
        title: `Action Pipeline ${nextOrder}`,
        toolSlug: "slack",
        purpose: "Send message triggers."
      }
    ]);
  };

  const handleUpdateStepSlug = (id: string, slug: string) => {
    setSteps(steps.map(s => s.id === id ? { ...s, toolSlug: slug } : s));
  };

  const handleUpdateStepTitle = (id: string, text: string) => {
    setSteps(steps.map(s => s.id === id ? { ...s, title: text } : s));
  };

  const handleUpdateStepPurpose = (id: string, text: string) => {
    setSteps(steps.map(s => s.id === id ? { ...s, purpose: text } : s));
  };

  const handleDeleteStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id).map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const handleCompile = () => {
    if (!title.trim()) {
      alert("Please specify a workflow title!");
      return;
    }

    // Convert raw builder steps to structured WorkflowSteps
    const compiledSteps: WorkflowStep[] = steps.map((s, idx) => {
      const tool = tools.find(t => t.slug === s.toolSlug) || tools[3] || tools[0];

      return {
        id: s.id || `step-${idx + 1}`,
        order: idx + 1,
        title: s.title || "Custom Pipeline Action",
        purpose: s.purpose || "Process and automate actions.",
        toolId: tool.id,
        toolSlug: tool.slug,
        toolName: tool.name,
        toolLogo: tool.logo_url,
        toolCategory: tool.category,
        whySelected: `Selected by manual design. Excellent compatibility.`,
        input: idx === 0 ? "Initial payload text" : "Previous node structured data",
        output: "Result parameters",
        setupInstructions: [
          `Register and login on ${tool.name}.`,
          `Integrate the custom webhook endpoint parameters.`,
          `Map variables into the downstream node.`
        ],
        expectedOutput: "A success status flag.",
        humanAction: null,
        limitationNotes: tool.not_recommended_for ? [tool.not_recommended_for] : [],
        estimatedCost: tool.free_plan_available ? "Free Plan" : `${tool.pricing_currency} ${tool.starting_monthly_price}/mo`,
        difficulty: tool.technical_difficulty,
        isFree: tool.free_plan_available,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: tool.data_retention_notes || "Standard security standards.",
        alternatives: []
      };
    });

    const newWorkflow: Workflow = {
      id: `wf-manual-${Date.now()}`,
      title: title,
      description: desc,
      category: "productivity",
      difficulty: "Beginner",
      automationLevel: "Mostly automated",
      estimatedCostMin: 500,
      estimatedCostMax: 1500,
      currency: "INR",
      setupTimeEstimate: "35 minutes",
      humanApprovalRequired: false,
      privacyRisk: "Low",
      steps: compiledSteps,
      overallInstructions: [
        "Create accounts on all chosen platforms.",
        "Map fields chronologically matching your step outputs.",
        "Toggle pipeline active inside Make.com/Zapier dashboard."
      ],
      privacyWarnings: ["Anonymize sensitive emails or transaction IDs before passing to cloud endpoints."],
      riskWarnings: ["Api rate-limiting can cause workflow execution delays under heavy bulk actions."],
      optimisationSuggestions: ["Review logs regularly to catch intermittent pipeline errors early."],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onLoadCustomWorkflow(newWorkflow);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-600" />
          Interactive Workflow Canvas Builder
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Hand-craft your custom pipeline by manually connecting nodes from our verified database.
        </p>
      </div>

      <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col gap-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Workflow Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Short Summary Description</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Builder Step Grid */}
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-50">
            <h4 className="text-xs font-bold text-slate-700">Chronological Connection Nodes</h4>
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {steps.length} Steps Defined
            </span>
          </div>

          <div className="flex flex-col gap-3 p-5 workflow-canvas rounded-2xl border border-slate-200 shadow-sm">
            {steps.map((step, idx) => (
              <div key={step.id} className="bg-white border border-slate-100 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {idx + 1}
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  {/* Step Title */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] text-slate-400 font-bold uppercase">Node Label</label>
                    <input
                      type="text"
                      value={step.title || ''}
                      onChange={(e) => handleUpdateStepTitle(step.id!, e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-600 focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  {/* Step Purpose */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] text-slate-400 font-bold uppercase">Purpose</label>
                    <input
                      type="text"
                      value={step.purpose || ''}
                      onChange={(e) => handleUpdateStepPurpose(step.id!, e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-600 focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  {/* Tool Picker */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] text-slate-400 font-bold uppercase">Recommended Tool</label>
                    <select
                      value={step.toolSlug || ''}
                      onChange={(e) => handleUpdateStepSlug(step.id!, e.target.value)}
                      className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-600 focus:outline-none focus:border-indigo-400"
                    >
                      {tools.map(t => (
                        <option key={t.id} value={t.slug}>
                          {t.logo_url} {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteStep(step.id!)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded border border-transparent hover:border-slate-100 mt-2 md:mt-0 transition-all cursor-pointer"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 justify-between mt-3 pt-3 border-t border-slate-50">
            <button
              onClick={handleAddStep}
              className="px-3.5 py-1.5 border border-slate-200 hover:border-indigo-100 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/10 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Pipeline Node
            </button>

            <button
              id="btn-compile-builder"
              onClick={handleCompile}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-100 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Compile & Load Workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
