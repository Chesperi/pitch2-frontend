"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  usePagePermissions,
  type PageAccessLevel,
} from "@/hooks/usePagePermissions";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon?: React.ReactNode;
  /** Se assente, la voce è sempre visibile. Se presente, controllata da /api/me/permissions */
  pageKey?: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/le-mie-assegnazioni",
    label: "Le mie assegnazioni",
    short: "As",
    pageKey: "le_mie_assegnazioni",
  },
  { href: "/eventi", label: "Eventi", short: "Ev", pageKey: "eventi" },
  {
    href: "/designazioni",
    label: "Designazioni",
    short: "Ds",
    pageKey: "designazioni",
  },
  { href: "/accrediti", label: "Accrediti", short: "Ac", pageKey: "accrediti" },
  {
    href: "/call-sheet",
    label: "Call sheet",
    short: "CS",
    pageKey: "call_sheet",
  },
  { href: "/database", label: "Database", short: "DB", pageKey: "database" },
  {
    href: "/cookies-jar",
    label: "Cookies jar",
    short: "CJ",
    pageKey: "cookies_jar",
  },
  {
    href: "/consuntivo",
    label: "Consuntivo",
    short: "Co",
    pageKey: "consuntivo",
  },
  {
    href: "/cronologia",
    label: "Cronologia",
    short: "Cr",
    pageKey: "cronologia",
  },
  { href: "/master", label: "Master", short: "Ma", pageKey: "master" },
];

function isNavItemVisible(
  item: NavItem,
  loading: boolean,
  levelByPageKey: Record<string, PageAccessLevel>
): boolean {
  if (loading) return true;
  if (!item.pageKey) return true;
  const level = levelByPageKey[item.pageKey];
  if (level === "none") return false;
  return true;
}

type SidebarNavProps = {
  collapsed: boolean;
};

export default function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();
  const { loading, levelByPageKey } = usePagePermissions();

  const visibleItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) =>
        isNavItemVisible(item, loading, levelByPageKey)
      ),
    [loading, levelByPageKey]
  );

  return (
    <nav className="flex flex-col gap-1 p-3">
      {collapsed ? (
        <>
          <div className="mb-4 flex h-10 items-center justify-center border-b border-pitch-gray-dark pb-3">
            <span className="text-xs font-bold text-pitch-accent">P2</span>
          </div>
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center justify-center rounded-lg px-2 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-pitch-gray-dark text-pitch-accent"
                    : "text-pitch-gray-light hover:bg-pitch-gray-dark hover:text-pitch-white"
                }`}
              >
                {item.short}
              </Link>
            );
          })}
        </>
      ) : (
        <>
          <div className="mb-4 border-b border-pitch-gray-dark px-3 pb-3">
            <span className="font-bold text-pitch-accent">PITCH_2</span>
          </div>
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-pitch-gray-dark text-pitch-accent"
                    : "text-pitch-gray-light hover:bg-pitch-gray-dark hover:text-pitch-white"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );
}
