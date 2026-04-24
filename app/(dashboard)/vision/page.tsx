"use client";

import NextLink from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchVisionProjects,
  type VisionEpisode,
  type VisionProject,
} from "@/lib/api/vision";

const ROW_HEIGHT = 72;

const TYPE_COLORS: Record<string, { pill: string; track: string; text: string }> = {
  Branded: {
    pill: "bg-[#1a1a2e] border border-[#818cf8]",
    track: "#818cf8",
    text: "text-[#818cf8]",
  },
  Platform: {
    pill: "bg-[#1a2e2e] border border-[#34d399]",
    track: "#34d399",
    text: "text-[#34d399]",
  },
  Editorial: {
    pill: "bg-[#2e1e0a] border border-[#fb923c]",
    track: "#fb923c",
    text: "text-[#fb923c]",
  },
  Betting: {
    pill: "bg-[#2e1a2e] border border-[#e879f9]",
    track: "#e879f9",
    text: "text-[#e879f9]",
  },
  default: {
    pill: "bg-[#1a1a1a] border border-[#444]",
    track: "#888",
    text: "text-[#888]",
  },
};

type TooltipState = {
  project: VisionProject;
  episode: VisionEpisode;
  x: number;
  y: number;
} | null;

type CalendarCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function isSameDay(epDateStr: string, year: number, month: number, day: number): boolean {
  const d = new Date(epDateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

function buildMonthGrid(monthStart: Date): CalendarCell[] {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      iso: toIsoDate(d),
      inMonth: d.getMonth() === monthStart.getMonth(),
    });
  }
  return cells;
}

function statusOpacity(ep: VisionEpisode): number {
  const s = ep.assignmentsStatus.toUpperCase();
  const st = ep.status.toUpperCase();
  if (s === "SENT" || s === "CONFIRMED" || st === "OK") return 0.45;
  if (s === "READY_TO_SEND") return 1;
  if (st === "CONFIRMED") return 0.8;
  return 0.3;
}

function projectColors(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default;
}

export default function VisionPage() {
  const [projects, setProjects] = useState<VisionProject[]>([]);
  const [view, setView] = useState<"gantt" | "calendar">("gantt");
  const [zoom, setZoom] = useState<"week" | "month" | "quarter">("month");
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const didSetInitialOffsetRef = useRef(false);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchVisionProjects();
        console.log("[Vision] projects loaded:", data.length, data);
        if (!cancelled) setProjects(data);
      } catch (error) {
        console.error(error);
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const distinctTypes = useMemo(() => {
    return [...new Set(projects.map((p) => p.type.trim()).filter((type) => type.length > 0))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [projects]);
  const typeFilterOptions = distinctTypes.length > 0 ? ["all", ...distinctTypes] : ["all"];

  const filteredProjects = useMemo(() => {
    if (typeFilter === "all") return projects;
    return projects.filter((p) => p.type === typeFilter);
  }, [projects, typeFilter]);

  const DAY_W = zoom === "week" ? 36 : zoom === "month" ? 28 : 14;
  const daysToShow = zoom === "week" ? 42 : zoom === "month" ? 84 : 168;
  const windowStart = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30 + offset);
  }, [today, offset]);
  const totalWidth = daysToShow * DAY_W;
  const totalHeight = filteredProjects.length * ROW_HEIGHT + 48;
  const navLabel = `${windowStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${new Date(windowStart.getTime() + (daysToShow - 1) * 86400000).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" }
  )}`;

  const xForDate = (dateStr: string): number => {
    const datePart = dateStr.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    const d = new Date(year, month - 1, day);

    const windowDatePart = windowStart.toISOString().split("T")[0];
    const [wy, wm, wd] = windowDatePart.split("-").map(Number);
    const w = new Date(wy, wm - 1, wd);

    return Math.round((d.getTime() - w.getTime()) / (1000 * 60 * 60 * 24)) * DAY_W;
  };

  const onTimelineScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!leftScrollRef.current) return;
    leftScrollRef.current.scrollTop = event.currentTarget.scrollTop;
  };

  const calendarCells = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);
  const allEpisodes = useMemo(() => {
    const rows: Array<{ project: VisionProject; ep: VisionEpisode }> = [];
    for (const project of filteredProjects) {
      for (const ep of project.episodes) {
        rows.push({ project, ep });
      }
    }
    return rows;
  }, [filteredProjects]);

  useEffect(() => {
    if (didSetInitialOffsetRef.current) return;
    if (projects.length === 0) return;
    const latestEpisodeTs = projects
      .flatMap((project) => project.episodes)
      .map((ep) => new Date(ep.date).getTime())
      .filter((ts) => Number.isFinite(ts))
      .sort((a, b) => b - a)[0];
    if (!latestEpisodeTs) return;
    const baseStart = new Date(today);
    baseStart.setDate(baseStart.getDate() - 30);
    const latestDate = new Date(latestEpisodeTs);
    const latestDaysFromBase = Math.round(
      (latestDate.getTime() - baseStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const centeredOffset = latestDaysFromBase - Math.floor(daysToShow / 2);
    setOffset(centeredOffset);
    didSetInitialOffsetRef.current = true;
  }, [projects, today, daysToShow]);

  console.log("[Vision] filteredProjects:", filteredProjects.length, "typeFilter:", typeFilter);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden rounded-xl border border-[#1e1e1e] bg-[#0a0a0a]">
      <div className="flex items-center gap-3 border-b border-[#1e1e1e] bg-[#0a0a0a] px-4 py-2.5">
        <h1 className="text-[15px] font-medium text-[#e5e5e5]">Vision</h1>
        <div className="flex gap-0.5 rounded-lg border border-[#2a2a2a] bg-[#141414] p-0.5">
          <button
            onClick={() => setView("calendar")}
            className={`rounded-md px-3 py-1 text-[11px] ${
              view === "calendar" ? "bg-[#1a1a1a] text-[#e5e5e5]" : "text-[#555]"
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView("gantt")}
            className={`rounded-md px-3 py-1 text-[11px] ${
              view === "gantt" ? "bg-[#1a1a1a] text-[#e5e5e5]" : "text-[#555]"
            }`}
          >
            Gantt
          </button>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1.5">
          {typeFilterOptions.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full border px-2.5 py-1 text-[10px] ${
                typeFilter === t
                  ? "border-[#FFFA00] bg-[#1a1a00] text-[#FFFA00]"
                  : "border-[#2a2a2a] bg-[#141414] text-[#666]"
              }`}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
        {view === "gantt" ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((o) => o - Math.round(daysToShow / 2))}
              className="rounded-md border border-[#2a2a2a] px-2 py-0.5 text-[#999] hover:text-white"
            >
              ‹
            </button>
            <span className="min-w-[120px] text-center text-[12px] text-[#888]">{navLabel}</span>
            <button
              onClick={() => setOffset((o) => o + Math.round(daysToShow / 2))}
              className="rounded-md border border-[#2a2a2a] px-2 py-0.5 text-[#999] hover:text-white"
            >
              ›
            </button>
            <button
              onClick={() => setOffset(0)}
              className="rounded-md border border-[#FFFA00]/30 px-2 py-0.5 text-[10px] text-[#FFFA00] hover:bg-[#FFFA00]/10"
            >
              Today
            </button>
          </div>
        ) : null}
        {view === "gantt" ? (
          <div className="flex rounded-md border border-[#2a2a2a] bg-[#141414] p-0.5">
            {(["week", "month", "quarter"] as const).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`rounded px-2.5 py-1 text-[10px] ${
                  zoom === z ? "bg-[#1a1a1a] text-[#ccc]" : "text-[#555]"
                }`}
              >
                {z[0].toUpperCase()}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center overflow-hidden text-sm text-[#777]">
          Loading vision projects...
        </div>
      ) : view === "gantt" ? (
        <div className="flex flex-1 overflow-hidden">
          <div
            ref={leftScrollRef}
            className="relative z-10 w-[220px] flex-shrink-0 overflow-y-hidden border-r border-[#1e1e1e] bg-[#0a0a0a]"
          >
            <div className="flex h-[48px] items-end border-b border-[#1e1e1e] px-3 pb-2">
              <span className="text-[10px] uppercase tracking-wider text-[#444]">Project</span>
            </div>
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                className="border-b border-[#151515] px-3 py-2"
                style={{ height: ROW_HEIGHT }}
              >
                <div className="flex h-[44px] items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[9px] ${projectColors(p.type).pill}`}>
                    {p.type}
                  </span>
                  <div className="truncate text-[12px] text-[#ddd]">{p.showName}</div>
                </div>
                <div className="flex h-[28px] items-center justify-between text-[10px] text-[#666]">
                  <span>
                    {p.doneCount}/{p.totalEpisodes} on air
                  </span>
                  <span className={projectColors(p.type).text}>
                    {p.totalEpisodes > 0 ? Math.round((p.doneCount / p.totalEpisodes) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="z-0 flex-1 overflow-x-auto overflow-y-auto" onScroll={onTimelineScroll}>
            <div className="relative" style={{ width: totalWidth, minWidth: "100%" }}>
              <div className="sticky top-0 z-10 bg-[#0a0a0a]">
                <div className="flex h-6 border-b border-[#1e1e1e]">
                  {Array.from({ length: daysToShow }).map((_, i) => {
                    const d = new Date(windowStart);
                    d.setDate(windowStart.getDate() + i);
                    return (
                      <div
                        key={`m-${i}`}
                        style={{ width: DAY_W }}
                        className="border-r border-[#111] px-1 text-[9px] text-[#666]"
                      >
                        {d.getDate() === 1 ? d.toLocaleDateString("en-US", { month: "short" }) : ""}
                      </div>
                    );
                  })}
                </div>
                <div className="flex h-6 border-b border-[#1e1e1e]">
                  {Array.from({ length: daysToShow }).map((_, i) => {
                    const d = new Date(windowStart);
                    d.setDate(windowStart.getDate() + i);
                    const isToday = toIsoDate(d) === toIsoDate(today);
                    return (
                      <div
                        key={`d-${i}`}
                        style={{ width: DAY_W }}
                        className={`border-r border-[#111] text-center text-[10px] ${
                          isToday ? "text-[#FFFA00]" : "text-[#555]"
                        }`}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="pointer-events-none absolute top-0 z-[1] w-px bg-[#FFFA00]"
                style={{ left: xForDate(toIsoDate(today)), height: totalHeight }}
              />

              {filteredProjects.map((p) => {
                const colors = projectColors(p.type);
                const firstX = xForDate(p.firstDate);
                const lastX = xForDate(p.lastDate);
                const width = Math.max(DAY_W, lastX - firstX + DAY_W);
                const progress =
                  p.totalEpisodes > 0 ? Math.max(DAY_W, Math.round((width * p.doneCount) / p.totalEpisodes)) : 0;
                return (
                  <div
                    key={p.id}
                    className="relative border-b border-[#151515]"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="relative h-[44px]">
                      <div
                        className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full"
                        style={{ left: firstX, width, backgroundColor: colors.track, opacity: 0.15 }}
                      />
                      <div
                        className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full"
                        style={{ left: firstX, width: progress, backgroundColor: colors.track, opacity: 0.6 }}
                      />
                    </div>
                    <div className="relative h-[28px]">
                      {p.episodes.map((ep) => {
                        const x = xForDate(ep.date);
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            onMouseEnter={(event) =>
                              setTooltip({
                                project: p,
                                episode: ep,
                                x: event.clientX + 10,
                                y: event.clientY + 10,
                              })
                            }
                            onMouseMove={(event) =>
                              setTooltip((prev) =>
                                prev && prev.episode.id === ep.id
                                  ? { ...prev, x: event.clientX + 10, y: event.clientY + 10 }
                                  : prev
                              )
                            }
                            onMouseLeave={() => setTooltip(null)}
                            className={`${colors.pill} absolute top-1/2 flex h-[20px] w-[28px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md text-[10px] ${
                              ep.assignmentsStatus === "READY_TO_SEND" ? "shadow-[0_0_0_1.5px_#FFFA00]" : ""
                            }`}
                            style={{ left: x, opacity: statusOpacity(ep) }}
                          >
                            {ep.episodeNumber || "•"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                )
              }
              className="rounded border border-[#2a2a2a] px-3 py-1 text-[#FFFA00]"
            >
              ←
            </button>
            <span className="text-sm text-[#ddd]">
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                )
              }
              className="rounded border border-[#2a2a2a] px-3 py-1 text-[#FFFA00]"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-[#666]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const calYear = cell.date.getFullYear();
              const calMonth = cell.date.getMonth();
              const calDay = cell.date.getDate();
              const dayEpisodes = allEpisodes.filter(({ ep }) =>
                isSameDay(ep.date, calYear, calMonth, calDay)
              );
              return (
                <div
                  key={cell.iso}
                  className={`min-h-[110px] rounded border p-1 ${
                    cell.inMonth ? "border-[#2a2a2a]" : "border-[#1a1a1a] opacity-50"
                  }`}
                >
                  <div className="text-xs text-[#aaa]">{cell.date.getDate()}</div>
                  <div className="mt-1 space-y-1">
                    {dayEpisodes.slice(0, 2).map(({ project, ep }) => (
                      <NextLink
                        key={ep.id}
                        href={`/eventi?edit=${encodeURIComponent(ep.id)}`}
                        className={`block truncate rounded px-1.5 py-0.5 text-[10px] text-[#ddd] ${projectColors(project.type).pill}`}
                        title={`${project.showName} - Ep. ${ep.episodeNumber}`}
                      >
                        {project.showName} #{ep.episodeNumber}
                      </NextLink>
                    ))}
                    {dayEpisodes.length > 2 ? (
                      <div className="text-[10px] text-[#777]">+{dayEpisodes.length - 2} more</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex h-8 flex-shrink-0 items-center gap-4 border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 text-[10px] text-[#555]">
        {Object.entries(TYPE_COLORS)
          .filter(([k]) => k !== "default")
          .map(([type, c]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${c.pill}`} />
              {type}
            </span>
          ))}
        <span className="mx-2 h-4 w-px bg-[#2a2a2a]" />
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
          On air
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FFFA00]" />
          Active / Next
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#555]" />
          TBC
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-px w-3 bg-[#FFFA00]" />
          Today
        </span>
      </div>

      {tooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-50 min-w-[180px] rounded-xl border border-[#333] bg-[#111] px-3 py-2.5 text-[11px]"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="mb-2 font-medium text-[#e5e5e5]">
                {tooltip.project.showName} - Ep. {tooltip.episode.episodeNumber}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[#888]">
                <span>Title</span>
                <span className="text-[#ccc]">{tooltip.episode.title || "—"}</span>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[#888]">
                <span>Date</span>
                <span className="text-[#ccc]">{formatDate(tooltip.episode.date)}</span>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[#888]">
                <span>Status</span>
                <span>{tooltip.episode.status || "—"}</span>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[#888]">
                <span>Studio</span>
                <span className="text-[#ccc]">
                  {tooltip.episode.studio || "—"} · {tooltip.episode.facilities || "—"}
                </span>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
