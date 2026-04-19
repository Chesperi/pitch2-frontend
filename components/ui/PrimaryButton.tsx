import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type PrimaryButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-pitch-accent text-pitch-bg hover:bg-yellow-200 focus-visible:ring-pitch-accent",
  secondary:
    "border border-pitch-gray-dark bg-transparent text-pitch-gray-light hover:bg-pitch-gray-dark focus-visible:ring-pitch-gray",
  danger:
    "border border-red-600/80 bg-transparent text-red-300 hover:bg-red-950/50 focus-visible:ring-red-500",
  ghost:
    "bg-transparent text-pitch-gray-light hover:bg-white/10 focus-visible:ring-pitch-gray",
};

function Spinner(): ReactNode {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default function PrimaryButton({
  children,
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  type = "button",
  ...rest
}: PrimaryButtonProps): ReactNode {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-bg disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      <span className={loading ? "opacity-80" : undefined}>{children}</span>
    </button>
  );
}
