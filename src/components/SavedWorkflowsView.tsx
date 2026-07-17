"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Eye,
  FolderHeart,
  Pencil,
  ShieldCheck,
  Trash2,
  Wrench
} from 'lucide-react';
import { Workflow } from '../types';

interface SavedWorkflowsViewProps {
  workflows: Workflow[];
  onSelect: (wf: Workflow) => void;
  onDelete: (id: string) => void;
  error?: string | null;
}

function formatCategory(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatCost(workflow: Workflow): string {
  if (workflow.estimatedCostMin === 0 && workflow.estimatedCostMax === 0) {
    return 'Free';
  }

  return `${workflow.currency} ${workflow.estimatedCostMin}–${workflow.estimatedCostMax}/month`;
}

function hasMeaningfulHumanAction(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() !== 'null';
}

export default function SavedWorkflowsView({
  workflows,
  onSelect,
  onDelete,
  error
}: SavedWorkflowsViewProps) {
  const [openedWorkflowId, setOpenedWorkflowId] = useState<string | null>(null);

  const openedWorkflow = useMemo(
    () =>
      openedWorkflowId
        ? workflows.find((workflow) => workflow.id === openedWorkflowId) || null
        : null,
    [openedWorkflowId, workflows]
  );

  const handleDelete = (workflow: Workflow) => {
    const confirmed = confirm(
      `Delete "${workflow.title}" permanently?`
    );

    if (!confirmed) return;

    onDelete(workflow.id);

    if (openedWorkflowId === workflow.id) {
      setOpenedWorkflowId(null);
    }
  };

  /*
   * IMPORTANT:
   * Viewing a blueprint stays inside Saved Workflows.
   * The parent onSelect callback intentionally sends the user to Home, so it is
   * used only by the clearly labelled "Edit on Home" button.
   */
  if (openedWorkflow) {
    const orderedSteps = Array.isArray(openedWorkflow.steps)
      ? [...openedWorkflow.steps].sort((a, b) => a.order - b.order)
      : [];

    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpenedWorkflowId(null)}
            className="self-start inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl px-3 py-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Saved Workflows
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSelect(openedWorkflow)}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl px-4 py-2 transition-colors"
              title="Open this workflow in the Home editor"
            >
              <Pencil className="w-4 h-4" />
              Edit on Home
            </button>

            <button
              type="button"
              onClick={() => handleDelete(openedWorkflow)}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl px-3 py-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <section className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
                {formatCategory(openedWorkflow.category)}
              </span>

              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                {openedWorkflow.difficulty}
              </span>

              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                {openedWorkflow.automationLevel}
              </span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {openedWorkflow.title}
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed mt-2">
                {openedWorkflow.description}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Wrench className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase">
                    Steps
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-800 mt-1">
                  {orderedSteps.length} nodes
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock3 className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase">
                    Setup
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-800 mt-1">
                  {openedWorkflow.setupTimeEstimate}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase">
                    Privacy
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-800 mt-1">
                  {openedWorkflow.privacyRisk}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase">
                    Cost
                  </span>
                </div>
                <p className="text-sm font-extrabold text-emerald-700 mt-1">
                  {formatCost(openedWorkflow)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {openedWorkflow.requirementsSummary && (
          <section className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
              Original requirement
            </p>
            <p className="text-sm text-indigo-900 leading-relaxed mt-1.5">
              {openedWorkflow.requirementsSummary}
            </p>
          </section>
        )}

        {orderedSteps.length === 0 ? (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <p className="font-bold text-amber-800 text-sm">
              This is a legacy metadata-only workflow.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              It was saved before step persistence was repaired and contains no
              recoverable nodes.
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">
                Workflow Blueprint
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Review every saved node without leaving Saved Workflows.
              </p>
            </div>

            {orderedSteps.map((step, index) => (
              <article
                key={step.id}
                className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-extrabold">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {step.title}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">
                          {step.purpose}
                        </p>
                      </div>

                      <span className="self-start text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap">
                        {step.difficulty}
                      </span>
                    </div>

                    <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xl">
                          {step.toolLogo || '🧩'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                            Recommended tool
                          </p>
                          <p className="text-sm font-extrabold text-slate-800">
                            {step.toolName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formatCategory(step.toolCategory)}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mt-3">
                        {step.whySelected}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <div className="border border-slate-100 rounded-xl p-3">
                        <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                          Input
                        </p>
                        <p className="text-xs text-slate-700 mt-1">
                          {step.input}
                        </p>
                      </div>

                      <div className="border border-slate-100 rounded-xl p-3">
                        <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                          Output
                        </p>
                        <p className="text-xs text-slate-700 mt-1">
                          {step.output}
                        </p>
                      </div>
                    </div>

                    {Array.isArray(step.setupInstructions) &&
                      step.setupInstructions.length > 0 && (
                        <div className="mt-4">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            Setup instructions
                          </p>
                          <ol className="mt-2 flex flex-col gap-2">
                            {step.setupInstructions.map(
                              (instruction, instructionIndex) => (
                                <li
                                  key={`${step.id}-instruction-${instructionIndex}`}
                                  className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{instruction}</span>
                                </li>
                              )
                            )}
                          </ol>
                        </div>
                      )}

                    {step.expectedOutput && (
                      <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <p className="text-[9px] uppercase font-bold tracking-wider text-emerald-600">
                          Success looks like
                        </p>
                        <p className="text-xs text-emerald-900 leading-relaxed mt-1">
                          {step.expectedOutput}
                        </p>
                      </div>
                    )}

                    {hasMeaningfulHumanAction(step.humanAction) && (
                      <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-[9px] uppercase font-bold tracking-wider text-amber-600">
                          Human action required
                        </p>
                        <p className="text-xs text-amber-900 leading-relaxed mt-1">
                          {step.humanAction}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                        {step.estimatedCost}
                      </span>
                      {step.requiresApi && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                          API required
                        </span>
                      )}
                      {step.requiresWebhook && (
                        <span className="text-[10px] font-bold bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full">
                          Webhook required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {Array.isArray(openedWorkflow.overallInstructions) &&
          openedWorkflow.overallInstructions.length > 0 && (
            <section className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-800">
                Overall setup checklist
              </h2>
              <ol className="mt-3 flex flex-col gap-2">
                {openedWorkflow.overallInstructions.map(
                  (instruction, index) => (
                    <li
                      key={`overall-${index}`}
                      className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span>{instruction}</span>
                    </li>
                  )
                )}
              </ol>
            </section>
          )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <FolderHeart className="w-5 h-5 text-indigo-600" />
          Your Saved Workflow Blueprints
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Open and inspect saved workflows without leaving this page.
        </p>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-xl font-bold">
            ⚠️
          </div>
          <h3 className="font-semibold text-rose-800 text-sm">
            Library Synchronisation Failed
          </h3>
          <p className="text-xs text-rose-600 max-w-sm leading-normal">
            {error}
          </p>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-xl font-bold">
            📁
          </div>
          <h3 className="font-semibold text-slate-700 text-sm">
            No saved workflows yet
          </h3>
          <p className="text-xs text-slate-400 max-w-sm leading-normal">
            Generate a workflow on Home, then save it to your library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workflows.map((workflow) => {
            const stepCount = Array.isArray(workflow.steps)
              ? workflow.steps.length
              : 0;

            return (
              <div
                key={workflow.id}
                className="bg-white border border-slate-100 hover:border-indigo-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow transition-all group"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {formatCategory(workflow.category)}
                    </span>

                    <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {workflow.updatedAt
                          ? new Date(
                              workflow.updatedAt
                            ).toLocaleDateString()
                          : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-semibold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors mb-1">
                    {workflow.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
                    {workflow.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4">
                    <div>
                      <span className="text-[8px] text-slate-400 font-bold uppercase">
                        Level
                      </span>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                        {workflow.difficulty}
                      </p>
                    </div>

                    <div>
                      <span className="text-[8px] text-slate-400 font-bold uppercase">
                        Cost
                      </span>
                      <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                        {workflow.estimatedCostMin === 0
                          ? 'Free'
                          : `${workflow.currency} ${workflow.estimatedCostMin}+`}
                      </p>
                    </div>

                    <div>
                      <span className="text-[8px] text-slate-400 font-bold uppercase">
                        Steps
                      </span>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                        {stepCount} nodes
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-50">
                  <button
                    id={`btn-view-saved-${workflow.id}`}
                    type="button"
                    onClick={() => setOpenedWorkflowId(workflow.id)}
                    className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    View Blueprint
                  </button>

                  <button
                    id={`btn-delete-saved-${workflow.id}`}
                    type="button"
                    onClick={() => handleDelete(workflow)}
                    className="px-3 py-2 border border-slate-100 hover:border-rose-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    title="Delete blueprint"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
