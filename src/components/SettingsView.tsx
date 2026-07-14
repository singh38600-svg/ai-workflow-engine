"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings, ShieldAlert, Cpu, Check } from 'lucide-react';

export default function SettingsView() {
  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Settings & Environment
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure API endpoints, model choices, and security profiles.
        </p>
      </div>

      <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col gap-5 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 pb-3 border-b border-slate-50">
          <Cpu className="w-4 h-4 text-indigo-600" />
          AI Engine Configuration
        </h3>

        <div className="flex flex-col gap-1 text-left">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Target Primary Model</label>
          <select
            defaultValue="gemini-3.5-flash"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 w-full md:w-80 focus:outline-none focus:border-indigo-400"
          >
            <option value="gemini-3.5-flash">Google Gemini 3.5 Flash (Default)</option>
            <option value="gemini-3.5-pro">Google Gemini 3.5 Pro (High Reasoning)</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          </select>
          <span className="text-[10px] text-slate-400 mt-1">Selected model processes requirements extraction and generates step instructions.</span>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/60 flex items-start gap-3 mt-2">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-left">
            <h4 className="text-xs font-bold text-slate-700 leading-none">Security Note: API Credentials</h4>
            <p className="text-[11px] text-slate-500 leading-normal mt-1.5">
              To keep your private keys safe, **never** put them in public input fields in this UI.
              Instead, set them inside your workspace server environment or your local file <code className="bg-white border px-1 py-0.2 rounded text-[10px] text-rose-600 font-mono">.env</code>:
            </p>
            <pre className="bg-slate-900 text-slate-200 rounded p-3 text-[10px] font-mono mt-2.5 leading-relaxed">
{`# .env Configuration
GEMINI_API_KEY="AI_Studio_Secret_Key_Here"
OPENROUTER_MODEL="gemini-3.5-flash"`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
