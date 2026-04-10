"use client";

import { useEffect, useState } from "react";
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
  const [isFreelance, setIsFreelance] = useState(false);
  const [userName, setUserName] = useState("Utente");
  const [userEmail, setUserEmail] = useState("Email non disponibile");
  const [userInitials, setUserInitials] = useState("?");

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
          setUserEmail(me.email?.trim() || "Email non disponibile");
          setUserInitials(getInitials(me.name ?? "", me.surname ?? ""));
        }
      } catch {
        if (!cancelled) {
          setIsFreelance(false);
          setUserName("Utente");
          setUserEmail("Email non disponibile");
          setUserInitials("?");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      {!isFreelance ? (
        <aside
          className={`transition-all duration-200 border-r flex-shrink-0 ${
            collapsed ? "w-16" : "w-64"
          }`}
          style={{
            background: "#000000",
            color: "#FFFFFF",
            borderColor: "#2a2a2a",
          }}
          onMouseEnter={() => setCollapsed(false)}
          onMouseLeave={() => setCollapsed(true)}
        >
          <SidebarNav collapsed={collapsed} />
        </aside>
      ) : null}
      <div className="flex flex-1 flex-col min-w-0">
        <AppNavbar
          userName={userName}
          userEmail={userEmail}
          userInitials={userInitials}
          pendingCount={0}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
