"use client";

import { useSidebar } from "./SidebarContext";
import SidebarNav from "./SidebarNav";

export function Sidebar() {
  const { open, setOpen } = useSidebar();

  return (
    <>
      {/* Overlay when sidebar open on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-64 transform border-r border-pitch-gray-dark bg-pitch-bg transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-pitch-gray-dark px-4 md:justify-start">
          <span className="font-bold text-pitch-accent">PITCH_2</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden"
            aria-label="Chiudi menu"
          >
            <svg className="h-6 w-6 text-pitch-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <SidebarNav collapsed={false} />
        </div>
      </aside>
    </>
  );
}
