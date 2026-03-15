"use client";

import { useState } from "react";
import SidebarNav from "@/components/SidebarNav";
import TopBar from "@/components/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`bg-pitch-bg text-pitch-white transition-all duration-200 border-r border-pitch-gray-dark flex-shrink-0 ${
          collapsed ? "w-16" : "w-64"
        }`}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
      >
        <SidebarNav collapsed={collapsed} />
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
