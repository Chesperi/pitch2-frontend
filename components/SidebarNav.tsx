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
    label: "My assignments",
    icon: CalendarCheck,
    pageKey: "le_mie_assegnazioni",
  },
  { href: "/eventi", label: "Events", icon: Zap, pageKey: "eventi" },
  {
    href: "/designazioni",
    label: "Assignments",
    icon: Users,
    pageKey: "designazioni",
  },
  {
    href: "/accrediti",
    label: "Accreditations",
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
    label: "Summary",
    icon: BarChart2,
    pageKey: "consuntivo",
  },
  {
    href: "/cronologia",
    label: "History",
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

/** Campo da calcio stilizzato per header sidebar (linee bianche su sfondo nero). */
function FootballFieldSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="2" stroke="white" strokeWidth="1.5" />
      <line x1="16" y1="1" x2="16" y2="31" stroke="white" strokeWidth="1" />
      <circle cx="16" cy="16" r="5" stroke="white" strokeWidth="1" />
      <path d="M1 10 Q8 16 1 22" stroke="white" strokeWidth="1" fill="none" />
      <path d="M31 10 Q24 16 31 22" stroke="white" strokeWidth="1" fill="none" />
      <rect x="1" y="12" width="4" height="8" stroke="white" strokeWidth="1" fill="none" />
      <rect x="27" y="12" width="4" height="8" stroke="white" strokeWidth="1" fill="none" />
    </svg>
  );
}

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
    <nav className="flex flex-col" style={{ background: "#000000" }}>
      {collapsed ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 56,
              boxSizing: "border-box",
              borderBottom: "1px solid #2a2a2a",
            }}
          >
            <FootballFieldSvg size={32} />
          </div>
          <div className="flex flex-col gap-1 px-3 py-3">
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
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 56,
              boxSizing: "border-box",
              paddingLeft: 16,
              paddingRight: 16,
              borderBottom: "1px solid #2a2a2a",
            }}
          >
            <FootballFieldSvg size={28} />
          </div>
          <div className="flex flex-col gap-1 px-3 py-3">
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
          </div>
        </>
      )}
    </nav>
  );
}
