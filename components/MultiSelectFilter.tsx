"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DAZN_COLORS } from "@/lib/theme";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectFilterProps = {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Seleziona...",
  disabled = false,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const node = rootRef.current;
      if (!node) return;
      if (!node.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  const optionMap = useMemo(() => {
    return new Map(options.map((opt) => [opt.value, opt.label]));
  }, [options]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const selectedLabels = useMemo(
    () =>
      selected
        .map((value) => ({ value, label: optionMap.get(value) ?? value }))
        .filter((item) => item.label.trim() !== ""),
    [optionMap, selected]
  );

  const triggerText =
    selected.length > 0 ? `${label} (${selected.length})` : placeholder;

  function toggleValue(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((v) => v !== value));
      return;
    }
    onChange([...selected, value]);
  }

  function handleSelectAll() {
    onChange(options.map((opt) => opt.value));
  }

  function handleClearAll() {
    onChange([]);
  }

  return (
    <div ref={rootRef} className="relative min-w-[200px]">
      <label className="mb-1 block text-xs text-pitch-gray">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-left text-sm text-pitch-white focus:border-pitch-accent focus:outline-none ${
          disabled ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        <span className={selected.length > 0 ? "text-pitch-white" : "text-pitch-gray"}>
          {triggerText}
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded border border-pitch-gray-dark bg-pitch-bg p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-pitch-gray-dark pb-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-semibold"
              style={{ color: DAZN_COLORS.yellow }}
            >
              Seleziona tutti
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-semibold"
              style={{ color: DAZN_COLORS.yellow }}
            >
              Deseleziona tutti
            </button>
          </div>
          <div className="space-y-1">
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-pitch-white hover:bg-pitch-gray-dark/30"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(opt.value)}
                  onChange={() => toggleValue(opt.value)}
                  className="h-4 w-4 rounded border-pitch-gray-dark bg-pitch-gray-dark accent-pitch-accent"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {selectedLabels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedLabels.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs"
              style={{
                backgroundColor: DAZN_COLORS.grayDark,
                color: DAZN_COLORS.white,
              }}
            >
              {item.label}
              <button
                type="button"
                onClick={() => toggleValue(item.value)}
                className="font-bold"
                style={{ color: DAZN_COLORS.yellow }}
                aria-label={`Rimuovi ${item.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
