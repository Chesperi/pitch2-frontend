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
  MessageSquare,
  LayoutTemplate,
  CalendarDays,
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
  { href: "/vision", label: "Vision", icon: LayoutTemplate, pageKey: "vision" },
  {
    href: "/media-scheduler",
    label: "Scheduler",
    icon: CalendarDays,
    pageKey: "editing_scheduler",
  },
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
    label: "Scorecard",
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
  /** Called after navigating (e.g. close mobile drawer). */
  onNavigate?: () => void;
  onMobileClose?: () => void;
};

type AuthMeSidebar = {
  user_level?: string;
  sergio_access?: boolean;
};

/** Campo da calcio stilizzato per header sidebar (linee bianche su sfondo nero). */
function FootballFieldSvg() {
  return (
    <svg
      className="h-8 w-8 shrink-0 text-[color:var(--pitch-text)]"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="1" x2="16" y2="31" stroke="currentColor" strokeWidth="1" />
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1" />
      <path d="M1 10 Q8 16 1 22" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M31 10 Q24 16 31 22" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="1" y="12" width="4" height="8" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="27" y="12" width="4" height="8" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

export default function SidebarNav({
  collapsed,
  onNavigate,
  onMobileClose,
}: SidebarNavProps) {
  const pathname = usePathname();
  const { loading, levelByPageKey } = usePagePermissions();
  const [meLevelUpper, setMeLevelUpper] = useState<string | null>(null);
  const [sergioAccess, setSergioAccess] = useState(false);
  const [meReady, setMeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = (await fetchAuthMe()) as AuthMeSidebar;
        if (!cancelled) {
          setMeLevelUpper((me.user_level ?? "").toUpperCase().trim());
          const isMaster = String(me.user_level ?? "").toUpperCase().trim() === "MASTER";
          setSergioAccess(isMaster || Boolean(me.sergio_access));
        }
      } catch {
        if (!cancelled) {
          setMeLevelUpper(null);
          setSergioAccess(false);
        }
      } finally {
        if (!cancelled) setMeReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = useMemo(() => {
    const items = NAV_ITEMS.filter((item) =>
      isNavItemVisible(item, loading, levelByPageKey, meLevelUpper, meReady)
    );
    if (sergioAccess) {
      items.push({
        href: "/sergio",
        label: "Sergio",
        icon: MessageSquare,
      });
    }
    return items;
  }, [loading, levelByPageKey, meLevelUpper, meReady, sergioAccess]);

  return (
    <nav
      className="flex min-h-screen flex-col"
      style={{ background: "var(--pitch-sidebar-bg)" }}
    >
      <div
        className="relative flex h-14 shrink-0 items-center"
        style={{
          background: "var(--pitch-sidebar-bg)",
          borderBottom: "1px solid var(--pitch-sidebar-border)",
        }}
      >
        <div className="flex h-14 w-16 shrink-0 items-center justify-center">
          <FootballFieldSvg />
        </div>
        {onMobileClose ? (
          <button
            type="button"
            className={`absolute right-3 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-[color:var(--pitch-sidebar-text)] transition-opacity duration-300 hover:bg-[var(--pitch-border-subtle)] hover:text-[color:var(--pitch-text)] md:hidden ${
              collapsed ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
            aria-label="Chiudi menu"
            onClick={onMobileClose}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        ) : null}
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
              onClick={() => onNavigate?.()}
              className={`flex h-10 shrink-0 items-center rounded-lg transition-colors ${
                collapsed
                  ? "justify-center px-2"
                  : "justify-start gap-3 px-3 text-sm font-medium"
              } ${
                isActive
                  ? "bg-[var(--pitch-border-subtle)] text-[color:var(--pitch-sidebar-active)]"
                  : "bg-transparent text-[color:var(--pitch-sidebar-text)] hover:bg-[var(--pitch-border-subtle)] hover:text-[color:var(--pitch-text)]"
              }`}
            >
              <Icon size={20} stroke="currentColor" className="shrink-0" />
              <span
                className={`min-w-0 whitespace-nowrap overflow-hidden transition-opacity duration-300 ${
                  collapsed ? "w-0 opacity-0" : "opacity-100"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
