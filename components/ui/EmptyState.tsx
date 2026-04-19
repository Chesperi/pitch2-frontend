"use client";

import PrimaryButton from "@/components/ui/PrimaryButton";

export type EmptyStateIcon = "document" | "calendar" | "search" | "list";

type EmptyStateProps = {
  message: string;
  icon?: EmptyStateIcon;
  action?: { label: string; onClick: () => void };
};

const ICON_PATH: Record<EmptyStateIcon, string> = {
  list: "M4 6h16M4 10h16M4 14h16M4 18h16",
  document:
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  calendar:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
};

export default function EmptyState({
  message,
  icon = "list",
  action,
}: EmptyStateProps) {
  const d = ICON_PATH[icon];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10 text-pitch-gray-light"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d={d}
        />
      </svg>
      <p className="text-sm text-pitch-gray-light">{message}</p>
      {action ? (
        <PrimaryButton
          type="button"
          variant="secondary"
          onClick={action.onClick}
        >
          {action.label}
        </PrimaryButton>
      ) : null}
    </div>
  );
}
