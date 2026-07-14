"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, Search, Edit2, Sliders, Check, RotateCcw, Plus, HelpCircle } from 'lucide-react';
import { Tool } from '../types';

interface ToolLibraryProps {
  tools: Tool[];
  onUpdateTool: (tool: Tool) => void;
  onResetTools: () => void;
}

export default function ToolLibrary({ tools, onUpdateTool, onResetTools }: ToolLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTool, setEditingTool] = useState<Tool | null>(null);

  // New tool CSV import states
  const [csvString, setCsvString] = useState('');
  const [showImporter, setShowImporter] = useState(false);

  // Categories list
  const categories = ['all', 'research', 'content_creation', 'productivity', 'marketing', 'development', 'customer_support', 'sales', 'finance'];

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.short_description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle saving the edit tool modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTool) {
      onUpdateTool(editingTool);
      setEditingTool(null);
      alert("Successfully updated tool specifications in the database!");
    }
  };

  // Simple CSV Import Parser
  const handleCSVImport = () => {
    if (!csvString.trim()) {
      alert("Please provide valid CSV content!");
      return;
    }

    try {
      // Very basic line parser
      const lines = csvString.split('\n').filter(Boolean);
      if (lines.length < 2) {
        alert("CSV requires at least a header and 1 data line.");
        return;
      }

      // Format expected: slug,name,website_url,logo_url,short_description,category,starting_monthly_price,technical_difficulty
      const header = lines[0].split(',');
      let importCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 6) continue;

        const slug = row[0].trim();
        const name = row[1].trim();
        const website_url = row[2].trim();
        const logo_url = row[3].trim();
        const short_description = row[4].trim();
        const category = row[5].trim();
        const price = parseFloat(row[6]) || 0;
        const difficulty = (row[7] || 'beginner').trim() as any;

        const newTool: Tool = {
          id: `tool-imported-${Date.now()}-${i}`,
          slug,
          name,
          website_url,
          logo_url,
          short_description,
          long_description: `${name} imported dynamically via custom CSV.`,
          category,
          subcategories: [category],
          capabilities: ["custom_task"],
          best_for: "Custom workflows and pipeline triggers",
          not_recommended_for: "",
          pricing_type: price > 0 ? "paid" : "free",
          free_plan_available: price === 0,
          free_trial_available: true,
          starting_monthly_price: price,
          pricing_currency: "USD",
          pricing_notes: "Imported pricing details.",
          api_available: true,
          webhooks_available: true,
          direct_integrations: [],
          import_formats: ["CSV"],
          export_formats: ["CSV"],
          supported_platforms: ["Web"],
          technical_difficulty: difficulty,
          no_code_friendly: true,
          open_source: false,
          self_hostable: false,
          privacy_level: "medium",
          data_retention_notes: "Standard storage metrics.",
          supports_india: true,
          reliability_score: 8,
          editorial_quality_score: 8,
          verification_status: "verified",
          last_verified_at: new Date().toISOString().split('T')[0]
        };

        onUpdateTool(newTool);
        importCount++;
      }

      alert(`Successfully imported ${importCount} tools to the active catalog!`);
      setCsvString('');
      setShowImporter(false);
    } catch (e) {
      alert("Error parsing CSV format. Ensure proper comma separations!");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Page header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Verified Tool Database
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic catalog of AI services, automation channels, CRM platforms, and payment modules.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            id="btn-show-csv-importer"
            onClick={() => setShowImporter(true)}
            className="px-3.5 py-2 border border-slate-200 hover:border-indigo-100 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            CSV Import Template
          </button>
          <button
            id="btn-reset-catalogue"
            onClick={() => {
              if (confirm("Reset custom tools to default initial seed catalogue?")) {
                onResetTools();
              }
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Seed Data
          </button>
        </div>
      </div>

      {/* CSV Importer Drawer */}
      {showImporter && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-700">CSV Bulk Tool Importer</h4>
            <button onClick={() => setShowImporter(false)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Paste rows matching format: <code className="bg-white px-1.5 py-0.5 border border-slate-100 rounded font-mono">slug,name,website_url,logo_url,short_description,category,starting_price,difficulty</code>
          </p>
          <textarea
            placeholder={`new-custom-tool,Custom Tool,https://example.com,🔮,A custom action helper API,productivity,0,beginner`}
            value={csvString}
            onChange={(e) => setCsvString(e.target.value)}
            className="w-full h-24 bg-white border border-slate-200 rounded-xl text-xs p-3 font-mono focus:outline-none focus:border-indigo-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCSVImport}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Parse & Import Tools
            </button>
          </div>
        </div>
      )}

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-200 placeholder-slate-400"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              id={`pill-cat-${cat}`}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            id={`tool-item-${tool.slug}`}
            className="bg-white border border-slate-100 p-4 rounded-xl flex flex-col justify-between shadow-xs hover:shadow transition-all"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tool.logo_url}</span>
                  <h3 className="font-semibold text-slate-800 text-xs">{tool.name}</h3>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded capitalize">
                  {tool.pricing_type}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed mb-3 line-clamp-3">
                {tool.short_description}
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                {tool.capabilities.slice(0, 3).map((cap) => (
                  <span key={cap} className="text-[9px] bg-indigo-50/50 text-indigo-600 px-1.5 py-0.2 rounded font-medium">
                    {cap.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[10px] text-slate-400">
              <span>{tool.pricing_currency} {tool.starting_monthly_price !== null ? `${tool.starting_monthly_price}/mo` : 'Usage'}</span>
              <button
                id={`btn-admin-edit-${tool.slug}`}
                onClick={() => setEditingTool(tool)}
                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" /> Edit Fields
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Administrator Edit Fields Modal */}
      {editingTool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-100"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">Administrator: Edit Tool Fields</h3>
              <button
                type="button"
                onClick={() => setEditingTool(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              {/* Field pairs */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tool Name</label>
                <input
                  type="text"
                  required
                  value={editingTool.name}
                  onChange={(e) => setEditingTool({ ...editingTool, name: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Website URL</label>
                <input
                  type="url"
                  required
                  value={editingTool.website_url}
                  onChange={(e) => setEditingTool({ ...editingTool, website_url: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Logo Icon Emoji</label>
                <input
                  type="text"
                  required
                  value={editingTool.logo_url}
                  onChange={(e) => setEditingTool({ ...editingTool, logo_url: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Starting Monthly Price</label>
                <input
                  type="number"
                  value={editingTool.starting_monthly_price || ''}
                  onChange={(e) => setEditingTool({ ...editingTool, starting_monthly_price: e.target.value ? parseFloat(e.target.value) : null })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Short Description</label>
                <input
                  type="text"
                  required
                  value={editingTool.short_description}
                  onChange={(e) => setEditingTool({ ...editingTool, short_description: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Best For</label>
                <input
                  type="text"
                  value={editingTool.best_for}
                  onChange={(e) => setEditingTool({ ...editingTool, best_for: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Difficulty</label>
                <select
                  value={editingTool.technical_difficulty}
                  onChange={(e) => setEditingTool({ ...editingTool, technical_difficulty: e.target.value as any })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                >
                  <option value="non_technical">Non-technical</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="developer">Developer</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Privacy Level</label>
                <select
                  value={editingTool.privacy_level}
                  onChange={(e) => setEditingTool({ ...editingTool, privacy_level: e.target.value as any })}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                >
                  <option value="high">High (Enterprise Privacy)</option>
                  <option value="medium">Medium (Standard SaaS)</option>
                  <option value="low">Low (Public Logs)</option>
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setEditingTool(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-admin-submit-tool"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Save Tool Details
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
