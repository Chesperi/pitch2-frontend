import type { ReactNode } from "react";

type ResponsiveTableProps = {
  children: ReactNode;
  minWidth?: string;
  className?: string;
};

export default function ResponsiveTable({
  children,
  minWidth = "800px",
  className = "",
}: ResponsiveTableProps): ReactNode {
  return (
    <div className={`relative ${className}`.trim()} style={{ overflowX: "auto", overflowY: "visible" }}>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-pitch-bg via-pitch-bg/90 to-transparent md:hidden"
        aria-hidden
      />
      <div style={{ minWidth }} className="inline-block w-full min-w-0 align-top">
        {children}
      </div>
    </div>
  );
}
