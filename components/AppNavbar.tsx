"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { logoutPitch2 } from "@/lib/auth/pitch2Session";
import { useTheme } from "@/lib/hooks/useTheme";

type AppNavbarProps = {
  userName: string;
  userEmail: string;
  userInitials: string;
  pendingCount: number;
  centerContent?: ReactNode;
  onBellClick?: () => void;
};

export default function AppNavbar({
  userName,
  userEmail,
  userInitials,
  pendingCount,
  centerContent,
  onBellClick,
}: AppNavbarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocumentMouseDown(ev: MouseEvent): void {
      if (!isUserMenuOpen) return;
      const target = ev.target;
      if (!(target instanceof Node)) return;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
    };
  }, [isUserMenuOpen]);

  async function handleLogout(): Promise<void> {
    try {
      await logoutPitch2();
    } finally {
      router.push("/login");
    }
  }

  return (
    <header
      className="relative z-30 sticky top-0"
      style={{ background: "var(--pitch-navbar-bg)" }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 sm:px-6"
        style={{
          height: 56,
          boxSizing: "border-box",
          borderBottom: "1px solid var(--pitch-navbar-border)",
          background: "var(--pitch-navbar-bg)",
        }}
      >
        <div
          className="flex min-w-0 shrink items-center gap-2"
          style={{ paddingLeft: 0, marginLeft: 0 }}
        >
          <div
            className="flex items-center"
            style={{
              marginLeft: 0,
              fontFamily: "'DAZNOscine', 'Arial Black', Arial, sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: "#fff",
              lineHeight: 1,
            }}
          >
            <span style={{ color: "#fff" }}>P</span>
            <span style={{ color: "#FFFA00" }}>/</span>
            <span style={{ color: "#fff" }}>TCH</span>
          </div>
          <span style={{ color: "#3F4547", fontSize: 14, margin: "0 10px" }}>
            ×
          </span>
          <img
            src="/DAZN_BoxedLogo.jpg"
            alt="DAZN"
            style={{ height: "28px", width: "auto", display: "block" }}
          />
          {centerContent ? (
            <>
              <div className="h-6 w-px" style={{ background: "#2a2a2a" }} />
              {centerContent}
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded p-2 transition-colors hover:bg-white/10"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun
                size={16}
                strokeWidth={1.5}
                style={{ color: "var(--pitch-text-secondary)" }}
              />
            ) : (
              <Moon
                size={16}
                strokeWidth={1.5}
                style={{ color: "var(--pitch-text-secondary)" }}
              />
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={onBellClick}
              className="rounded-full p-1 transition-colors duration-150 ease-out hover:bg-white/10"
              aria-label="Vai alle azioni richieste"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="h-5 w-5"
                style={{ color: "#fff" }}
              >
                <path
                  d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {pendingCount > 0 ? (
              <span
                className="absolute -right-2 -top-2 min-w-5 rounded-full px-1 text-center text-[10px] font-bold"
                style={{ background: "#E24B4A", color: "#fff" }}
              >
                {pendingCount}
              </span>
            ) : null}
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((s) => !s)}
              className="flex items-center gap-2"
            >
              <div className="hidden text-right sm:block">
                <div className="text-sm text-white">{userName || "Utente"}</div>
              </div>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: "#FFFA00", color: "#000" }}
              >
                {userInitials || "?"}
              </div>
            </button>
            {isUserMenuOpen ? (
              <div
                className="absolute right-0 mt-2 min-w-[220px] rounded-lg border p-2 shadow-xl"
                style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}
              >
                <div className="px-2 py-1 text-sm font-bold text-white">
                  {userName || "Utente"}
                </div>
                <div className="px-2 pb-2 text-xs" style={{ color: "#fff" }}>
                  {userEmail || "Email non disponibile"}
                </div>
                <div className="my-1 h-px" style={{ background: "#2a2a2a" }} />
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="w-full rounded px-2 py-1 text-left text-sm hover:bg-black/30"
                  style={{ color: "#E24B4A" }}
                >
                  Esci
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
