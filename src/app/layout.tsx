import React from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Workflow Engine',
  description: 'Deterministic tool-ranking and workflow generation compiler engine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50/50">
        {children}
      </body>
    </html>
  );
}
