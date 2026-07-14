"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, HelpCircle, Link, RefreshCw } from 'lucide-react';

export default function IntegrationsView() {
  const connectors = [
    { name: 'Google Gemini API', type: 'REST API Header', status: 'Ready to connect', risk: 'Low Risk', logo: '✦' },
    { name: 'Anthropic Claude API', type: 'REST API Header', status: 'Ready to connect', risk: 'Low Risk', logo: '✉️' },
    { name: 'Buffer Scheduler Connection', type: 'OAuth 2.0 Webhook', status: 'Requires Setup', risk: 'Medium Risk', logo: '📊' },
    { name: 'Notion Workspace Sync', type: 'OAuth 2.0 Webhook', status: 'Requires Setup', risk: 'Low Risk', logo: '📓' },
    { name: 'Airtable Base Integrations', type: 'API Personal Key', status: 'Requires Setup', risk: 'Medium Risk', logo: '🗂️' },
    { name: 'Google Sheets Connector', type: 'Google OAuth Webhook', status: 'Requires Setup', risk: 'Low Risk', logo: ' Sheets' }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          System Integrations & Safe Connectors
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Verify and configure the security profiles, webhook statuses, and OAuth tokens connecting your automated stack.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map((conn) => (
          <div key={conn.name} className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-lg shadow-xs">
                {conn.logo}
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-xs">{conn.name}</h4>
                <div className="flex gap-1.5 items-center mt-1">
                  <span className="text-[9px] text-slate-400 font-medium">{conn.type}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="text-[9px] text-indigo-600 font-semibold">{conn.risk}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                conn.status === 'Ready to connect' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {conn.status}
              </span>
              <button
                id={`btn-conn-test-${conn.name.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                onClick={() => alert(`Connection test requested for ${conn.name}. Real integration depends on your Settings API keys.`)}
                className="text-[9px] text-slate-500 hover:text-indigo-600 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Test Connector
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Integration details warning card */}
      <div className="bg-indigo-50/50 border border-indigo-100/40 p-4 rounded-2xl flex items-start gap-3">
        <div className="p-1.5 bg-indigo-100 rounded-xl text-indigo-600 shrink-0">
          <Link className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-indigo-900">How tool authorization is maintained</h4>
          <p className="text-[11px] text-indigo-800 leading-relaxed mt-1">
            This Workflow Engine adheres to server-side standard proxies. Your private tokens, webhooks, and API keys are stored only in the system environment files and never exposed to public frontend interfaces, protecting your endpoints from credential hijacking.
          </p>
        </div>
      </div>
    </div>
  );
}
