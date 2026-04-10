"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  Zap,
  Users,
  BadgeCheck,
  FileText,
  Database,
  CheckSquare,
  BarChart2,
  Clock,
  Settings,
  Monitor,
} from "lucide-react";
import {
  usePagePermissions,
  isDashboardPageNavVisible,
  type PageAccessLevel,
} from "@/hooks/usePagePermissions";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Se assente, la voce è sempre visibile. Se presente, controllata da /api/me/permissions */
  pageKey?: string;
  /** Se presente, visibile solo per questi `user_level` (es. MASTER, STAFF). */
  userLevels?: string[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/le-mie-assegnazioni",
    label: "Le mie assegnazioni",
    icon: CalendarCheck,
    pageKey: "le_mie_assegnazioni",
  },
  { href: "/eventi", label: "Eventi", icon: Zap, pageKey: "eventi" },
  {
    href: "/designazioni",
    label: "Designazioni",
    icon: Users,
    pageKey: "designazioni",
  },
  {
    href: "/accrediti",
    label: "Accrediti",
    icon: BadgeCheck,
    pageKey: "accrediti",
  },
  {
    href: "/call-sheet",
    label: "Call sheet",
    icon: FileText,
    pageKey: "call_sheet",
  },
  { href: "/database", label: "Database", icon: Database, pageKey: "database" },
  {
    href: "/cookies-jar",
    label: "Cookies jar",
    icon: CheckSquare,
    pageKey: "cookies_jar",
  },
  {
    href: "/consuntivo",
    label: "Consuntivo",
    icon: BarChart2,
    pageKey: "consuntivo",
  },
  {
    href: "/cronologia",
    label: "Cronologia",
    icon: Clock,
    pageKey: "cronologia",
  },
  { href: "/master", label: "Master", icon: Settings, pageKey: "master" },
  {
    href: "/leeds-tx",
    label: "Leeds TX",
    icon: Monitor,
    userLevels: ["MASTER", "STAFF"],
  },
];

function isNavItemVisible(
  item: NavItem,
  loadingPermissions: boolean,
  levelByPageKey: Record<string, PageAccessLevel>,
  meLevelUpper: string | null,
  meReady: boolean
): boolean {
  if (item.userLevels?.length) {
    if (!meReady) return false;
    const u = (meLevelUpper ?? "").trim();
    if (!u) return false;
    const allowed = item.userLevels.some(
      (l) => l.toUpperCase() === u.toUpperCase()
    );
    if (!allowed) return false;
  }

  return isDashboardPageNavVisible(
    item.pageKey,
    loadingPermissions,
    levelByPageKey
  );
}

type SidebarNavProps = {
  collapsed: boolean;
};

export default function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();
  const { loading, levelByPageKey } = usePagePermissions();
  const [meLevelUpper, setMeLevelUpper] = useState<string | null>(null);
  const [meReady, setMeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled) {
          setMeLevelUpper((me.user_level ?? "").toUpperCase().trim());
        }
      } catch {
        if (!cancelled) setMeLevelUpper(null);
      } finally {
        if (!cancelled) setMeReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) =>
        isNavItemVisible(item, loading, levelByPageKey, meLevelUpper, meReady)
      ),
    [loading, levelByPageKey, meLevelUpper, meReady]
  );

  return (
    <nav className="flex flex-col gap-1 p-3" style={{ background: "#000000" }}>
      {collapsed ? (
        <>
          <div
            className="mb-4 flex h-10 items-center justify-center pb-3"
            style={{ borderBottom: "1px solid #2a2a2a" }}
          >
            <span
              style={{
                fontFamily: "'Arial Black', Arial, sans-serif",
                fontWeight: 900,
                fontSize: 11,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              P<span style={{ color: "#FFFA00" }}>/</span>TCH
            </span>
          </div>
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center justify-center rounded-lg px-2 py-2.5 transition-colors hover:text-white ${
                  isActive
                    ? "bg-[#1a1a1a] text-[#FFFA00]"
                    : "bg-transparent text-[#868A8C] hover:bg-[#1a1a1a]"
                }`}
              >
                <Icon size={20} stroke="currentColor" />
              </Link>
            );
          })}
        </>
      ) : (
        <>
          <div
            className="mb-4 flex items-center px-3 pb-3"
            style={{ borderBottom: "1px solid #2a2a2a" }}
          >
            <span
              style={{
                fontFamily: "'Arial Black', Arial, sans-serif",
                fontWeight: 900,
                fontSize: 20,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              P<span style={{ color: "#FFFA00" }}>/</span>TCH
            </span>
            <span style={{ color: "#3F4547", fontSize: 14, margin: "0 10px" }}>
              ×
            </span>
            <img
              src="/DAZN_BoxedLogo.jpg"
              alt="DAZN"
              style={{ height: "20px", width: "auto", display: "block" }}
            />
          </div>
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:text-white ${
                  isActive
                    ? "bg-[#1a1a1a] text-[#FFFA00]"
                    : "bg-transparent text-[#868A8C] hover:bg-[#1a1a1a]"
                }`}
              >
                <Icon size={20} stroke="currentColor" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );
}
