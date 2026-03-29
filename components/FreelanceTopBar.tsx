"use client";

import type { UserProfile } from "@/lib/api/freelanceAssignments";

type FreelanceTopBarProps = {
  title: string;
  user: UserProfile | null;
  userLoading?: boolean;
};

function initials(name: string, surname: string): string {
  const a = name.trim().charAt(0).toUpperCase();
  const b = surname.trim().charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  if (a) return a + (surname.trim().charAt(1)?.toUpperCase() || "");
  return "—";
}

export default function FreelanceTopBar({
  title,
  user,
  userLoading,
}: FreelanceTopBarProps) {
  const displayName =
    user && (user.name || user.surname)
      ? `${user.name} ${user.surname}`.trim()
      : null;

  return (
    <header className="sticky top-0 z-40 border-b border-pitch-gray-dark bg-black">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="flex h-8 w-14 items-center justify-center rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 text-[10px] font-semibold uppercase tracking-wide text-pitch-gray-light"
            aria-hidden
          >
            PITCH
          </span>
          <span
            className="flex h-8 w-14 items-center justify-center rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 text-[10px] font-semibold uppercase tracking-wide text-pitch-gray-light"
            aria-hidden
          >
            DAZN
          </span>
        </div>

        <h1 className="min-w-0 flex-1 text-center text-xs font-semibold tracking-wide text-pitch-white sm:text-sm md:text-base">
          {title}
        </h1>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-pitch-gray-dark text-pitch-gray-light hover:bg-pitch-gray-dark/50"
            aria-label="Notifiche"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>

          {userLoading ? (
            <span className="text-xs text-pitch-gray">…</span>
          ) : displayName ? (
            <>
              <span className="hidden max-w-[140px] truncate text-right text-xs text-pitch-gray-light sm:inline md:max-w-[200px] md:text-sm">
                {displayName}
              </span>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pitch-gray-dark text-xs font-semibold text-pitch-accent"
                title={displayName ?? undefined}
              >
                {user
                  ? initials(user.name, user.surname)
                  : "—"}
              </div>
            </>
          ) : (
            <span className="text-xs text-pitch-gray">—</span>
          )}
        </div>
      </div>
    </header>
  );
}
