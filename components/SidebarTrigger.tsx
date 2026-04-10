"use client";

import { useSidebar } from "./SidebarContext";

export function SidebarTrigger() {
  const { setOpen } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#FFFFFF] hover:bg-[#2a2a2a] md:hidden"
      style={{ background: "#1a1a1a" }}
      aria-label="Apri menu"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
