"use client";

import type { ReactNode } from "react";

interface MonthCalendarProps {
  year: number;
  month: number; // 0-based
  onPrevMonth: () => void;
  onNextMonth: () => void;
  renderDayContent?: (year: number, month: number, day: number) => ReactNode;
  onDayClick?: (year: number, month: number, day: number) => void;
  dayLabels?: string[];
  className?: string;
}

type MonthCell = {
  year: number;
  month: number;
  day: number;
  inCurrentMonth: boolean;
};

const DEFAULT_DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === month,
    });
  }
  return cells;
}

function mergeClassName(baseClassName: string, className?: string): string {
  return className ? `${baseClassName} ${className}` : baseClassName;
}

export default function MonthCalendar({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  renderDayContent,
  onDayClick,
  dayLabels = DEFAULT_DAY_LABELS,
  className,
}: MonthCalendarProps) {
  const cells = buildMonthGrid(year, month);
  const today = new Date();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={mergeClassName("rounded-xl border p-4", className)}
      style={{ background: "#111", borderColor: "#2a2a2a" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-lg border border-[#2a2a2a] bg-transparent text-[#666] hover:border-[#555] hover:text-[#ccc]"
        >
          ←
        </button>
        <div className="text-[14px] font-medium text-[#e5e5e5]">{monthLabel}</div>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-lg border border-[#2a2a2a] bg-transparent text-[#666] hover:border-[#555] hover:text-[#ccc]"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-[#555]">
        {dayLabels.map((label, idx) => (
          <div key={`${label}-${idx}`}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const isToday =
            cell.year === today.getFullYear() &&
            cell.month === today.getMonth() &&
            cell.day === today.getDate();
          const baseClassName = "min-h-[80px] rounded-lg border p-1.5 text-left";
          const currentMonthClassName =
            "cursor-pointer border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#333] hover:bg-[#222]";
          const outMonthClassName = "cursor-default border-[#141414] bg-[#0d0d0d]";
          return (
            <button
              key={`${cell.year}-${cell.month}-${cell.day}`}
              type="button"
              onClick={() => onDayClick?.(cell.year, cell.month, cell.day)}
              className={`${baseClassName} ${cell.inCurrentMonth ? currentMonthClassName : outMonthClassName}`}
              style={isToday ? { borderColor: "#FFFA00" } : undefined}
            >
              <div
                className={
                  isToday
                    ? "flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FFFA00] text-[11px] font-bold text-black"
                    : cell.inCurrentMonth
                      ? "text-[12px] text-[#e5e5e5]"
                      : "text-[12px] text-[#333]"
                }
              >
                {cell.day}
              </div>
              {renderDayContent?.(cell.year, cell.month, cell.day)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
