"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";

const LINKS = [
  { href: "/le-mie-assegnazioni", label: "Le mie assegnazioni" },
  { href: "/eventi", label: "Eventi" },
  { href: "/designazioni", label: "Designazioni" },
  { href: "/accrediti", label: "Accrediti" },
  { href: "/database", label: "Database" },
  { href: "/call-sheet", label: "Call sheet" },
  { href: "/consuntivo", label: "Consuntivo" },
  { href: "/cronologia", label: "Cronologia" },
  { href: "/master", label: "Master" },
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
  const [displayName, setDisplayName] = useState("User");
  const [avatarInitials, setAvatarInitials] = useState("U");

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

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-pitch-gray-dark bg-pitch-bg px-4 py-3 md:px-6">
      <div className="flex items-center gap-2 font-bold text-pitch-accent shrink-0">
        PITCH_2
      </div>
      {/* Desktop: centered shortcut bar */}
      <nav className="hidden md:flex flex-1 items-center justify-center gap-4">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-pitch-gray-light hover:text-pitch-accent transition-colors whitespace-nowrap"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {/* Mobile: horizontal scroll shortcut bar */}
      <nav className="flex md:hidden flex-1 items-center gap-3 overflow-x-auto min-w-0 -mx-2 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-pitch-gray-light hover:text-pitch-accent transition-colors whitespace-nowrap shrink-0"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pitch-gray-dark text-pitch-gray text-xs">
          {avatarInitials}
        </div>
        <span className="hidden text-sm text-pitch-gray-light sm:inline">
          {displayName}
        </span>
      </div>
    </header>
  );
}
