"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Plus, Search } from "lucide-react";

export interface FilterOption {
  key: string;
  label: string;
  icon?: React.ReactNode;
  values: Array<{ value: string; label?: string; color?: string }>;
  allowMultiple?: boolean;
}

export interface ActiveFilter {
  key: string;
  value: string | null;
}

interface ComposableFiltersProps {
  filters: FilterOption[];
  activeFilters: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  dateRange?: {
    from: string;
    to: string;
    onFromChange: (val: string) => void;
    onToChange: (val: string) => void;
  };
  onApply?: () => void;
  className?: string;
}

function cn(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

function splitMultiValue(value: string | null): string[] {
  if (!value) return [];
  return value
    .split("||")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function ComposableFilters({
  filters,
  activeFilters,
  onChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  dateRange,
  onApply,
  className,
}: ComposableFiltersProps) {
  const [isFilterPickerOpen, setIsFilterPickerOpen] = useState(false);
  const [valuePickerKey, setValuePickerKey] = useState<string | null>(null);
  const [valuePickerRect, setValuePickerRect] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const filterPickerRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const valuePickerRef = useRef<HTMLDivElement | null>(null);
  const activeChipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (valuePickerRef.current?.contains(target)) return;
      setIsFilterPickerOpen(false);
      setValuePickerKey(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);

  useEffect(() => {
    if (!valuePickerKey) return;
    const updatePosition = () => {
      const chip = activeChipRefs.current[valuePickerKey];
      if (!chip) return;
      const rect = chip.getBoundingClientRect();
      setValuePickerRect({
        left: rect.left,
        top: rect.bottom + 6,
        width: Math.max(rect.width, 160),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [valuePickerKey]);

  const activeKeys = useMemo(
    () => new Set(activeFilters.map((f) => f.key)),
    [activeFilters]
  );

  const getFilterByKey = (key: string) => filters.find((f) => f.key === key);

  const getLabelForValue = (key: string, value: string | null) => {
    if (!value) return "Select...";
    const option = getFilterByKey(key);
    if (option?.allowMultiple) {
      const selectedValues = splitMultiValue(value);
      if (selectedValues.length === 0) return "Select...";
      const labels = selectedValues.map((selected) => {
        const found = option.values.find((v) => v.value === selected);
        return found?.label ?? selected;
      });
      return labels.join(", ");
    }
    const found = option?.values.find((v) => v.value === value);
    return found?.label ?? value;
  };

  const addFilter = (key: string) => {
    if (activeKeys.has(key)) return;
    onChange([...activeFilters, { key, value: null }]);
    setIsFilterPickerOpen(false);
  };

  const removeFilter = (key: string) => {
    onChange(activeFilters.filter((f) => f.key !== key));
    if (valuePickerKey === key) setValuePickerKey(null);
  };

  const setFilterValue = (key: string, value: string) => {
    onChange(
      activeFilters.map((f) => (f.key === key ? { ...f, value } : f))
    );
    setValuePickerKey(null);
  };

  const toggleFilterMultiValue = (key: string, value: string) => {
    onChange(
      activeFilters.map((f) => {
        if (f.key !== key) return f;
        const selected = new Set(splitMultiValue(f.value));
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        const merged = Array.from(selected);
        return { ...f, value: merged.length > 0 ? merged.join("||") : null };
      })
    );
  };

  const clearAll = () => {
    onChange([]);
    setValuePickerKey(null);
  };

  const openValuePicker = (key: string) => {
    const chip = activeChipRefs.current[key];
    if (!chip) return;
    const rect = chip.getBoundingClientRect();
    setValuePickerRect({
      left: rect.left,
      top: rect.bottom + 6,
      width: Math.max(rect.width, 160),
    });
    setValuePickerKey(key);
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleValuePickerClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setValuePickerKey(null);
    }, 120);
  };

  const currentValueFilter = valuePickerKey ? getFilterByKey(valuePickerKey) : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "rounded-xl border border-[#2a2a2a] bg-[#111] p-3",
        className
      )}
    >
      <div className="flex flex-wrap items-end gap-2">
        {dateRange ? (
          <>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#666]">
                From
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => dateRange.onFromChange(e.target.value)}
                  className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] py-1.5 pl-8 pr-3 text-[12px] text-[#ddd] focus:border-[#FFFA00] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#666]">
                To
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]" />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => dateRange.onToChange(e.target.value)}
                  className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] py-1.5 pl-8 pr-3 text-[12px] text-[#ddd] focus:border-[#FFFA00] focus:outline-none"
                />
              </div>
            </div>
            <div className="mx-1 h-9 w-px bg-[#2a2a2a]" />
          </>
        ) : null}

        {typeof searchValue === "string" && onSearchChange ? (
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#666]">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]" />
              <input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? "Search..."}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] py-1.5 pl-8 pr-3 text-[12px] text-[#ddd] placeholder:text-[#555] focus:border-[#FFFA00] focus:outline-none"
              />
            </div>
          </div>
        ) : null}

        <div className="relative">
          <button
            ref={filterButtonRef}
            type="button"
            onClick={() => setIsFilterPickerOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#333] px-3 py-1.5 text-[11px] text-[#666] hover:border-[#FFFA00] hover:text-[#FFFA00]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add filter
          </button>
          {isFilterPickerOpen ? (
            <div
              ref={filterPickerRef}
              className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[180px] rounded-xl border border-[#2a2a2a] bg-[#111] p-1.5 shadow-lg"
            >
              {filters.map((filter) => {
                const active = activeKeys.has(filter.key);
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => addFilter(filter.key)}
                    disabled={active}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-[#ccc] hover:bg-[#1b1b1b]",
                      active && "pointer-events-none opacity-40"
                    )}
                  >
                    {filter.icon ? (
                      <span className="text-[#888]">{filter.icon}</span>
                    ) : null}
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {onApply ? (
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg bg-[#FFFA00] px-4 py-1.5 text-[12px] font-medium text-black"
          >
            Apply
          </button>
        ) : null}
      </div>

      {activeFilters.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilters.map((active) => {
            const filter = getFilterByKey(active.key);
            if (!filter) return null;
            const selected = active.value != null;
            return (
              <div
                key={active.key}
                className={cn(
                  "inline-flex items-stretch overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#151515]",
                  selected && "border-[#FFFA00]"
                )}
              >
                <span
                  className={cn(
                    "flex items-center border-r border-[#2a2a2a] bg-[#141414] px-2 text-[11px] text-[#888]",
                    selected && "bg-[#2a2a00] text-[#FFFA00]"
                  )}
                >
                  {filter.label}
                </span>
                <button
                  ref={(node) => {
                    activeChipRefs.current[active.key] = node;
                  }}
                  type="button"
                  onClick={() => openValuePicker(active.key)}
                  className={cn(
                    "px-2 text-[11px] text-[#ccc] hover:bg-[#222]",
                    active.value == null && "text-[#555]",
                    selected && "text-white"
                  )}
                >
                  {getLabelForValue(active.key, active.value)}
                </button>
                <button
                  type="button"
                  onClick={() => removeFilter(active.key)}
                  className="border-l border-[#2a2a2a] px-1.5 text-[#555] hover:bg-[#2e1a1a] hover:text-[#f87171]"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] text-[#555] hover:text-[#f87171]"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {isClient &&
      valuePickerKey &&
      currentValueFilter &&
      valuePickerRect &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              ref={valuePickerRef}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={scheduleValuePickerClose}
              className="fixed z-[80] min-w-[160px] rounded-xl border border-[#2a2a2a] bg-[#111] p-1.5 shadow-lg"
              style={{
                left: Math.max(8, valuePickerRect.left),
                top: valuePickerRect.top,
                width: valuePickerRect.width,
              }}
            >
              {currentValueFilter.values.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] text-[#555]">No values</div>
              ) : (
                currentValueFilter.values.map((valueOption) => (
                  <button
                    key={valueOption.value}
                    type="button"
                    onClick={() =>
                      currentValueFilter.allowMultiple
                        ? toggleFilterMultiValue(currentValueFilter.key, valueOption.value)
                        : setFilterValue(currentValueFilter.key, valueOption.value)
                    }
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-[#ddd] hover:bg-[#1b1b1b]"
                  >
                    {currentValueFilter.allowMultiple ? (
                      <span className="w-3 text-[11px] text-[#FFFA00]">
                        {splitMultiValue(
                          activeFilters.find((f) => f.key === currentValueFilter.key)?.value ?? null
                        ).includes(valueOption.value)
                          ? "✓"
                          : ""}
                      </span>
                    ) : null}
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: valueOption.color ?? "#777" }}
                    />
                    <span>{valueOption.label ?? valueOption.value}</span>
                  </button>
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
