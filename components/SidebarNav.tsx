"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon?: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/le-mie-assegnazioni", label: "Le mie assegnazioni", short: "As" },
  { href: "/eventi", label: "Eventi", short: "Ev" },
  { href: "/designazioni", label: "Designazioni", short: "Ds" },
  { href: "/accrediti", label: "Accrediti", short: "Ac" },
  { href: "/call-sheet", label: "Call sheet", short: "CS" },
  { href: "/database", label: "Database", short: "DB" },
  { href: "/consuntivo", label: "Consuntivo", short: "Co" },
  { href: "/cronologia", label: "Cronologia", short: "Cr" },
  { href: "/master", label: "Master", short: "Ma" },
];

type SidebarNavProps = {
  collapsed: boolean;
};

export default function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {collapsed ? (
        <>
          <div className="mb-4 flex h-10 items-center justify-center border-b border-pitch-gray-dark pb-3">
            <span className="text-xs font-bold text-pitch-accent">P2</span>
          </div>
          {NAV_ITEMS.map((item) => {
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
          {NAV_ITEMS.map((item) => {
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
