"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layers, ArrowRight, Star, Cpu, ShieldCheck } from 'lucide-react';
import { TEMPLATE_WORKFLOWS } from '../templates';
import { Workflow } from '../types';

interface TemplatesViewProps {
  onSelectTemplate: (wf: Workflow) => void;
}

export default function TemplatesView({ onSelectTemplate }: TemplatesViewProps) {
  const templates = Object.values(TEMPLATE_WORKFLOWS);

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          Pre-configured AI Workflow Templates
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Deploy structured, verified AI toolchains in seconds. Select a blueprint to inspect, tweak, or activate.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            id={`tpl-card-${tpl.id}`}
            className="bg-white border border-slate-100 hover:border-indigo-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md hover:shadow-indigo-50/40 transition-all group"
          >
            <div>
              <div className="flex justify-between items-start mb-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                  {tpl.category.replace('_', ' ')}
                </span>
                <div className="flex gap-1.5 text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="text-[10px] font-bold text-slate-600">Featured</span>
                </div>
              </div>

              <h3 className="font-semibold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors mb-1.5">
                {tpl.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                {tpl.description}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Estimated Cost</span>
                  <span className="text-xs font-bold text-slate-700">
                    {tpl.estimatedCostMin === 0 ? "Completely Free" : `₹${tpl.estimatedCostMin.toLocaleString()} - ₹${tpl.estimatedCostMax.toLocaleString()}/mo`}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Setup Difficulty</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    🟢 {tpl.difficulty}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Automation Level</span>
                  <span className="text-xs font-semibold text-indigo-600">
                    {tpl.automationLevel}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Number of Steps</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {tpl.steps.length} Actions
                  </span>
                </div>
              </div>

              {/* Steps Chain visualization */}
              <div className="flex items-center flex-wrap gap-1.5 mb-5">
                {tpl.steps.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    <div className="flex items-center gap-1 bg-slate-100/80 px-2 py-1 rounded text-[11px] text-slate-600 font-medium">
                      <span>{step.toolLogo}</span>
                      <span>{step.toolName}</span>
                    </div>
                    {idx < tpl.steps.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <button
              id={`btn-load-tpl-${tpl.id}`}
              onClick={() => onSelectTemplate(tpl)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow-md hover:shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              Load Blueprint Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
