"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, Compass, Layers, FolderHeart, Database, ShieldCheck, Settings, Award } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  savedCount: number;
}

export default function Sidebar({ currentTab, setTab, savedCount }: SidebarProps) {
  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'builder', label: 'Workflow Builder', icon: Compass },
    { id: 'templates', label: 'Templates', icon: Layers },
    { id: 'saved', label: 'Saved Workflows', icon: FolderHeart, badge: savedCount > 0 ? savedCount : undefined },
    { id: 'library', label: 'Tool Library', icon: Database },
    { id: 'integrations', label: 'Integrations', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside id="sidebar-panel" className="hidden md:flex w-64 bg-white border-r border-slate-100 flex-col justify-between h-screen sticky top-0 shrink-0">
      <div className="p-5 flex flex-col gap-6">
        {/* App Branding */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-200">
            🤖
          </div>
          <div>
            <h1 className="font-semibold text-slate-800 tracking-tight leading-tight">AI Workflow Engine</h1>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider">MVP</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`btn-nav-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50/70 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                     {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Clean Minimal Footer */}
      <div className="p-5 border-t border-slate-50">
        <span className="text-[11px] text-slate-400 font-medium">© 2026 AI Workflow Engine</span>
      </div>
    </aside>
  );
}
