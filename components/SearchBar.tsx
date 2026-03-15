"use client";

import { useCallback, useState } from "react";

type SearchBarProps = {
  placeholder?: string;
  onSearchChange?: (value: string) => void;
};

export function SearchBar({
  placeholder = "Cerca...",
  onSearchChange,
}: SearchBarProps) {
  const [value, setValue] = useState("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      onSearchChange?.(v);
    },
    [onSearchChange]
  );

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pitch-gray"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark py-2 pl-10 pr-4 text-pitch-white placeholder-pitch-gray focus:border-pitch-accent focus:outline-none focus:ring-1 focus:ring-pitch-accent"
      />
    </div>
  );
}
