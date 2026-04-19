"use client";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  tooltip?: string;
  disabled?: boolean;
  /** Active: OFF track/knob use red tones; default: gray OFF */
  tone?: "default" | "active";
}

/**
 * Pill toggle: 36×20 track, 16×16 knob — matches Database / Master UI spec.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  tooltip,
  disabled = false,
  tone = "default",
}: ToggleSwitchProps) {
  const trackOn = "bg-[#1a2e1a]";
  const trackOffDefault = "bg-[#1e1e1e]";
  const trackOffActive = "bg-[#2e1a1a]";
  const trackClass = checked
    ? trackOn
    : tone === "active"
      ? trackOffActive
      : trackOffDefault;

  const knobTranslate = checked ? "translate-x-[16px]" : "translate-x-0";
  const knobOn = "bg-[#4ade80]";
  const knobOffDefault = "bg-[#444]";
  const knobOffActive = "bg-[#f87171]";
  const knobColor = checked
    ? knobOn
    : tone === "active"
      ? knobOffActive
      : knobOffDefault;

  return (
    <div
      className="flex items-center gap-2"
      title={tooltip}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={tooltip && !label ? tooltip : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!checked);
        }}
        className={`relative inline-flex h-[20px] w-[36px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-bg ${trackClass} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute left-[2px] top-[2px] h-4 w-4 rounded-full transition-[transform] duration-200 ease-out will-change-transform ${knobTranslate} ${knobColor}`}
        />
      </button>
      {label ? (
        <span className="text-[13px] leading-none text-[#ccc]">{label}</span>
      ) : null}
    </div>
  );
}
