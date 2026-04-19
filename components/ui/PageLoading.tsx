import type { ReactNode } from "react";

type PageLoadingProps = {
  /** Testo mostrato accanto allo spinner (default: Caricamento...) */
  label?: string;
};

export default function PageLoading({
  label = "Caricamento...",
}: PageLoadingProps): ReactNode {
  return (
    <div className="flex items-center justify-center py-16 text-pitch-gray-light">
      <svg
        className="mr-3 h-5 w-5 animate-spin text-pitch-accent"
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
          d="M4 12a8 8 0 018-8v8z"
        />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}
