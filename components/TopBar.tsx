"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { logoutPitch2 } from "@/lib/auth/pitch2Session";
import {
  usePagePermissions,
  isDashboardPageNavVisible,
} from "@/hooks/usePagePermissions";

const TOPBAR_LINKS: { href: string; label: string; pageKey: string }[] = [
  {
    href: "/le-mie-assegnazioni",
    label: "Le mie assegnazioni",
    pageKey: "le_mie_assegnazioni",
  },
  { href: "/eventi", label: "Eventi", pageKey: "eventi" },
  { href: "/designazioni", label: "Designazioni", pageKey: "designazioni" },
  { href: "/accrediti", label: "Accrediti", pageKey: "accrediti" },
  { href: "/database", label: "Database", pageKey: "database" },
  { href: "/call-sheet", label: "Call sheet", pageKey: "call_sheet" },
  { href: "/consuntivo", label: "Scorecard", pageKey: "consuntivo" },
  { href: "/cronologia", label: "Cronologia", pageKey: "cronologia" },
  { href: "/master", label: "Master", pageKey: "master" },
];

function initialsFromNameSurname(name: string, surname: string): string {
  const a = name.trim().charAt(0).toUpperCase();
  const b = surname.trim().charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  if (a) return a;
  if (b) return b;
  return "U";
}

export default function TopBar() {
  const router = useRouter();
  const { loading: permissionsLoading, levelByPageKey } = usePagePermissions();
  const [displayName, setDisplayName] = useState("User");
  const [avatarInitials, setAvatarInitials] = useState("U");
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleTopLinks = useMemo(
    () =>
      TOPBAR_LINKS.filter((link) =>
        isDashboardPageNavVisible(
          link.pageKey,
          permissionsLoading,
          levelByPageKey
        )
      ),
    [permissionsLoading, levelByPageKey]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        if (cancelled) return;
        const label = `${me.name} ${me.surname}`.trim();
        if (label) {
          setDisplayName(label);
          setAvatarInitials(initialsFromNameSurname(me.name, me.surname));
        }
      } catch {
        if (!cancelled) {
          setDisplayName("User");
          setAvatarInitials("U");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setLogoutBusy(true);
    setMenuOpen(false);
    try {
      await logoutPitch2();
    } finally {
      setLogoutBusy(false);
      router.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-pitch-gray-dark bg-pitch-bg px-4 py-3 md:px-6">
      <div className="flex items-center gap-2 font-bold text-pitch-accent shrink-0">
        PITCH_2
      </div>
      {/* Desktop: centered shortcut bar */}
      <nav className="hidden md:flex flex-1 items-center justify-center gap-4">
        {visibleTopLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-pitch-gray-light transition-colors duration-150 ease-out hover:text-pitch-accent whitespace-nowrap"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {/* Mobile: horizontal scroll shortcut bar */}
      <nav className="flex md:hidden flex-1 items-center gap-3 overflow-x-auto min-w-0 -mx-2 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {visibleTopLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-pitch-gray-light transition-colors duration-150 ease-out hover:text-pitch-accent whitespace-nowrap shrink-0"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={logoutBusy}
          className="flex max-w-[14rem] items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left transition-colors duration-150 ease-out hover:border-pitch-gray-dark hover:bg-pitch-gray-dark/40 disabled:cursor-not-allowed disabled:opacity-50"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Menu utente"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch-gray-dark text-xs text-pitch-gray">
            {avatarInitials}
          </span>
          <span className="hidden min-w-0 truncate text-sm text-pitch-gray-light sm:inline">
            {displayName}
          </span>
          <svg
            className={`hidden h-4 w-4 shrink-0 text-pitch-gray sm:block ${menuOpen ? "rotate-180" : ""} transition-transform duration-200 ease-out`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-pitch-gray-dark bg-pitch-bg py-1 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              disabled={logoutBusy}
              className="w-full px-4 py-2 text-left text-sm text-pitch-gray-light hover:bg-pitch-gray-dark hover:text-pitch-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {logoutBusy ? "Uscita…" : "Logout"}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
