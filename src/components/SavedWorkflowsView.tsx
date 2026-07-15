"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FolderHeart, PlayCircle, Trash2, Calendar, Star } from 'lucide-react';
import { Workflow } from '../types';

interface SavedWorkflowsViewProps {
  workflows: Workflow[];
  onSelect: (wf: Workflow) => void;
  onDelete: (id: string) => void;
  error?: string | null;
}

export default function SavedWorkflowsView({ workflows, onSelect, onDelete, error }: SavedWorkflowsViewProps) {
  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <FolderHeart className="w-5 h-5 text-indigo-600" />
          Your Saved Workflow Blueprints
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Durable server-persisted setups. Retrieve saved paths to configure, execute, or export.
        </p>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-xl font-bold">
            ⚠️
          </div>
          <h3 className="font-semibold text-rose-800 text-sm">Library Synchronisation Failed</h3>
          <p className="text-xs text-rose-600 max-w-sm leading-normal">
            {error}
          </p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-1">
            Please make sure your Supabase environment variables are correctly configured in your server.
          </p>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-xl font-bold">
            📁
          </div>
          <h3 className="font-semibold text-slate-700 text-sm">No saved workflows yet</h3>
          <p className="text-xs text-slate-400 max-w-sm leading-normal">
            Generate your custom workflow stack using the Home tab or templates, then click "Save to Library" to persist it on the server filesystem.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-white border border-slate-100 hover:border-indigo-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow hover:shadow-indigo-50/10 transition-all group"
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {wf.category.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors mb-1">
                  {wf.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
                  {wf.description}
                </p>

                <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4">
                  <div className="flex flex-col gap-0.5 text-left flex-1">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Setup Level</span>
                    <span className="text-xs font-bold text-slate-700">🟢 {wf.difficulty}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left flex-1">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Cost range</span>
                    <span className="text-xs font-bold text-emerald-600">
                      {wf.estimatedCostMin === 0 ? 'Free' : `₹${wf.estimatedCostMin} - ₹${wf.estimatedCostMax}`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left flex-1">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Total Steps</span>
                    <span className="text-xs font-bold text-slate-700">{wf.steps.length} Nodes</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-slate-50">
                <button
                  id={`btn-load-saved-${wf.id}`}
                  onClick={() => onSelect(wf)}
                  className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <PlayCircle className="w-4 h-4" /> Load Blueprint
                </button>
                <button
                  id={`btn-delete-saved-${wf.id}`}
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this saved blueprint permanently?")) {
                      onDelete(wf.id);
                    }
                  }}
                  className="px-2.5 py-1.5 border border-slate-100 hover:border-rose-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="Delete blueprint"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
