"use client";

import NextLink from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ComposableFilters, {
  type ActiveFilter,
  type FilterOption,
} from "@/components/ui/ComposableFilters";
import MonthCalendar from "@/components/ui/MonthCalendar";
import {
  fetchVisionProjects,
  type VisionEpisode,
  type VisionProject,
} from "@/lib/api/vision";

const ROW_HEIGHT = 72;

type TooltipState = {
  project: VisionProject;
  episode: VisionEpisode;
  x: number;
  y: number;
} | null;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateOnly(dateStr: string): string {
  return dateStr.substring(0, 10);
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

function getDaysToShow(z: "week" | "month" | "quarter"): number {
  return z === "week" ? 42 : z === "month" ? 84 : 168;
}

function getCenterOffset(z: "week" | "month" | "quarter"): number {
  return 30 - Math.floor(getDaysToShow(z) / 2);
}


function statusOpacity(ep: VisionEpisode): number {
  const s = ep.assignmentsStatus.toUpperCase();
  const st = ep.status.toUpperCase();
  if (s === "SENT" || s === "CONFIRMED" || st === "OK") return 0.45;
  if (s === "READY_TO_SEND") return 1;
  if (st === "CONFIRMED") return 0.8;
  return 0.3;
}

function withAlpha(color: string, alphaHex = "1a"): string {
  const c = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return `${c}${alphaHex}`;
  return "rgba(136,136,136,0.1)";
}

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase();
}

export default function VisionPage() {
  const [projects, setProjects] = useState<VisionProject[]>([]);
  const [view, setView] = useState<"gantt" | "calendar">("gantt");
  const [zoom, setZoom] = useState<"week" | "month" | "quarter">("month");
  const [offset, setOffset] = useState(0);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    setOffset(getCenterOffset(zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const distinctClients = useMemo(() => {
    return [...new Set(projects.map((p) => p.client.trim()).filter((client) => client.length > 0))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [projects]);

  const typeColorFromProjects = (type: string): string => {
    const row = projects.find((p) => p.type === type && p.color);
    return row?.color ?? "#888888";
  };

  const visionFilterOptions = useMemo<FilterOption[]>(
    () => [
      {
        key: "type",
        label: "Type",
        allowMultiple: true,
        values: distinctTypes.map((t) => ({ value: t, color: typeColorFromProjects(t) })),
      },
      {
        key: "status",
        label: "Status",
        allowMultiple: true,
        values: [
          { value: "TBD", color: "#FFFA00" },
          { value: "TBC", color: "#FFFA00" },
          { value: "OK", color: "#4ade80" },
          { value: "CONFIRMED", color: "#34d399" },
        ],
      },
      {
        key: "client",
        label: "Client",
        allowMultiple: true,
        values: distinctClients.map((c) => ({ value: c })),
      },
    ],
    [distinctTypes, distinctClients]
  );

  const filteredProjects = useMemo(() => {
    const splitMultiValues = (raw: string | null | undefined): string[] =>
      String(raw ?? "")
        .split("||")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

    return projects.filter((p) => {
      const typeF = activeFilters.find((f) => f.key === "type");
      if (typeF?.value) {
        const selectedTypes = splitMultiValues(typeF.value);
        if (selectedTypes.length > 0 && !selectedTypes.includes(p.type)) return false;
      }

      const clientF = activeFilters.find((f) => f.key === "client");
      if (clientF?.value) {
        const selectedClients = splitMultiValues(clientF.value);
        if (selectedClients.length > 0 && !selectedClients.includes(p.client)) return false;
      }

      const statusF = activeFilters.find((f) => f.key === "status");
      if (statusF?.value) {
        const selectedStatuses = splitMultiValues(statusF.value).map((v) => normalizeStatus(v));
        if (
          selectedStatuses.length > 0 &&
          !p.episodes.some((e) => selectedStatuses.includes(normalizeStatus(e.status)))
        ) {
          return false;
        }
      }

      if (dateFrom && dateTo) {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        const hasEpInRange = p.episodes.some((e) => {
          const d = new Date(e.date.split("T")[0]);
          return d >= from && d <= to;
        });
        if (!hasEpInRange) return false;
      }
      return true;
    });
  }, [projects, activeFilters, dateFrom, dateTo]);

  const DAY_W = zoom === "week" ? 36 : zoom === "month" ? 28 : 14;
  const daysToShow = getDaysToShow(zoom);
  const windowStart = useMemo(() => {
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 30 + offset,
      12,
      0,
      0
    );
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
    const [year, month, day] = toDateOnly(dateStr).split("-").map(Number);
    const d = new Date(year, month - 1, day, 12, 0, 0);
    const wsNoon = new Date(
      windowStart.getFullYear(),
      windowStart.getMonth(),
      windowStart.getDate(),
      12,
      0,
      0
    );
    return Math.round((d.getTime() - wsNoon.getTime()) / (1000 * 60 * 60 * 24)) * DAY_W;
  };

  const handleZoomChange = (newZoom: "week" | "month" | "quarter") => {
    setZoom(newZoom);
    setOffset(getCenterOffset(newZoom));
  };

  const onTimelineScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!leftScrollRef.current) return;
    leftScrollRef.current.scrollTop = event.currentTarget.scrollTop;
  };

  const allEpisodes = useMemo(() => {
    const rows: Array<{ project: VisionProject; ep: VisionEpisode }> = [];
    for (const project of filteredProjects) {
      for (const ep of project.episodes) {
        rows.push({ project, ep });
      }
    }
    return rows;
  }, [filteredProjects]);

  console.log("[Vision] filteredProjects:", filteredProjects.length, "typeFilter:", activeFilters);

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
              onClick={() => setOffset(getCenterOffset(zoom))}
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
                onClick={() => handleZoomChange(z)}
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
      <ComposableFilters
        filters={visionFilterOptions}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
        dateRange={{
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
        }}
        className="mx-4 my-2"
      />

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
                  <span
                    className="rounded-md px-2 py-0.5 text-[9px]"
                    style={{
                      border: `1px solid ${p.color}`,
                      color: p.color,
                      background: withAlpha(p.color),
                    }}
                  >
                    {p.type}
                  </span>
                  <div className="truncate text-[12px] text-[#ddd]">{p.showName}</div>
                </div>
                <div className="flex h-[28px] items-center justify-between text-[10px] text-[#666]">
                  <span>
                    {p.doneCount}/{p.totalEpisodes} on air
                  </span>
                  <span style={{ color: p.color }}>
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
                const sortedEpisodes = [...p.episodes].sort((a, b) =>
                  a.date.split("T")[0].localeCompare(b.date.split("T")[0])
                );
                const sortedFirstEpDate = sortedEpisodes[0]?.date;
                const sortedLastEpDate = sortedEpisodes[sortedEpisodes.length - 1]?.date;
                const trackLeft = sortedFirstEpDate ? xForDate(sortedFirstEpDate) + 2 : 0;
                const trackRight = sortedLastEpDate ? xForDate(sortedLastEpDate) + DAY_W - 2 : 0;
                const trackWidth = Math.max(DAY_W, trackRight - trackLeft);
                const progress =
                  p.totalEpisodes > 0
                    ? Math.max(DAY_W, Math.round((trackWidth * p.doneCount) / p.totalEpisodes))
                    : 0;
                const PILL_W = DAY_W - 4;
                return (
                  <div
                    key={p.id}
                    className="relative border-b border-[#151515]"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="relative h-[44px]">
                      <div
                        className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full"
                        style={{
                          left: trackLeft,
                          width: trackWidth,
                          backgroundColor: p.color,
                          opacity: 0.15,
                        }}
                      />
                      <div
                        className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full"
                        style={{
                          left: trackLeft,
                          width: progress,
                          backgroundColor: p.color,
                          opacity: 0.6,
                        }}
                      />
                    </div>
                    <div className="relative h-[28px]">
                      {sortedEpisodes.map((ep) => {
                        const pillLeft = xForDate(ep.date) + 2;
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
                            className={`absolute flex items-center justify-center rounded-md text-[10px] ${
                              ep.assignmentsStatus === "READY_TO_SEND" ? "shadow-[0_0_0_1.5px_#FFFA00]" : ""
                            }`}
                            style={{
                              position: "absolute",
                              left: pillLeft,
                              width: PILL_W,
                              top: 4,
                              height: 20,
                              opacity: statusOpacity(ep),
                              border: `1px solid ${p.color}`,
                              background: withAlpha(p.color),
                              color: p.color,
                            }}
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
          <MonthCalendar
            year={calendarMonth.getFullYear()}
            month={calendarMonth.getMonth()}
            onPrevMonth={() =>
              setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
            }
            renderDayContent={(y, m, d) => {
              const dayEpisodes = allEpisodes.filter(({ ep }) => isSameDay(ep.date, y, m, d));
              return (
                <div className="mt-1 space-y-1">
                  {dayEpisodes.slice(0, 2).map(({ project, ep }) => (
                    <NextLink
                      key={ep.id}
                      href={`/eventi?edit=${encodeURIComponent(ep.id)}`}
                      className="block truncate rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        border: `1px solid ${project.color}`,
                        background: withAlpha(project.color),
                        color: project.color,
                      }}
                      title={`${project.showName} - Ep. ${ep.episodeNumber}`}
                    >
                      {project.showName} #{ep.episodeNumber}
                    </NextLink>
                  ))}
                  {dayEpisodes.length > 2 ? (
                    <div className="text-[10px] text-[#777]">+{dayEpisodes.length - 2} more</div>
                  ) : null}
                </div>
              );
            }}
          />
        </div>
      )}

      <div className="flex h-8 flex-shrink-0 items-center gap-4 border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 text-[10px] text-[#555]">
        {distinctTypes.map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                border: `1px solid ${typeColorFromProjects(type)}`,
                background: withAlpha(typeColorFromProjects(type)),
              }}
            />
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
              {tooltip.episode.studio ? (
                <div className="mt-1 flex justify-between text-[10px] text-[#888]">
                  <span>Studio</span>
                  <span className="text-[#ccc]">{tooltip.episode.studio}</span>
                </div>
              ) : null}
              {tooltip.episode.facilities ? (
                <div className="mt-1 flex justify-between text-[10px] text-[#888]">
                  <span>Facilities</span>
                  <span className="text-[#ccc]">{tooltip.episode.facilities}</span>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
