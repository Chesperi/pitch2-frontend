"use client";

import { useEffect, useRef, useState } from "react";
import SidebarNav from "@/components/SidebarNav";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import AppNavbar from "@/components/AppNavbar";

function getInitials(name: string, surname: string): string {
  const a = name.trim().charAt(0).toUpperCase();
  const b = surname.trim().charAt(0).toUpperCase();
  return `${a || "?"}${b || ""}`;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isFreelance, setIsFreelance] = useState(false);
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("Email not available");
  const [userInitials, setUserInitials] = useState("?");
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isInside = false;

    const handleMouseMove = (e: MouseEvent) => {
      const sidebar = sidebarRef.current;
      if (!sidebar) return;
      const rect = sidebar.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (inside === isInside) return;
      isInside = inside;
      setCollapsed(!inside);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled) {
          const lvl = (me.user_level ?? "").toUpperCase().trim();
          setIsFreelance(lvl === "FREELANCE");
          const fullName = `${me.name ?? ""} ${me.surname ?? ""}`.trim();
          setUserName(fullName || "Utente");
          setUserEmail(me.email?.trim() || "Email not available");
          setUserInitials(getInitials(me.name ?? "", me.surname ?? ""));
        }
      } catch {
        if (!cancelled) {
          setIsFreelance(false);
          setUserName("User");
          setUserEmail("Email not available");
          setUserInitials("?");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navCollapsed = mobileOpen ? false : collapsed;

  return (
    <div className="relative min-h-screen">
      {!isFreelance ? (
        <>
          <div
            className={`fixed inset-0 z-20 bg-black/40 transition-opacity duration-300 ease-out md:hidden pointer-events-none ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0"}`}
            onClick={() => setMobileOpen(false)}
            aria-hidden={!mobileOpen}
          />
          <aside
            ref={sidebarRef}
            className={`fixed inset-y-0 left-0 z-20 h-screen w-64 overflow-y-auto border-r border-[#2a2a2a] bg-black text-white transition-[width,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:translate-x-0 ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            } ${collapsed ? "md:w-16" : "md:w-64 md:shadow-xl"}`}
            style={{
              color: "#FFFFFF",
            }}
          >
            <SidebarNav
              collapsed={navCollapsed}
              onNavigate={() => setMobileOpen(false)}
              onMobileClose={() => setMobileOpen(false)}
            />
          </aside>
        </>
      ) : null}
      <div
        className={`flex min-h-screen min-w-0 flex-col ${isFreelance ? "ml-0 w-full" : "ml-0 w-full md:ml-16 md:w-[calc(100%-4rem)]"}`}
      >
        <AppNavbar
          userName={userName}
          userEmail={userEmail}
          userInitials={userInitials}
          pendingCount={0}
        />
        {!isFreelance ? (
          <div
            className="flex items-center border-b border-[#2a2a2a] px-4 py-2 md:hidden"
            style={{ background: "#111" }}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white hover:bg-white/10"
              aria-label="Apri menu"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        ) : null}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
