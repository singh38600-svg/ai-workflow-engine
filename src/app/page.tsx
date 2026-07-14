"use client";

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  ChevronDown,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  Info,
  Loader2,
  AlertTriangle,
  Lightbulb,
  Cpu,
  Bookmark
} from 'lucide-react';
import Sidebar from '@/src/components/Sidebar';
import Header from '@/src/components/Header';
import WorkflowResult from '@/src/components/WorkflowResult';
import ToolLibrary from '@/src/components/ToolLibrary';
import TemplatesView from '@/src/components/TemplatesView';
import SavedWorkflowsView from '@/src/components/SavedWorkflowsView';
import IntegrationsView from '@/src/components/IntegrationsView';
import SettingsView from '@/src/components/SettingsView';
import WorkflowBuilderView from '@/src/components/WorkflowBuilderView';
import { Tool, Workflow, WorkflowStep } from '@/src/types';

export default function App() {
  const [currentTab, setTab] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [searchVal, setSearchVal] = useState('');

  // Preference filter states
  const [budget, setBudget] = useState('flexible');
  const [skill, setSkill] = useState('beginner');
  const [automation, setAutomation] = useState('mostly_automated');
  const [freeToolsOnly, setFreeToolsOnly] = useState(false);

  // Loaded database state
  const [toolsList, setToolsList] = useState<Tool[]>([]);
  const [savedWorkflows, setSavedWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load database lists on mount
  useEffect(() => {
    setIsHydrated(true);
    fetchTools();
    fetchSavedWorkflows();
  }, []);

  const fetchTools = async () => {
    try {
      const res = await fetch('/api/tools');
      if (res.ok) {
        const data = await res.json();
        setToolsList(data);
      }
    } catch (e) {
      console.error("Error loading tools database.", e);
    }
  };

  const fetchSavedWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const data = await res.json();
        setSavedWorkflows(data);
      }
    } catch (e) {
      console.error("Error loading saved workflows.", e);
    }
  };

  // 1. Action: Generate Workflow via backend API
  const handleGenerate = async (customGoal?: string) => {
    const finalGoal = customGoal || goalText;
    if (!finalGoal.trim()) {
      alert("Please describe your goal first!");
      return;
    }

    setIsGenerating(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/workflow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: finalGoal,
          preferences: {
            budget,
            skill,
            automation,
            freeToolsOnly
          }
        })
      });

      if (res.ok) {
        const wf: Workflow = await res.json();
        setActiveWorkflow(wf);
        // smooth scroll down to the result panel
        setTimeout(() => {
          document.getElementById('workflow-result-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        const err = await res.json();
        setErrorBanner(err.error || "An error occurred while generating the workflow.");
      }
    } catch (e) {
      setErrorBanner("Could not contact the server backend. Verify your dev server is active.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Action: Save active workflow blueprint
  const handleSaveWorkflow = async (wf: Workflow) => {
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wf)
      });
      if (res.ok) {
        fetchSavedWorkflows();
      }
    } catch (e) {
      console.error("Error saving workflow", e);
    }
  };

  // 3. Action: Delete saved blueprint
  const handleDeleteSavedWorkflow = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchSavedWorkflows();
        if (activeWorkflow?.id === id) {
          setActiveWorkflow(null);
        }
      }
    } catch (e) {
      console.error("Error deleting workflow", e);
    }
  };

  // 4. Action: Admin update tool specifications
  const handleUpdateTool = async (tool: Tool) => {
    try {
      const res = await fetch('/api/tools/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tool)
      });
      if (res.ok) {
        fetchTools();
      }
    } catch (e) {
      console.error("Error updating tool details", e);
    }
  };

  // 5. Action: Admin reset default catalogue
  const handleResetTools = async () => {
    try {
      const res = await fetch('/api/tools/reset', { method: 'POST' });
      if (res.ok) {
        fetchTools();
      }
    } catch (e) {
      console.error("Error resetting tool catalogue", e);
    }
  };

  // 6. Action: Replace a tool inside a step dynamically (client-side)
  const handleReplaceToolInStep = (stepId: string, newToolSlug: string) => {
    if (!activeWorkflow) return;

    const chosenTool = toolsList.find(t => t.slug === newToolSlug);
    if (!chosenTool) return;

    const updatedSteps = activeWorkflow.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          toolId: chosenTool.id,
          toolSlug: chosenTool.slug,
          toolName: chosenTool.name,
          toolLogo: chosenTool.logo_url,
          toolCategory: chosenTool.category,
          whySelected: `Swapped to ${chosenTool.name}. Best suited for ${chosenTool.best_for}.`,
          estimatedCost: chosenTool.free_plan_available ? "Free" : `${chosenTool.pricing_currency} ${chosenTool.starting_monthly_price}/mo`,
          isFree: chosenTool.free_plan_available,
          limitationNotes: chosenTool.not_recommended_for ? [chosenTool.not_recommended_for] : []
        };
      }
      return step;
    });

    // Recompute price summaries
    let minCost = 0;
    updatedSteps.forEach(s => {
      const t = toolsList.find(tool => tool.id === s.toolId);
      if (t && t.starting_monthly_price) {
        minCost += t.starting_monthly_price;
      }
    });

    setActiveWorkflow({
      ...activeWorkflow,
      steps: updatedSteps,
      estimatedCostMin: minCost,
      estimatedCostMax: minCost > 0 ? Math.round(minCost * 1.2) : 500
    });
  };

  // 7. Action: Transform / Optimize workflow via Backend API strategies
  const handleOptimizeWorkflow = async (action: 'free' | 'no-code' | 'powerful' | 'privacy') => {
    if (!activeWorkflow) return;

    try {
      const res = await fetch('/api/workflow/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: activeWorkflow,
          action
        })
      });

      if (res.ok) {
        const optimized: Workflow = await res.json();
        setActiveWorkflow(optimized);
      }
    } catch (e) {
      console.error("Error optimizing workflow", e);
    }
  };

  // Select preset quick prompts
  const selectQuickPrompt = (prompt: string) => {
    setGoalText(prompt);
    handleGenerate(prompt);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
      {/* Mobile Top Header (hidden on desktop) */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-slate-100 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
            🤖
          </div>
          <span className="font-bold text-slate-800 text-sm tracking-tight">AI Workflow Engine</span>
          {isHydrated && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 animate-pulse">
              Client active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg focus:outline-none cursor-pointer"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu Overlay Drawer */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex justify-end"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-64 bg-white h-full flex flex-col justify-between p-5 shadow-2xl"
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs">🤖</div>
                  <span className="font-bold text-slate-800 text-sm">Navigation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Mobile Drawer Menu Links */}
              <nav className="flex flex-col gap-1.5">
                {[
                  { id: 'home', label: 'Home', icon: '🏠' },
                  { id: 'builder', label: 'Workflow Builder', icon: '🧩' },
                  { id: 'templates', label: 'Templates', icon: '📋' },
                  { id: 'saved', label: 'Saved Workflows', icon: '💾', badge: savedWorkflows.length },
                  { id: 'library', label: 'Tool Library', icon: '📚' },
                  { id: 'integrations', label: 'Integrations', icon: '🔗' },
                  { id: 'settings', label: 'Settings', icon: '⚙️' },
                ].map((item) => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-600 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base leading-none">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="border-t border-slate-100 pt-4 text-center">
              <span className="text-[10px] text-slate-400 font-medium">© 2026 AI Workflow Engine</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Interactive Sidebar */}
      <Sidebar currentTab={currentTab} setTab={setTab} savedCount={savedWorkflows.length} />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 2. Unified top bar (hidden on mobile) */}
        <div className="hidden md:block">
          <Header onSearch={setSearchVal} searchVal={searchVal} />
        </div>

        {/* 3. Nested page views */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'home' && (
            <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
              {/* Home Header */}
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center justify-center md:justify-start gap-2">
                  Let's build your workflow ✨
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Describe your business automation goal and we'll design the most cost-effective and highly compatible AI toolchain checklist.
                </p>
              </div>

              {/* Error banner */}
              {errorBanner && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 text-left">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-800">Generation Failed</h4>
                    <p className="text-[11px] text-rose-700 mt-1">{errorBanner}</p>
                  </div>
                </div>
              )}

              {/* Goal Input Dashboard Card */}
              <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600">What are you trying to accomplish?</label>
                  <div className="relative">
                    <textarea
                      id="input-workflow-goal"
                      rows={3}
                      placeholder="I want to create LinkedIn posts from AI news every morning."
                      value={goalText}
                      onChange={(e) => setGoalText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pb-16 md:pb-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder-slate-400 resize-none font-medium leading-relaxed"
                    />
                    <button
                      id="btn-generate-workflow"
                      onClick={() => handleGenerate()}
                      disabled={isGenerating}
                      className="absolute right-4 bottom-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer select-none transition-all"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Designing...
                        </>
                      ) : (
                        <>
                          <span>✦</span>
                          Generate Workflow
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Presets row */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Or try an automated blueprint preset</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => selectQuickPrompt("I want to create LinkedIn posts from AI news every morning.")}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-[11px] text-slate-600 font-medium rounded-lg transition-all cursor-pointer"
                    >
                      📝 Daily LinkedIn AI Writer
                    </button>
                    <button
                      onClick={() => selectQuickPrompt("I want to find suitable developer jobs, tailor my resume, and log applications.")}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-[11px] text-slate-600 font-medium rounded-lg transition-all cursor-pointer"
                    >
                      💼 Resume Application Tailoring
                    </button>
                    <button
                      onClick={() => selectQuickPrompt("I want to automatically respond to common customer reviews and emailweekly complaints report.")}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-[11px] text-slate-600 font-medium rounded-lg transition-all cursor-pointer"
                    >
                      📊 Customer Reviews Analyzer
                    </button>
                  </div>
                </div>

                {/* Preference select sliders */}
                <div className="border-t border-slate-50 pt-5 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Budget */}
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Max Budget</label>
                    <select
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                    >
                      <option value="free">₹0 (Free Tools Only)</option>
                      <option value="limited">Limited (₹0 - ₹2,000)</option>
                      <option value="flexible">Flexible Budget</option>
                    </select>
                  </div>

                  {/* Skill level */}
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Your Skill Level</label>
                    <select
                      value={skill}
                      onChange={(e) => setSkill(e.target.value)}
                      className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                    >
                      <option value="non_technical">Non-technical (No-code)</option>
                      <option value="beginner">Beginner Developer</option>
                      <option value="developer">Advanced Developer</option>
                    </select>
                  </div>

                  {/* Automation */}
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Automation Grade</label>
                    <select
                      value={automation}
                      onChange={(e) => setAutomation(e.target.value)}
                      className="bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                    >
                      <option value="assisted">Human Approval Gate</option>
                      <option value="mostly_automated">Mostly Automated</option>
                      <option value="fully_automated">Fully Autonomous</option>
                    </select>
                  </div>

                  {/* Checkbox */}
                  <div className="flex items-center gap-2.5 h-full pt-4 pl-1">
                    <input
                      type="checkbox"
                      id="chk-free-only"
                      checked={freeToolsOnly}
                      onChange={(e) => {
                        setFreeToolsOnly(e.target.checked);
                        if (e.target.checked) setBudget('free');
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="chk-free-only" className="text-xs font-semibold text-slate-600 cursor-pointer">
                      Filter Free Plans Only
                    </label>
                  </div>
                </div>
              </div>

              {/* Unified recommendations list scroll anchor */}
              <div id="workflow-result-anchor"></div>

              {/* Rendering Active result timeline if generated */}
              {activeWorkflow ? (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recommended Toolchain Architecture</h3>
                    <button
                      onClick={() => setActiveWorkflow(null)}
                      className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer font-semibold"
                    >
                      ✕ Clear Result
                    </button>
                  </div>
                  <WorkflowResult
                    workflow={activeWorkflow}
                    setWorkflow={setActiveWorkflow}
                    onSave={handleSaveWorkflow}
                    onReplaceTool={handleReplaceToolInStep}
                    onOptimize={handleOptimizeWorkflow}
                    toolsCatalogue={toolsList}
                  />
                </div>
              ) : isGenerating ? (
                /* Skeleton Loader */
                <div className="bg-white border border-slate-100 rounded-3xl p-8 flex flex-col gap-4 shadow-sm animate-pulse">
                  <div className="h-6 bg-slate-100 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-100 rounded w-2/3 mt-2"></div>
                  <div className="flex flex-col gap-3 mt-4">
                    <div className="h-16 bg-slate-100/80 rounded-2xl"></div>
                    <div className="h-16 bg-slate-100/80 rounded-2xl"></div>
                    <div className="h-16 bg-slate-100/80 rounded-2xl"></div>
                  </div>
                </div>
              ) : (
                /* Static placeholder */
                <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-lg">
                    ✨
                  </div>
                  <h3 className="font-semibold text-slate-700 text-xs">Waiting for your automation goal</h3>
                  <p className="text-[11px] text-slate-400 max-w-sm leading-normal">
                    Describe what you want to achieve or pick a preset above to witness the compiler evaluate and design your custom stack.
                  </p>
                </div>
              )}

              {/* Proactive Value propositions footer */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="bg-white p-4 border border-slate-100/60 rounded-2xl flex flex-col items-center sm:items-start text-center sm:text-left gap-2 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">⏰</div>
                  <h4 className="text-xs font-bold text-slate-800 leading-none">Save 10+ Hours/Wk</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Automate repetitive data collection, generation, and posting triggers.</p>
                </div>
                <div className="bg-white p-4 border border-slate-100/60 rounded-2xl flex flex-col items-center sm:items-start text-center sm:text-left gap-2 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs">💰</div>
                  <h4 className="text-xs font-bold text-slate-800 leading-none">Cost Effective</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Prioritizes robust free plans and minimal pay-as-you-go APIs.</p>
                </div>
                <div className="bg-white p-4 border border-slate-100/60 rounded-2xl flex flex-col items-center sm:items-start text-center sm:text-left gap-2 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 font-bold text-xs">🧩</div>
                  <h4 className="text-xs font-bold text-slate-800 leading-none">No-Code Friendly</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Detailed step-by-step actions designed for non-technical users.</p>
                </div>
                <div className="bg-white p-4 border border-slate-100/60 rounded-2xl flex flex-col items-center sm:items-start text-center sm:text-left gap-2 shadow-xs">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-xs">🔒</div>
                  <h4 className="text-xs font-bold text-slate-800 leading-none">Safe Connectors</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Highlights privacy alerts, data retention policies, and token protection.</p>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'builder' && (
            <WorkflowBuilderView
              tools={toolsList}
              onLoadCustomWorkflow={(wf) => {
                setActiveWorkflow(wf);
                setTab('home');
              }}
            />
          )}

          {currentTab === 'templates' && (
            <TemplatesView
              onSelectTemplate={(tpl) => {
                setActiveWorkflow(tpl);
                setTab('home');
                // smooth scroll down
                setTimeout(() => {
                  document.getElementById('workflow-result-anchor')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
            />
          )}

          {currentTab === 'saved' && (
            <SavedWorkflowsView
              workflows={savedWorkflows}
              onSelect={(wf) => {
                setActiveWorkflow(wf);
                setTab('home');
                setTimeout(() => {
                  document.getElementById('workflow-result-anchor')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              onDelete={handleDeleteSavedWorkflow}
            />
          )}

          {currentTab === 'library' && (
            <ToolLibrary
              tools={toolsList}
              onUpdateTool={handleUpdateTool}
              onResetTools={handleResetTools}
            />
          )}

          {currentTab === 'integrations' && (
            <IntegrationsView />
          )}

          {currentTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>
    </div>
  );
}
