"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchAssignmentsByEvent,
  createEmptyAssignmentSlot,
  updateDesignatorAssignment,
  deleteDesignatorAssignment,
  markAssignmentsReady,
  fetchAssignmentConflicts,
  type AssignmentStatus,
  type AssignmentWithJoins,
} from "@/lib/api/assignments";
import {
  fetchStandardCombos,
  type StandardComboWithRequirements,
} from "@/lib/api/standardCombos";
import {
  fetchStandardRequirements,
  generateAssignmentsFromStandard,
  type StandardRequirementWithRole,
} from "@/lib/api/standardRequirements";
import {
  fetchEventById,
  fetchEvents,
  type EventAssignmentsStatus,
  type EventItem,
} from "@/lib/api/events";
import { fetchRoles } from "@/lib/api/roles";
import { fetchStaff } from "@/lib/api/staff";
import type { Role } from "@/lib/api/roles";
import type { StaffItem } from "@/lib/api/staff";
import StatusBadge from "@/components/ui/StatusBadge";
import PageLoading from "@/components/ui/PageLoading";

function assignmentRoleForApi(a: AssignmentWithJoins): {
  roleCode: string;
  roleLocation: string;
} {
  return {
    roleCode: a.role_code ?? a.roleCode ?? "",
    roleLocation: a.role_location ?? a.roleLocation ?? "",
  };
}

function formatKoItaly(koItaly: string | null): string {
  if (!koItaly) return "—";
  try {
    const date = new Date(koItaly);
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return koItaly;
  }
}

function renderAssignmentsStatusBadge(
  status: EventAssignmentsStatus | undefined
): React.ReactNode {
  switch (status) {
    case "DRAFT":
      return <StatusBadge variant="draft" label="Draft" />;
    case "READY_TO_SEND":
      return <StatusBadge variant="pending" label="Ready to send" />;
    case "SENT":
      return <StatusBadge variant="accepted" label="Sent" />;
    default:
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
          {status || "—"}
        </span>
      );
  }
}

function getAssignmentStatusClasses(status: string): string {
  switch (status) {
    case "ACCEPTED":
    case "CONFIRMED":
      return "bg-green-900/50 text-green-300";
    case "DECLINED":
    case "REJECTED":
      return "bg-red-900/50 text-red-300";
    case "SENT":
      return "bg-blue-900/50 text-blue-300";
    case "READY":
      return "bg-yellow-900/50 text-yellow-300";
    case "DRAFT":
    default:
      return "bg-pitch-gray-dark text-pitch-gray-light";
  }
}

function getAssignmentStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "READY":
      return "Ready";
    case "SENT":
      return "Sent";
    case "CONFIRMED":
      return "Confirmed";
    case "REJECTED":
      return "Declined";
    default:
      return status;
  }
}

/** Valori `EventAssignmentsStatus` (tipo frontend); sul DB compaiono soprattutto DRAFT e READY_TO_SEND. */
const EVENT_ASSIGNMENTS_STATUS_INFO = {
  DRAFT: {
    label: "Draft",
    description:
      "Event assignments still in progress, with no bulk assignment email sent yet.",
  },
  READY_TO_SEND: {
    label: "Ready to send",
    description:
      "Event ready to generate/send assignment emails to freelancers.",
  },
  SENT: {
    label: "Sent",
    description:
      "Extended UI/API use: emails sent; outcome on individual rows (AssignmentStatus).",
  },
  CONFIRMED: {
    label: "Confirmed",
    description: "All freelancers confirmed their assignments.",
  },
} satisfies Record<
  EventAssignmentsStatus,
  { label: string; description: string }
>;

/** Valori `AssignmentStatus` (allineati a pitch-backend). */
const ASSIGNMENT_STATUS_INFO = {
  DRAFT: {
    label: "Draft",
    description:
      "Slot created or in draft, often without a person or outside the “ready to send” block.",
  },
  READY: {
    label: "Ready",
    description:
      "Row included in the next email send (OK checkbox in table).",
  },
  SENT: {
    label: "Sent",
    description: "Notification sent to the freelancer, awaiting accept or decline.",
  },
  CONFIRMED: {
    label: "Confirmed",
    description: "The freelancer accepted the assignment.",
  },
  REJECTED: {
    label: "Declined",
    description: "The freelancer declined; reassign or adjust the slot.",
  },
} satisfies Record<AssignmentStatus, { label: string; description: string }>;

const btnSmallYellow =
  "inline-flex min-h-[44px] items-center rounded bg-pitch-accent px-3 py-2 text-xs font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50";
const btnSmallGrey =
  "inline-flex min-h-[44px] items-center rounded border border-pitch-gray px-3 py-2 text-xs text-pitch-gray hover:bg-pitch-gray-dark disabled:opacity-50";

type RoleSummary = {
  roleKey: string;
  roleCode: string;
  roleLocation: string;
  description?: string;
  required: number;
  slots: number;
  assigned: number;
};

function safeStandardQuantity(q: unknown): number {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

function eventDateForConflict(ev: EventItem | null): string | null {
  const rawKo = String(ev?.koItaly ?? "").trim();
  const koMatch = rawKo.match(/^(\d{4}-\d{2}-\d{2})/);
  if (koMatch) return koMatch[1];
  const rawDate = String(ev?.date ?? "").trim();
  const dateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : null;
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg border border-pitch-gray-dark bg-pitch-bg p-4">
        <h3 className="text-base font-semibold text-pitch-white">{title}</h3>
        <div className="mt-2 text-sm text-pitch-gray-light">{body}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function normStd(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/**
 * Se esiste un pacchetto `standard_combos` allineato all’evento (onsite/cologno,
 * con match stretto opzionale su facilities/studio), restituisce i requirements
 * aggregati. Altrimenti `null` → il chiamante usa ancora GET /api/standard-requirements.
 */
function requirementsFromCombosForEvent(
  combos: StandardComboWithRequirements[],
  ev: EventItem | null
): StandardRequirementWithRole[] | null {
  if (!ev) return null;
  const onsite = normStd(ev.standardOnsite);
  const cologno = normStd(ev.standardCologno);
  if (!onsite || !cologno) return null;

  let candidates = combos.filter(
    (c) =>
      normStd(c.standardOnsite) === onsite &&
      normStd(c.standardCologno) === cologno
  );
  const ef = normStd(ev.facilities);
  const es = normStd(ev.studio);
  if (ef || es) {
    const tight = candidates.filter(
      (c) =>
        (!ef || normStd(c.facilities) === ef) &&
        (!es || normStd(c.studio) === es)
    );
    if (tight.length > 0) candidates = tight;
  }

  if (candidates.length === 0) return null;

  const merged: StandardRequirementWithRole[] = [];
  for (const c of candidates) {
    merged.push(...c.requirements);
  }
  return merged;
}

function assignmentRoleKey(a: AssignmentWithJoins): string {
  const code = String(a.roleCode ?? a.role_code ?? "").trim().toUpperCase();
  const location = String(a.roleLocation ?? a.role_location ?? "")
    .trim()
    .toUpperCase();
  return `${code}__${location}`;
}

function assignmentRoleCode(a: AssignmentWithJoins): string {
  return String(a.roleCode ?? a.role_code ?? "").trim();
}

/** Combina standard_requirements (required) con assignments (slots / assigned) per roleId. */
function buildRoleSummaries(
  standardRequirements: StandardRequirementWithRole[],
  assignments: AssignmentWithJoins[]
): RoleSummary[] {
  const fromStandards = new Map<
    string,
    { required: number; roleCode: string; roleLocation: string; description: string }
  >();

  for (const req of standardRequirements) {
    const roleCode = String(req.roleCode ?? "").trim().toUpperCase();
    const roleLocation = String(req.roleLocation ?? "").trim().toUpperCase();
    if (!roleCode || !roleLocation) continue;
    const key = `${roleCode}__${roleLocation}`;
    const q = safeStandardQuantity(req.quantity);
    const desc = String(req.roleName ?? "").trim();
    const prev = fromStandards.get(key);
    if (prev) {
      fromStandards.set(key, {
        required: prev.required + q,
        roleCode: prev.roleCode || roleCode,
        roleLocation: prev.roleLocation || roleLocation,
        description: prev.description || desc,
      });
    } else {
      fromStandards.set(key, {
        required: q,
        roleCode,
        roleLocation,
        description: desc,
      });
    }
  }

  const slotStats = new Map<
    string,
    { slots: number; assigned: number; roleCode: string; roleLocation: string }
  >();

  for (const a of assignments) {
    const key = assignmentRoleKey(a);
    if (!key || key === "__") continue;
    const code = assignmentRoleCode(a).toUpperCase();
    const roleLocation = String(a.roleLocation ?? a.role_location ?? "")
      .trim()
      .toUpperCase();
    const staff = a.staffId ?? a.staff_id;
    const assignedInc = staff != null ? 1 : 0;
    const cur = slotStats.get(key) ?? {
      slots: 0,
      assigned: 0,
      roleCode: code,
      roleLocation,
    };
    slotStats.set(key, {
      slots: cur.slots + 1,
      assigned: cur.assigned + assignedInc,
      roleCode: cur.roleCode || code,
      roleLocation: cur.roleLocation || roleLocation,
    });
  }

  const allIds = new Set<string>([
    ...fromStandards.keys(),
    ...slotStats.keys(),
  ]);

  const rows: RoleSummary[] = [];
  for (const roleKey of allIds) {
    const std = fromStandards.get(roleKey);
    const st = slotStats.get(roleKey);
    rows.push({
      roleKey,
      roleCode: std?.roleCode || st?.roleCode || "—",
      roleLocation: std?.roleLocation || st?.roleLocation || "—",
      description: std?.description?.trim()
        ? std.description
        : undefined,
      required: std?.required ?? 0,
      slots: st?.slots ?? 0,
      assigned: st?.assigned ?? 0,
    });
  }

  rows.sort((a, b) => {
    const aReq = a.required > 0 ? 1 : 0;
    const bReq = b.required > 0 ? 1 : 0;
    if (aReq !== bReq) return bReq - aReq;
    return a.roleCode.localeCompare(b.roleCode, "it", {
      sensitivity: "base",
    });
  });

  return rows;
}

function StaffPicker({
  assignmentId,
  assignments,
  staffList,
  errorMessage,
  staticWarning,
  onClose,
  onSelect,
}: {
  assignmentId: number;
  assignments: AssignmentWithJoins[];
  staffList: StaffItem[];
  errorMessage?: string | null;
  staticWarning?: string | null;
  onClose: () => void;
  onSelect: (assignmentId: number, staffId: number) => void;
}) {
  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) return null;

  const roleCode = assignment.roleCode ?? assignment.role_code ?? "";
  const roleLocation = (
    assignment.roleLocation ??
    assignment.role_location ??
    ""
  ).toUpperCase();
  const candidates = staffList.filter(
    (s) =>
      (s.default_role_code ?? "") === roleCode &&
      (s.default_location ?? "").toUpperCase() === roleLocation
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-4">
        <div className="mb-2 text-sm font-semibold text-pitch-white">
          Assign {roleCode || "—"}
        </div>
        {errorMessage ? (
          <p
            role="alert"
            className="mb-3 rounded border border-red-800/60 bg-red-950/50 px-3 py-2 text-xs text-red-200"
          >
            {errorMessage}
          </p>
        ) : null}
        {staticWarning ? (
          <p className="mb-3 rounded border border-amber-800/60 bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
            {staticWarning}
          </p>
        ) : null}
        <ul className="max-h-64 overflow-auto text-sm">
          {candidates.length === 0 ? (
            <li className="text-pitch-gray">No compatible person found</li>
          ) : (
            candidates.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-pitch-gray-light hover:bg-pitch-gray-dark hover:text-pitch-white"
                  onClick={() => onSelect(assignmentId, s.id)}
                >
                  {s.surname} {s.name}
                  {s.company ? ` – ${s.company}` : ""}
                  {s.default_role_code ? ` – ${s.default_role_code}` : ""}
                  {s.default_location ? ` (${s.default_location})` : ""}
                </button>
              </li>
            ))
          )}
        </ul>
        <button
          type="button"
          className="mt-3 text-xs text-pitch-gray hover:text-pitch-gray-light"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function DesignazioniEventPage() {
  const params = useParams();
  const router = useRouter();
  const rawEventParam = params.eventId;
  const eventId =
    typeof rawEventParam === "string"
      ? rawEventParam
      : Array.isArray(rawEventParam)
        ? rawEventParam[0] ?? ""
        : "";
  const [designableEvents, setDesignableEvents] = useState<EventItem[]>([]);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithJoins[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffPickerForId, setStaffPickerForId] = useState<number | null>(null);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [isGeneratingFromStandard, setIsGeneratingFromStandard] =
    useState(false);
  const [readyMap, setReadyMap] = useState<Record<number, boolean>>({});
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [standardRequirements, setStandardRequirements] = useState<
    StandardRequirementWithRole[]
  >([]);
  const [standardBannerIgnored, setStandardBannerIgnored] = useState(false);
  const [standardChanged, setStandardChanged] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState("");
  const [showReadyEventModal, setShowReadyEventModal] = useState(false);
  const [readyEventCoverage, setReadyEventCoverage] = useState<{
    assignedIds: number[];
    totalRequired: number;
    covered: number;
    missingRoles: string[];
    simple: boolean;
  } | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const loadAssignments = useCallback(async () => {
    const data = await fetchAssignmentsByEvent(eventId);
    setAssignments(data);
  }, [eventId]);

  const loadEvent = useCallback(async () => {
    const ev = await fetchEventById(eventId);
    setEvent(ev);
  }, [eventId]);

  const loadRoles = useCallback(async () => {
    const data = await fetchRoles();
    setRoles(data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ev = await fetchEventById(eventId);
      setEvent(ev);

      const [assignData, rolesData, combosData] = await Promise.all([
        fetchAssignmentsByEvent(eventId),
        fetchRoles(),
        fetchStandardCombos().catch(() => [] as StandardComboWithRequirements[]),
      ]);

      let stdData: StandardRequirementWithRole[] = [];
      const fromCombos = requirementsFromCombosForEvent(combosData, ev);
      if (fromCombos != null && fromCombos.length > 0) {
        stdData = fromCombos;
      } else if (
        ev?.standardOnsite?.trim() &&
        ev?.standardCologno?.trim()
      ) {
        try {
          stdData = await fetchStandardRequirements({
            standardOnsite: ev.standardOnsite.trim(),
            standardCologno: ev.standardCologno.trim(),
            page: 0,
            pageSize: 500,
          });
        } catch {
          stdData = [];
        }
      }

      setAssignments(assignData);
      setRoles(rolesData);
      setStandardRequirements(stdData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading error");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvents({ onlyDesignable: true })
      .then((r) => setDesignableEvents(r.items))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (eventId) {
      loadAll();
    }
  }, [eventId, loadAll]);

  useEffect(() => {
    setPickerError(null);
  }, [staffPickerForId]);

  useEffect(() => {
    fetchStaff({ limit: 1000 })
      .then((r) => setStaffList(r.items ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!event || assignments.length === 0) return;

    const initialReady: Record<number, boolean> = {};
    for (const a of assignments) {
      if (a.staffId != null) {
        initialReady[a.id] = true;
      }
    }
    setReadyMap(initialReady);
  }, [event?.id, assignments]);

  useEffect(() => {
    if (standardBannerIgnored) return;
    if (!event?.standardComboId) {
      setStandardChanged(false);
      return;
    }

    const generatedCombo = assignments
      .map((a) => a.generatedFromComboId ?? a.generated_from_combo_id ?? null)
      .find((v): v is number => v != null);

    if (generatedCombo != null) {
      setStandardChanged(generatedCombo !== event.standardComboId);
      return;
    }

    // Legacy pre-migration: se tutti i generated_from_combo_id sono null
    // non mostriamo il banner (nessun mismatch certo rilevabile).
    setStandardChanged(false);
  }, [
    event?.standardComboId,
    assignments,
    standardBannerIgnored,
  ]);

  const hasAnyReady = assignments.some((a) => readyMap[a.id]);

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const locA = (a.roleLocation ?? a.role_location ?? "").toUpperCase();
      const locB = (b.roleLocation ?? b.role_location ?? "").toUpperCase();

      // STADIO prima di COLOGNO
      if (locA === "STADIO" && locB === "COLOGNO") return -1;
      if (locA === "COLOGNO" && locB === "STADIO") return 1;

      // stessa location (o entrambe vuote): ordina per nome ruolo
      const nameA = (a.roleName ?? a.role_name ?? a.roleCode ?? a.role_code ?? "")
        .toLocaleLowerCase();
      const nameB = (b.roleName ?? b.role_name ?? b.roleCode ?? b.role_code ?? "")
        .toLocaleLowerCase();

      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  }, [assignments]);

  const { requirementAssignments, extraAssignments } = useMemo(() => {
    const requiredByRole = new Map<string, number>();
    for (const req of standardRequirements) {
      const key = `${String(req.roleCode ?? "").trim().toUpperCase()}__${String(
        req.roleLocation ?? ""
      )
        .trim()
        .toUpperCase()}`;
      if (!key || key === "__") continue;
      requiredByRole.set(
        key,
        (requiredByRole.get(key) ?? 0) + safeStandardQuantity(req.quantity)
      );
    }

    if (requiredByRole.size === 0) {
      return {
        requirementAssignments: [] as AssignmentWithJoins[],
        extraAssignments: sortedAssignments,
      };
    }

    const byRole = new Map<string, AssignmentWithJoins[]>();
    for (const a of sortedAssignments) {
      const key = assignmentRoleKey(a);
      if (!byRole.has(key)) byRole.set(key, []);
      byRole.get(key)!.push(a);
    }

    const reqRows: AssignmentWithJoins[] = [];
    const extraRows: AssignmentWithJoins[] = [];

    for (const [key, requiredCount] of requiredByRole.entries()) {
      const rows = byRole.get(key) ?? [];
      reqRows.push(...rows.slice(0, requiredCount));
      extraRows.push(...rows.slice(requiredCount));
      byRole.delete(key);
    }

    for (const rows of byRole.values()) {
      extraRows.push(...rows);
    }

    return { requirementAssignments: reqRows, extraAssignments: extraRows };
  }, [sortedAssignments, standardRequirements]);

  const requirementAssignmentsSorted = useMemo(() => {
    return [...requirementAssignments].sort((a, b) => {
      const aCode = String(a.roleCode ?? a.role_code ?? "").toUpperCase();
      const bCode = String(b.roleCode ?? b.role_code ?? "").toUpperCase();
      return aCode.localeCompare(bCode, "it", { sensitivity: "base" });
    });
  }, [requirementAssignments]);

  const rolesForAddSlot = useMemo(() => {
    return [...roles].sort((a, b) => {
      const aName = (a.name ?? "").trim().toLocaleLowerCase();
      const bName = (b.name ?? "").trim().toLocaleLowerCase();
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      const aLoc = (a.location ?? "").trim().toLocaleLowerCase();
      const bLoc = (b.location ?? "").trim().toLocaleLowerCase();
      if (aLoc < bLoc) return -1;
      if (aLoc > bLoc) return 1;
      return 0;
    });
  }, [roles]);

  const reloadAssignments = useCallback(async () => {
    const data = await fetchAssignmentsByEvent(eventId);
    setAssignments(data);
  }, [eventId]);

  const handleAssignStaff = async (assignmentId: number, staffId: number) => {
    setPickerError(null);
    try {
      const date = eventDateForConflict(event);
      if (date) {
        try {
          const conflicts = await fetchAssignmentConflicts({ staffId, date });
          const conflictsExcludingCurrent = conflicts.filter(
            (c) => c.assignmentId !== assignmentId
          );
          if (conflictsExcludingCurrent.length > 0) {
            const first = conflictsExcludingCurrent[0];
            const eventLabel =
              first.homeTeamNameShort && first.awayTeamNameShort
                ? `${first.homeTeamNameShort} vs ${first.awayTeamNameShort}`
                : first.showName || first.competitionName || first.eventId;
            const staff = staffList.find((s) => s.id === staffId);
            const staffLabel = staff
              ? `${staff.surname} ${staff.name}`.trim()
              : `Staff ${staffId}`;
            setConflictWarning(
              `${staffLabel} è già assegnato in un altro evento in questa data: ${eventLabel}. Puoi comunque procedere.`
            );
          }
        } catch {
          // warning non bloccante: non interrompe assegnazione
        }
      }

      const row = assignments.find((x) => x.id === assignmentId);
      if (!row) {
        setPickerError("Slot not found.");
        return;
      }
      await updateDesignatorAssignment(assignmentId, {
        staffId,
        ...assignmentRoleForApi(row),
      });
      await reloadAssignments();
      setStaffPickerForId(null);
    } catch (err) {
      console.error(err);
      setPickerError(
        err instanceof Error
          ? err.message
          : "Unable to update slot."
      );
    }
  };

  const handleClearStaff = async (assignmentId: number) => {
    try {
      const row = assignments.find((x) => x.id === assignmentId);
      await updateDesignatorAssignment(assignmentId, {
        staffId: null,
        status: "DRAFT",
        ...(row ? assignmentRoleForApi(row) : {}),
      });
      await reloadAssignments();
      setReadyMap((prev) => ({ ...prev, [assignmentId]: false }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSlot = async (assignmentId: number) => {
    const row = assignments.find((x) => x.id === assignmentId);
    if (!row) return;

    const hasStaff = (row.staffId ?? row.staff_id) != null;
    const message = hasStaff
      ? "Questo slot ha una persona assegnata. Eliminarlo rimuoverà anche l'assegnazione. Continuare?"
      : "Eliminare questo slot? L'operazione non è reversibile.";

    const ok = window.confirm(message);
    if (!ok) return;

    try {
      await deleteDesignatorAssignment(assignmentId);
      await reloadAssignments();
      setReadyMap((prev) => {
        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore eliminazione slot");
    }
  };

  const handleNotesChange = async (
    assignmentId: number,
    notes: string | null
  ) => {
    setActioningId(assignmentId);
    try {
      const row = assignments.find((x) => x.id === assignmentId);
      const updated = await updateDesignatorAssignment(assignmentId, {
        notes,
        ...(row ? assignmentRoleForApi(row) : {}),
      });
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? updated : a))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setActioningId(null);
    }
  };

  const handleAddSlot = async (roleId: number) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      alert("Role not found.");
      return;
    }
    setAddingSlot(true);
    try {
      await createEmptyAssignmentSlot(
        eventId,
        roleId,
        role.code,
        role.location
      );
      await reloadAssignments();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleRegenerateFromStandard = async () => {
    if (!event?.id) return;

    let message =
      "Verranno aggiunti solo gli slot mancanti. Le assegnazioni esistenti non verranno toccate.";
    try {
      const assignedCount = assignments.filter(
        (a) => (a.staffId ?? a.staff_id) != null
      ).length;
      if (assignedCount === 0) {
        message = "Verranno generati i requirements dal nuovo standard.";
      }
    } catch {
      // fallback: usa il messaggio generico richiesto
    }
    setRegenerateMessage(message);
    setShowRegenerateModal(true);
  };

  const confirmRegenerateFromStandard = async () => {
    if (!event?.id) return;
    setIsGeneratingFromStandard(true);
    try {
      await generateAssignmentsFromStandard(event.id);
      const freshAssignments = await fetchAssignmentsByEvent(event.id);
      setAssignments(freshAssignments);
      setReadyMap({});
      setStandardBannerIgnored(false);
      setShowRegenerateModal(false);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Regeneration error");
    } finally {
      setIsGeneratingFromStandard(false);
    }
  };

  const handleReadySelected = async () => {
    const selectedIds = assignments
      .filter((a) => readyMap[a.id])
      .map((a) => a.id);

    if (selectedIds.length === 0) return;
    if (!event) return;

    try {
      await markAssignmentsReady({
        eventId: event.id,
        assignmentIds: selectedIds,
      });
      await loadEvent();
      await reloadAssignments();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to mark assignments ready");
    }
  };

  const handleReadyToSendEvent = async () => {
    if (!event) return;
    const assignedIds = assignments
      .filter((a) => (a.staffId ?? a.staff_id) != null)
      .map((a) => a.id);
    if (assignedIds.length === 0) {
      alert("Nessuna assegnazione con persona selezionata.");
      return;
    }

    const requiredByRole = new Map<string, number>();
    for (const req of standardRequirements) {
      const key = `${String(req.roleCode ?? "").trim().toUpperCase()}__${String(
        req.roleLocation ?? ""
      )
        .trim()
        .toUpperCase()}`;
      if (!key || key === "__") continue;
      requiredByRole.set(
        key,
        (requiredByRole.get(key) ?? 0) + safeStandardQuantity(req.quantity)
      );
    }

    const assignedByRole = new Map<string, number>();
    for (const a of assignments) {
      const staff = a.staffId ?? a.staff_id;
      if (staff == null) continue;
      const key = assignmentRoleKey(a);
      if (!key || key === "__") continue;
      assignedByRole.set(key, (assignedByRole.get(key) ?? 0) + 1);
    }

    const totalRequired = Array.from(requiredByRole.values()).reduce(
      (acc, n) => acc + n,
      0
    );
    const covered = Array.from(requiredByRole.entries()).reduce((acc, [k, req]) => {
      return acc + Math.min(req, assignedByRole.get(k) ?? 0);
    }, 0);
    const missingRoles: string[] = [];
    for (const [k, req] of requiredByRole.entries()) {
      const got = assignedByRole.get(k) ?? 0;
      if (got < req) {
        const [code, loc] = k.split("__");
        missingRoles.push(`${code} (${loc}) x${req - got}`);
      }
    }

    const simple = totalRequired === 0 || covered >= totalRequired;
    setReadyEventCoverage({
      assignedIds,
      totalRequired,
      covered,
      missingRoles,
      simple,
    });
    setShowReadyEventModal(true);
  };

  const confirmReadyToSendEvent = async () => {
    if (!event || !readyEventCoverage) return;
    try {
      await markAssignmentsReady({
        eventId: event.id,
        assignmentIds: readyEventCoverage.assignedIds,
      });
      await loadEvent();
      await reloadAssignments();
      setShowReadyEventModal(false);
      setReadyEventCoverage(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to mark event ready");
    }
  };

  const renderAssignmentListRow = (a: AssignmentWithJoins) => {
    const isAssigned = (a.staffId ?? a.staff_id) != null;
    const roleCode = a.roleCode ?? a.role_code ?? "—";
    const roleLocation = a.roleLocation ?? a.role_location ?? "—";
    return (
      <div
        key={a.id}
        className="flex flex-col gap-2 rounded border border-pitch-gray-dark/60 bg-pitch-gray-dark/20 px-3 py-2 md:flex-row md:items-center md:justify-between"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-pitch-white">
            {roleCode} <span className="text-pitch-gray">({roleLocation})</span>
          </div>
          <div className="text-xs text-pitch-gray-light">
            {isAssigned
              ? `${a.staffSurname ?? a.staff_surname ?? ""} ${a.staffName ?? a.staff_name ?? ""}`.trim()
              : "Non assegnato"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAssignmentStatusClasses(a.status)}`}
          >
            {getAssignmentStatusLabel(a.status)}
          </span>
          <button
            type="button"
            onClick={() => setStaffPickerForId(a.id)}
            className={btnSmallYellow}
          >
            {isAssigned ? "Cambia persona" : "Assegna persona"}
          </button>
          {isAssigned ? (
            <button
              type="button"
              onClick={() => void handleClearStaff(a.id)}
              className={btnSmallGrey}
            >
              Rimuovi
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDeleteSlot(a.id)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-red-700/70 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-950/40"
            title="Elimina slot"
            aria-label="Elimina slot"
          >
            X
          </button>
        </div>
      </div>
    );
  };

  if (loading && assignments.length === 0) {
    return (
      <>
        <PageHeader title="Event assignments" />
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <PageLoading />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Event assignments" />
        <div className="mt-6 rounded-lg border border-red-900/50 bg-red-900/20 p-6 text-red-300">
          {error}
        </div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <PageHeader title="Event assignments" />
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
          Event not found
        </div>
      </>
    );
  }

  const match =
    event?.homeTeamNameShort && event?.awayTeamNameShort
      ? `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`
      : event?.homeTeamNameShort ?? event?.awayTeamNameShort ?? "—";
  const conflictDate = eventDateForConflict(event);
  const pickerStaticWarning =
    conflictDate == null
      ? "Data evento non disponibile — verifica manualmente eventuali sovrapposizioni."
      : null;

  return (
    <>
      <PageHeader
        title="Event assignments"
        subtitle={
          <Link
            href="/designazioni"
            className="text-pitch-gray hover:text-pitch-accent"
          >
            ← Back to list
          </Link>
        }
      />

      <section className="mt-4 space-y-2">
        {conflictWarning ? (
          <div className="rounded border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            <div>{conflictWarning}</div>
            <button
              type="button"
              className="mt-1 text-[11px] underline"
              onClick={() => setConflictWarning(null)}
            >
              Chiudi
            </button>
          </div>
        ) : null}
        {standardChanged ? (
          <div className="rounded border border-yellow-700/60 bg-yellow-950/40 px-3 py-2 text-xs text-yellow-200">
            <div>
              Lo standard di questo evento è cambiato. Vuoi rigenerare i requirements?
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleRegenerateFromStandard}
                className="rounded bg-pitch-accent px-2 py-1 font-medium text-pitch-bg hover:bg-yellow-200"
              >
                Rigenera
              </button>
              <button
                type="button"
                onClick={() => setStandardBannerIgnored(true)}
                className="rounded border border-yellow-700/60 px-2 py-1 text-yellow-200 hover:bg-yellow-950/60"
              >
                Ignora per ora
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Select evento */}
      <div className="mt-6">
        <label className="mb-2 block text-sm text-pitch-gray">
          Event
        </label>
        <select
          value={event.id}
          onChange={(e) => {
            const newId = e.target.value;
            if (newId && newId !== event.id) {
              router.push(
                `/designazioni/${encodeURIComponent(newId)}`
              );
            }
          }}
          className="w-full max-w-xl rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
        >
          {(() => {
            const hasCurrent = designableEvents.some((ev) => ev.id === event.id);
            const options = hasCurrent
              ? designableEvents
              : [event, ...designableEvents];
            return options.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {(() => {
                  const home = ev.homeTeamNameShort?.trim() ?? "";
                  const away = ev.awayTeamNameShort?.trim() ?? "";
                  const show = ev.showName?.trim() ?? "";
                  const competition = ev.competitionName?.trim() ?? "";
                  const title =
                    home && away
                      ? `${home} vs ${away}`
                      : show
                        ? show
                        : competition
                          ? competition
                          : "Evento senza titolo";
                  return `${formatKoItaly(ev.koItaly)} – ${title}`;
                })()}
              </option>
            ));
          })()}
        </select>
      </div>

      {/* Riepilogo evento */}
      <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-sm text-pitch-gray">Competition: </span>
            <span className="text-pitch-white">
              {event.competitionName}
              {event.competitionCode ? ` (${event.competitionCode})` : ""}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Standard Onsite: </span>
            <span className="text-pitch-white">
              {event.standardOnsite ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Standard Cologno: </span>
            <span className="text-pitch-white">
              {event.standardCologno ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Facilities: </span>
            <span className="text-pitch-white">
              {event.facilities ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Studio: </span>
            <span className="text-pitch-white">
              {event.studio ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Show: </span>
            <span className="text-pitch-white">{event.showName ?? "—"}</span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Event status: </span>
            <span className="text-pitch-white">{event.status}</span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Assignment status: </span>
            {renderAssignmentsStatusBadge(event.assignmentsStatus)}
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Combo ID: </span>
            <span className="text-pitch-white">
              {event.standardComboId != null ? String(event.standardComboId) : "—"}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReadySelected}
              disabled={!hasAnyReady}
              className="inline-flex min-h-[44px] items-center rounded bg-pitch-accent px-3 py-2 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:bg-pitch-gray-dark disabled:text-pitch-gray"
            >
              Ready selected
            </button>
            <button
              type="button"
              onClick={handleReadyToSendEvent}
              disabled={assignments.every((a) => (a.staffId ?? a.staff_id) == null)}
              className="inline-flex min-h-[44px] items-center rounded bg-yellow-700 px-3 py-2 text-xs font-semibold text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:bg-pitch-gray-dark disabled:text-pitch-gray"
            >
              Ready to Send (event)
            </button>
            <button
              type="button"
              onClick={handleRegenerateFromStandard}
              disabled={
                !event.standardOnsite ||
                !event.standardCologno ||
                isGeneratingFromStandard
              }
              className="inline-flex min-h-[44px] items-center rounded border border-pitch-gray px-3 py-2 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingFromStandard ? "Regenerating..." : "Regenerate from standard"}
            </button>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-5">
        <h3 className="text-base font-semibold text-pitch-white">Requirements</h3>
        <p className="mt-1 text-xs text-pitch-gray">
          Slot derivati dallo standard dell&apos;evento.
        </p>
        <div className="mt-3 space-y-2">
          {requirementAssignmentsSorted.length === 0 ? (
            <div className="rounded border border-pitch-gray-dark/60 bg-pitch-gray-dark/20 px-3 py-2 text-sm text-pitch-gray">
              Nessuno slot standard disponibile.
            </div>
          ) : (
            requirementAssignmentsSorted.map((a) => renderAssignmentListRow(a))
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-5">
        <h3 className="text-base font-semibold text-pitch-white">Extra crew</h3>
        <p className="mt-1 text-xs text-pitch-gray">
          Slot aggiunti manualmente oltre ai requirements standard.
        </p>
        <div className="mt-3 space-y-2">
          {extraAssignments.length === 0 ? (
            <div className="rounded border border-pitch-gray-dark/60 bg-pitch-gray-dark/20 px-3 py-2 text-sm text-pitch-gray">
              Nessuno slot extra.
            </div>
          ) : (
            extraAssignments.map((a) => renderAssignmentListRow(a))
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <select
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                const [roleCode, roleLocation] = v.split("__");
                const role = roles.find(
                  (r) => r.code === roleCode && r.location === roleLocation
                );
                if (role) {
                  void handleAddSlot(role.id);
                }
              }
              e.target.value = "";
            }}
            disabled={addingSlot}
            className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
          >
            <option value="">Aggiungi slot...</option>
            {rolesForAddSlot.map((r) => (
              <option key={r.id} value={`${r.code}__${r.location}`}>
                {r.name} ({r.location})
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-5">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-base font-semibold text-pitch-white">Legenda status</h3>
          <span className="text-xs text-pitch-gray">
            {legendOpen ? "Nascondi" : "Mostra"}
          </span>
        </button>
        {legendOpen ? (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-md border border-pitch-gray-dark bg-pitch-gray-dark/20 p-2 text-xs">
              <div className="mb-1.5 font-semibold text-pitch-gray-light">
                Assignment status (event)
              </div>
              {(
                Object.entries(EVENT_ASSIGNMENTS_STATUS_INFO) as [
                  EventAssignmentsStatus,
                  { label: string; description: string },
                ][]
              ).map(([key, info]) => (
                <div
                  key={key}
                  className="mb-1.5 flex flex-wrap items-start gap-x-2 gap-y-0.5"
                >
                  <code className="shrink-0 pt-0.5 font-mono text-[10px] text-pitch-accent">
                    {key}
                  </code>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-pitch-gray-dark px-2 py-0.5 text-[11px] font-medium text-pitch-gray-light">
                    {info.label}
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] leading-snug text-pitch-gray-light">
                    {info.description}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-pitch-gray-dark bg-pitch-gray-dark/20 p-2 text-xs">
              <div className="mb-1.5 font-semibold text-pitch-gray-light">
                Individual assignment status
              </div>
              {(
                Object.entries(ASSIGNMENT_STATUS_INFO) as [
                  AssignmentStatus,
                  { label: string; description: string },
                ][]
              ).map(([key, info]) => (
                <div
                  key={key}
                  className="mb-1.5 flex flex-wrap items-start gap-x-2 gap-y-0.5"
                >
                  <code className="shrink-0 pt-0.5 font-mono text-[10px] text-pitch-accent">
                    {key}
                  </code>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-pitch-gray-dark px-2 py-0.5 text-[11px] font-medium text-pitch-gray-light">
                    {info.label}
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] leading-snug text-pitch-gray-light">
                    {info.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {staffPickerForId && (
        <StaffPicker
          assignmentId={staffPickerForId}
          assignments={assignments}
          staffList={staffList}
          errorMessage={pickerError}
          staticWarning={pickerStaticWarning}
          onClose={() => setStaffPickerForId(null)}
          onSelect={handleAssignStaff}
        />
      )}
      {showRegenerateModal ? (
        <ConfirmModal
          title="Rigenera requirements"
          body={<p>{regenerateMessage}</p>}
          confirmLabel="Rigenera"
          cancelLabel="Ignora per ora"
          onConfirm={() => {
            void confirmRegenerateFromStandard();
          }}
          onCancel={() => setShowRegenerateModal(false)}
        />
      ) : null}
      {showReadyEventModal && readyEventCoverage ? (
        <ConfirmModal
          title="Ready to Send evento"
          body={
            readyEventCoverage.simple ? (
              <p>Tutti i requirements risultano coperti.</p>
            ) : (
              <div className="space-y-2">
                <p>
                  {readyEventCoverage.covered} su {readyEventCoverage.totalRequired} requirements coperti.
                </p>
                <p>Posizioni ancora vuote:</p>
                <ul className="list-disc pl-5">
                  {readyEventCoverage.missingRoles.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p>Potrai assegnare le posizioni mancanti e inviarle separatamente.</p>
              </div>
            )
          }
          confirmLabel="Conferma comunque"
          cancelLabel="Torna e completa"
          onConfirm={() => {
            void confirmReadyToSendEvent();
          }}
          onCancel={() => {
            setShowReadyEventModal(false);
            setReadyEventCoverage(null);
          }}
        />
      ) : null}
    </>
  );
}
