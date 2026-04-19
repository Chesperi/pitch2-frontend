import type { ShiftType } from "@/lib/api/shifts";

export const SHIFT_TYPES: ShiftType[] = [
  "PD",
  "PS",
  "S",
  "O",
  "RE",
  "F",
  "R",
  "M",
  "RT",
  "T",
];

export const SHIFT_CHIP_CLASS: Record<
  ShiftType,
  { bg: string; text: string }
> = {
  PD: { bg: "#E6F1FB", text: "#0C447C" },
  PS: { bg: "#B5D4F4", text: "#042C53" },
  S: { bg: "#EAF3DE", text: "#27500A" },
  O: { bg: "#D3D1C7", text: "#444441" },
  RE: { bg: "#E1F5EE", text: "#085041" },
  F: { bg: "#FAEEDA", text: "#633806" },
  R: { bg: "#F4C0D1", text: "#72243E" },
  M: { bg: "#FCEBEB", text: "#791F1F" },
  RT: { bg: "#F5C4B3", text: "#712B13" },
  T: { bg: "#EEEDFE", text: "#3C3489" },
};

export function ShiftChip({
  type,
  className = "",
}: {
  type: ShiftType;
  className?: string;
}) {
  const c = SHIFT_CHIP_CLASS[type];
  return (
    <span
      className={`inline-flex min-w-[2rem] items-center justify-center rounded px-2 py-0.5 text-xs font-semibold ${className}`}
      style={{ background: c.bg, color: c.text }}
    >
      {type}
    </span>
  );
}
