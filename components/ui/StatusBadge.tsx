import type { ReactNode } from "react";

export type StatusBadgeVariant =
  | "confirmed"
  | "pending"
  | "rejected"
  | "cancelled"
  | "draft"
  | "partial"
  | "complete"
  | "accepted"
  | "declined";

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

const DEFAULT_LABELS: Record<StatusBadgeVariant, string> = {
  confirmed: "Confirmed",
  pending: "To confirm",
  rejected: "Rejected",
  cancelled: "Cancelled",
  draft: "Draft",
  partial: "Partial",
  complete: "Complete",
  accepted: "Accepted",
  declined: "Declined",
};

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  confirmed:
    "border border-orange-500 bg-transparent text-orange-500",
  pending:
    "border border-yellow-300 bg-transparent text-yellow-300",
  rejected:
    "border border-red-400 bg-red-950/40 text-red-300",
  cancelled:
    "border border-red-300 bg-transparent text-red-300",
  draft:
    "border border-pitch-gray-dark bg-pitch-gray-dark text-pitch-gray-light",
  partial:
    "border border-pitch-gray-dark bg-pitch-gray-dark/80 text-pitch-gray",
  complete:
    "border border-green-300 bg-transparent text-green-300",
  accepted:
    "border border-green-400/80 bg-green-950/40 text-green-300",
  declined:
    "border border-red-400/80 bg-red-950/40 text-red-300",
};

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "rounded-full px-2 py-0.5 text-xs font-medium",
  md: "rounded-full px-2.5 py-1 text-sm font-medium",
};

export default function StatusBadge({
  variant,
  label,
  size = "sm",
  className = "",
}: StatusBadgeProps): ReactNode {
  const text = label ?? DEFAULT_LABELS[variant];
  return (
    <span
      className={`inline-flex items-center justify-center transition-colors duration-150 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {text}
    </span>
  );
}
