import type { ReactNode } from "react";

type ResponsiveTableProps = {
  children: ReactNode;
  /** Minimum width of the scrollable content (e.g. table) */
  minWidth?: string;
  className?: string;
};

export default function ResponsiveTable({
  children,
  minWidth = "800px",
  className = "",
}: ResponsiveTableProps): ReactNode {
  return (
    <div className={`relative ${className}`.trim()}>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-pitch-bg to-transparent md:hidden"
        aria-hidden
      />
      <div className="overflow-x-auto">
        <div style={{ minWidth }} className="inline-block w-full min-w-0 align-top">
          {children}
        </div>
      </div>
    </div>
  );
}
