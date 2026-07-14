"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';

interface HeaderProps {
  onSearch: (q: string) => void;
  searchVal: string;
}

export default function Header({ onSearch, searchVal }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-100 bg-white px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
      {/* Search Bar */}
      <div className="relative w-96 max-w-lg">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          id="search-header"
          placeholder="Search workflows, tools, templates..."
          value={searchVal}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-slate-50 border-0 rounded-lg pl-10 pr-12 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder-slate-400"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-white px-1.5 py-0.5 border border-slate-200 rounded text-[10px] text-slate-400 font-medium">
          ⌘ K
        </div>
      </div>

      {/* Profile and Action Items */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button className="relative p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
        </button>

        {/* Vertical Separator */}
        <div className="w-px h-5 bg-slate-100"></div>

        {/* Profile Dropdown */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
            R
          </div>
          <div className="text-left shrink-0">
            <div className="text-xs font-semibold text-slate-800 leading-tight">Rohit</div>
            <div className="text-[10px] text-slate-400">Junior Architect</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
}
