"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  Cpu,
  Clock,
  Coins,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Edit,
  Trash,
  Plus,
  Save,
  Download,
  Check,
  Eye,
  Minimize
} from 'lucide-react';
import { Workflow, WorkflowStep, Tool } from '../types';

interface WorkflowResultProps {
  workflow: Workflow;
  setWorkflow: (wf: Workflow) => void;
  onSave: (wf: Workflow) => void;
  onReplaceTool: (stepId: string, newToolSlug: string) => void;
  onOptimize: (action: 'free' | 'no-code' | 'powerful' | 'privacy') => void;
  toolsCatalogue: Tool[];
}

export default function WorkflowResult({
  workflow,
  setWorkflow,
  onSave,
  onReplaceTool,
  onOptimize,
  toolsCatalogue
}: WorkflowResultProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>("step-1");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Trigger Local Save
  const handleSaveToLibrary = () => {
    setIsSavingLocal(true);
    onSave(workflow);
    setTimeout(() => {
      setIsSavingLocal(false);
      alert("Successfully saved workflow blueprint to your local library database!");
    }, 600);
  };

  // Replace a tool instantly in a step
  const handleSwap = (stepId: string, toolSlug: string) => {
    onReplaceTool(stepId, toolSlug);
  };

  // Step Editing Handlers
  const startEditing = (step: WorkflowStep) => {
    setEditingStepId(step.id);
    setEditTitle(step.title);
    setEditPurpose(step.purpose);
    setEditNotes(step.limitationNotes.join('\n'));
  };

  const saveStepEdit = (stepId: string) => {
    const updatedSteps = workflow.steps.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          title: editTitle,
          purpose: editPurpose,
          limitationNotes: editNotes.split('\n').filter(Boolean)
        };
      }
      return s;
    });
    setWorkflow({ ...workflow, steps: updatedSteps });
    setEditingStepId(null);
  };

  const deleteStep = (stepId: string) => {
    const updatedSteps = workflow.steps
      .filter(s => s.id !== stepId)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const addNewStep = () => {
    const newOrder = workflow.steps.length + 1;
    const defaultTool = toolsCatalogue[3] || toolsCatalogue[0]; // Gemini or fallback
    const newStep: WorkflowStep = {
      id: `step-custom-${Date.now()}`,
      order: newOrder,
      title: "Manual Verification/Approval Action",
      purpose: "Establish a human-guided quality check point to audit AI outputs.",
      toolId: defaultTool.id,
      toolSlug: defaultTool.slug,
      toolName: defaultTool.name,
      toolLogo: defaultTool.logo_url,
      toolCategory: defaultTool.category,
      whySelected: "Manual approval gate for standard compliance checks.",
      input: "Prior step compiled outputs",
      output: "Verified approved assets",
      setupInstructions: [
        "Inspect compiled drafts inside your prior node's queue folder.",
        "Verify tone matches formatting standards.",
        "Approve transaction to dispatch outputs."
      ],
      expectedOutput: "A high-fidelity approved copy draft ready to launch.",
      humanAction: "Double check output texts.",
      limitationNotes: ["Relies on active human availability."],
      estimatedCost: "Free",
      difficulty: "beginner",
      isFree: true,
      requiresApi: false,
      requiresWebhook: false,
      privacyNotes: "Data checked in localized user dashboard securely.",
      alternatives: []
    };
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] });
    setExpandedStep(newStep.id);
  };

  // Export Instructions README helper
  const generateMarkdownExport = (): string => {
    let md = `# 🤖 AI Workflow Blueprint: ${workflow.title}\n\n`;
    md += `> **Goal**: ${workflow.requirementsSummary || workflow.description}\n`;
    md += `> **Setup Difficulty**: ${workflow.difficulty} | **Automation Level**: ${workflow.automationLevel}\n`;
    md += `> **Estimated Monthly Budget**: ${workflow.currency} ${workflow.estimatedCostMin} - ${workflow.estimatedCostMax}\n\n`;

    md += `## 🚀 Overall Instructions\n`;
    workflow.overallInstructions.forEach((ins, idx) => {
      md += `${idx + 1}. ${ins}\n`;
    });

    md += `\n## 📋 Workflow Steps Checklist\n\n`;
    workflow.steps.forEach((step) => {
      md += `### Step ${step.order}: ${step.title}\n`;
      md += `- **Recommended Tool**: [${step.toolName}](${toolsCatalogue.find(t => t.id === step.toolId)?.website_url || '#'})\n`;
      md += `- **Purpose**: ${step.purpose}\n`;
      md += `- **Inputs**: ${step.input}\n`;
      md += `- **Outputs**: ${step.output}\n`;
      md += `- **Setup Checklist**:\n`;
      step.setupInstructions.forEach((ins) => {
        md += `  - [ ] ${ins}\n`;
      });
      md += `- **Expected State**: ${step.expectedOutput}\n\n`;
    });

    md += `## 🔒 Privacy & Safety Recommendations\n`;
    workflow.privacyWarnings.forEach((p) => {
      md += `- ⚠️ ${p}\n`;
    });

    return md;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateMarkdownExport());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto p-1 lg:p-6">
      {/* Central Interactive Timeline Map */}
      <div className="flex-1 flex flex-col gap-5">
        {/* Title Header Card */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
          <div>
            <span className="text-[10px] uppercase font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
              {workflow.category.replace('_', ' ')} Stack
            </span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight mt-1">
              {workflow.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {workflow.description}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              id="btn-save-workflow"
              onClick={handleSaveToLibrary}
              disabled={isSavingLocal}
              className="px-3.5 py-2 border border-slate-200 hover:border-indigo-100 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingLocal ? 'Saving...' : 'Save to Library'}
            </button>
            <button
              id="btn-export-instructions"
              onClick={() => setShowExportModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-100"
            >
              <Download className="w-3.5 h-3.5" />
              Export Setup Checklist
            </button>
          </div>
        </div>

        {/* Optimisation Filters Panel */}
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-semibold text-slate-700">Tweak Stack:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              id="btn-opt-free"
              onClick={() => onOptimize('free')}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              🟢 Make It Free
            </button>
            <button
              id="btn-opt-nocode"
              onClick={() => onOptimize('no-code')}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              🧩 Make It No-Code
            </button>
            <button
              id="btn-opt-powerful"
              onClick={() => onOptimize('powerful')}
              className="px-2.5 py-1 bg-white hover:bg-violet-50 text-violet-700 hover:text-violet-800 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              ⚡ Make More Powerful
            </button>
            <button
              id="btn-opt-privacy"
              onClick={() => onOptimize('privacy')}
              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              🛡️ Reduce Privacy Risk
            </button>
          </div>
        </div>

        {/* Chronological Vertical Timeline Steps Block */}
        <div className="relative pl-10 pr-6 py-6 workflow-canvas rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          {/* Vertical dashed connector line */}
          <div className="absolute top-6 bottom-6 left-[21px] w-0.5 border-l-2 border-dashed border-indigo-200 z-0"></div>

          {workflow.steps.map((step, idx) => {
            const isExpanded = expandedStep === step.id;
            const isEditing = editingStepId === step.id;

            return (
              <div
                key={step.id}
                id={`step-node-${step.id}`}
                className={`bg-white border rounded-2xl transition-all duration-300 z-10 ${
                  isExpanded
                    ? 'border-indigo-100 shadow-md shadow-indigo-50/20'
                    : 'border-slate-100/80 hover:border-slate-200 shadow-sm'
                }`}
              >
                {/* Step Card Header */}
                <div
                  onClick={() => !isEditing && setExpandedStep(isExpanded ? null : step.id)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Circle counter */}
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-50/80 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {idx + 1}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-800 text-xs leading-none">
                          {step.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          STEP {idx + 1}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        {step.purpose}
                      </p>
                    </div>

                    {/* Logo/Identity Indicator */}
                    <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-100/60 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600">
                      <span className="text-xs">{step.toolLogo}</span>
                      <span>{step.toolName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`btn-edit-step-${step.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(step);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-del-step-${step.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to remove this workflow step?")) {
                          deleteStep(step.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded details container */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50/30 flex flex-col gap-4">
                    {isEditing ? (
                      /* inline custom step editor form */
                      <div className="flex flex-col gap-3.5 p-3 bg-white border border-indigo-50 rounded-xl">
                        <h5 className="text-xs font-bold text-indigo-700">Edit Action Configuration</h5>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-medium text-slate-400 uppercase">Step Name</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-medium text-slate-400 uppercase">Purpose</label>
                          <textarea
                            value={editPurpose}
                            onChange={(e) => setEditPurpose(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 h-16 resize-none focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-medium text-slate-400 uppercase">Personal Notes / Limitations</label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                            placeholder="Add your limitations notes..."
                          />
                        </div>
                        <div className="flex gap-2 justify-end mt-1">
                          <button
                            id={`btn-cancel-edit-${step.id}`}
                            onClick={() => setEditingStepId(null)}
                            className="px-3 py-1 bg-slate-100 text-slate-500 rounded font-semibold text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            id={`btn-save-edit-${step.id}`}
                            onClick={() => saveStepEdit(step.id)}
                            className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-xs cursor-pointer"
                          >
                            Save Step
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* standard view */
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left specifications */}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Inputs & Outputs</span>
                              <div className="text-xs text-slate-600 mt-1 flex flex-col gap-1 font-medium">
                                <div>📥 <strong className="text-slate-800">Input:</strong> {step.input}</div>
                                <div>📤 <strong className="text-slate-800">Output:</strong> {step.output}</div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Step Diagnostics</span>
                              <div className="text-xs text-slate-600 mt-1 flex flex-col gap-1">
                                <div>🏷️ <strong className="text-slate-800">Estimated Cost:</strong> {step.estimatedCost}</div>
                                <div>🛠️ <strong className="text-slate-800">Setup Level:</strong> <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-semibold">{step.difficulty}</span></div>
                                {step.humanAction && (
                                  <div className="text-rose-600 font-semibold bg-rose-50/40 p-1.5 rounded border border-rose-100 mt-1 text-[11px]">
                                    ⚠️ Human approval gate required: {step.humanAction}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: why selected & limits */}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Why this tool was selected</span>
                              <p className="text-xs text-slate-600 italic mt-1 leading-relaxed">
                                "{step.whySelected}"
                              </p>
                            </div>

                            {step.limitationNotes.length > 0 && (
                              <div className="flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-rose-400 uppercase font-semibold">Known limitations / Quotas</span>
                                <ul className="list-disc pl-4 text-xs text-slate-600 flex flex-col gap-0.5 mt-1">
                                  {step.limitationNotes.map((note, idx) => (
                                    <li key={idx}>{note}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Setup Instructions checklist */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-100">
                          <h5 className="text-[11px] text-slate-400 font-bold uppercase mb-2">Step-by-step Setup Checklist</h5>
                          <ul className="flex flex-col gap-1.5">
                            {step.setupInstructions.map((ins, idx) => (
                              <li key={idx} className="flex gap-2.5 items-start text-xs text-slate-600 leading-relaxed">
                                <div className="w-4 h-4 rounded border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 bg-slate-50 text-[10px] font-bold text-indigo-600">
                                  {idx + 1}
                                </div>
                                <span className="pt-0.5">{ins}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
                            <span>🎯 <strong className="text-slate-700">Expected end state:</strong> {step.expectedOutput}</span>
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono">Status: unverified</span>
                          </div>
                        </div>

                        {/* Alternative Replacements Tool Panel */}
                        {step.alternatives.length > 0 && (
                          <div className="bg-white p-3.5 rounded-xl border border-slate-100">
                            <h5 className="text-[11px] text-indigo-400 font-bold uppercase mb-2">Alternative Tool replacements</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {step.alternatives.map((alt) => (
                                <div
                                  key={alt.toolId}
                                  className="border border-slate-100 rounded-xl p-2.5 flex flex-col justify-between gap-2.5 hover:border-indigo-100 hover:bg-indigo-50/5 transition-all text-left"
                                >
                                  <div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-semibold text-slate-800">{alt.toolName}</span>
                                      <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Score: {alt.score}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight mt-1 line-clamp-2">
                                      {alt.strength}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                                    <span className="text-[9px] text-slate-400">{alt.costDiff}</span>
                                    <button
                                      id={`btn-swap-${step.id}-${alt.toolSlug}`}
                                      onClick={() => handleSwap(step.id, alt.toolSlug)}
                                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded font-semibold text-[10px] cursor-pointer transition-all"
                                    >
                                      Replace
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline Bottom Controls */}
        <div className="flex gap-3 justify-center py-4">
          <button
            id="btn-add-timeline-step"
            onClick={addNewStep}
            className="px-4 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 hover:border-indigo-100 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Manual Verification Gate
          </button>
        </div>
      </div>

      {/* Right Metrics panel */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-5">
        {/* Recommended Stack Box */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Recommended Stack
          </h3>
          <div className="flex flex-col gap-3">
            {workflow.steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{step.toolLogo}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate leading-none">
                      {step.toolName}
                    </div>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">{step.toolCategory}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
                  {step.isFree ? 'Free' : 'Paid'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stack Metrics summary */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
          <div className="flex flex-col gap-3.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Estimated cost</span>
              <span className="font-bold text-emerald-600 text-sm">
                {workflow.estimatedCostMin === 0 ? "₹0 (100% Free)" : `₹${workflow.estimatedCostMin.toLocaleString()} - ₹${workflow.estimatedCostMax.toLocaleString()}`}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Setup difficulty</span>
              <span className="font-bold text-slate-700">🟢 {workflow.difficulty}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Automation level</span>
              <span className="font-semibold text-indigo-600">{workflow.automationLevel}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">API availability</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Yes
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Privacy risk</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                workflow.privacyRisk === 'High' ? 'bg-rose-50 text-rose-700' : workflow.privacyRisk === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {workflow.privacyRisk} Risk
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mt-4 pt-3 border-t border-slate-50 italic">
            Estimated cost based on standard stored plan specifications. Actual charges depend on usage counts.
          </p>
        </div>

        {/* Alternative workflows block */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Alternative Stacks</h4>
          <div className="flex flex-col gap-3">
            <div className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all text-left">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Option 1</span>
              <div className="text-[11px] text-slate-600 font-medium mt-1 leading-snug">
                Perplexity → ChatGPT → Make → Canva → Buffer
              </div>
              <div className="text-xs font-bold text-slate-700 mt-2">₹1,200 - ₹2,000/mo</div>
            </div>
            <div className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all text-left">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Option 2</span>
              <div className="text-[11px] text-slate-600 font-medium mt-1 leading-snug">
                NewsAPI → Claude → Notion → Zapier → LinkedIn
              </div>
              <div className="text-xs font-bold text-slate-700 mt-2">₹600 - ₹1,200/mo</div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Setup Instructions Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">Export Workflow Setup Markdown</h3>
              <button
                id="btn-close-export"
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-slate-500">
                Copy this complete Markdown README file to paste into your private repository or workspace documentation logs!
              </p>
              <textarea
                readOnly
                value={generateMarkdownExport()}
                className="w-full h-80 bg-slate-950 text-slate-200 font-mono text-[11px] p-4 rounded-xl resize-none focus:outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  id="btn-copy-export"
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {copiedText ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  id="btn-close-export-foot"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
