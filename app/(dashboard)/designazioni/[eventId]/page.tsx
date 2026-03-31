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
  type AssignmentStatus,
  type AssignmentWithJoins,
} from "@/lib/api/assignments";
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
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
          Bozza
        </span>
      );
    case "READY_TO_SEND":
      return (
        <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">
          Pronto invio
        </span>
      );
    case "SENT":
      return (
        <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300">
          Inviato
        </span>
      );
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
      return "Bozza";
    case "READY":
      return "Pronto";
    case "SENT":
      return "Inviato";
    case "CONFIRMED":
      return "Confermato";
    case "REJECTED":
      return "Rifiutato";
    default:
      return status;
  }
}

/** Valori `EventAssignmentsStatus` (tipo frontend); sul DB compaiono soprattutto DRAFT e READY_TO_SEND. */
const EVENT_ASSIGNMENTS_STATUS_INFO = {
  DRAFT: {
    label: "Bozza",
    description:
      "Designazioni dell’evento ancora in lavorazione, senza invio mail collettivo completato.",
  },
  READY_TO_SEND: {
    label: "Pronto invio",
    description:
      "Evento pronto per generare/inviare le email di designazione ai freelance.",
  },
  SENT: {
    label: "Inviato",
    description:
      "Solo uso UI/API esteso: mail inviate; esito sulle singole righe (AssignmentStatus).",
  },
} satisfies Record<
  EventAssignmentsStatus,
  { label: string; description: string }
>;

/** Valori `AssignmentStatus` (allineati a pitch-backend). */
const ASSIGNMENT_STATUS_INFO = {
  DRAFT: {
    label: "Bozza",
    description:
      "Slot creato o in bozza, spesso senza persona o fuori dal blocco «pronto all’invio».",
  },
  READY: {
    label: "Pronto",
    description:
      "Riga inclusa nel prossimo invio mail (checkbox OK in tabella).",
  },
  SENT: {
    label: "Inviato",
    description: "Notifica inviata al freelance, in attesa di conferma o rifiuto.",
  },
  CONFIRMED: {
    label: "Confermato",
    description: "Il freelance ha accettato l’assegnazione.",
  },
  REJECTED: {
    label: "Rifiutato",
    description: "Il freelance ha rifiutato; serve riassegnare o rivedere lo slot.",
  },
} satisfies Record<AssignmentStatus, { label: string; description: string }>;

const btnSmallYellow =
  "rounded bg-pitch-accent px-2 py-1 text-xs font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50";
const btnSmallGrey =
  "rounded border border-pitch-gray px-2 py-1 text-xs text-pitch-gray hover:bg-pitch-gray-dark disabled:opacity-50";

type RoleSummary = {
  roleId: number;
  roleCode: string;
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

function assignmentRoleId(a: AssignmentWithJoins): number {
  const id = a.role_id ?? (a as { roleId?: number }).roleId;
  return Number(id);
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
    number,
    { required: number; roleCode: string; description: string }
  >();

  for (const req of standardRequirements) {
    const rid = Number(req.roleId);
    if (!Number.isFinite(rid)) continue;
    const q = safeStandardQuantity(req.quantity);
    const code = String(req.roleCode ?? "").trim();
    const desc = String(req.roleName ?? "").trim();
    const prev = fromStandards.get(rid);
    if (prev) {
      fromStandards.set(rid, {
        required: prev.required + q,
        roleCode: prev.roleCode || code,
        description: prev.description || desc,
      });
    } else {
      fromStandards.set(rid, {
        required: q,
        roleCode: code,
        description: desc,
      });
    }
  }

  const slotStats = new Map<
    number,
    { slots: number; assigned: number; roleCode: string }
  >();

  for (const a of assignments) {
    const rid = assignmentRoleId(a);
    if (!Number.isFinite(rid)) continue;
    const code = assignmentRoleCode(a);
    const staff = a.staffId ?? a.staff_id;
    const assignedInc = staff != null ? 1 : 0;
    const cur = slotStats.get(rid) ?? {
      slots: 0,
      assigned: 0,
      roleCode: code,
    };
    slotStats.set(rid, {
      slots: cur.slots + 1,
      assigned: cur.assigned + assignedInc,
      roleCode: cur.roleCode || code,
    });
  }

  const allIds = new Set<number>([
    ...fromStandards.keys(),
    ...slotStats.keys(),
  ]);

  const rows: RoleSummary[] = [];
  for (const roleId of allIds) {
    const std = fromStandards.get(roleId);
    const st = slotStats.get(roleId);
    rows.push({
      roleId,
      roleCode: std?.roleCode || st?.roleCode || "—",
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
  onClose,
  onSelect,
}: {
  assignmentId: number;
  assignments: AssignmentWithJoins[];
  staffList: StaffItem[];
  errorMessage?: string | null;
  onClose: () => void;
  onSelect: (assignmentId: number, staffId: number) => void;
}) {
  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) return null;

  const roleCode = assignment.roleCode ?? "";
  const candidates = staffList.filter(
    (s) => s.default_role_code === roleCode
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-4">
        <div className="mb-2 text-sm font-semibold text-pitch-white">
          Assegna {roleCode || "—"}
        </div>
        {errorMessage ? (
          <p
            role="alert"
            className="mb-3 rounded border border-red-800/60 bg-red-950/50 px-3 py-2 text-xs text-red-200"
          >
            {errorMessage}
          </p>
        ) : null}
        <ul className="max-h-64 overflow-auto text-sm">
          {candidates.length === 0 ? (
            <li className="text-pitch-gray">Nessuna persona compatibile</li>
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
          Chiudi
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

      const [assignData, rolesData, stdData] = await Promise.all([
        fetchAssignmentsByEvent(eventId),
        fetchRoles(),
        (async (): Promise<StandardRequirementWithRole[]> => {
          if (
            !ev?.standardOnsite?.trim() ||
            !ev?.standardCologno?.trim()
          ) {
            return [];
          }
          try {
            return await fetchStandardRequirements({
              standardOnsite: ev.standardOnsite.trim(),
              standardCologno: ev.standardCologno.trim(),
              ...(ev.areaProduzione?.trim()
                ? { areaProduzione: ev.areaProduzione.trim() }
                : {}),
              page: 0,
              pageSize: 500,
            });
          } catch {
            return [];
          }
        })(),
      ]);

      setAssignments(assignData);
      setRoles(rolesData);
      setStandardRequirements(stdData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel caricamento");
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
    fetchStaff({ limit: 200 })
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

  const hasAnyReady = assignments.some((a) => readyMap[a.id]);

  const roleSummaries = useMemo(
    () => buildRoleSummaries(standardRequirements, assignments),
    [standardRequirements, assignments]
  );

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

  const reloadAssignments = useCallback(async () => {
    const data = await fetchAssignmentsByEvent(eventId);
    setAssignments(data);
  }, [eventId]);

  const handleAssignStaff = async (assignmentId: number, staffId: number) => {
    setPickerError(null);
    try {
      const row = assignments.find((x) => x.id === assignmentId);
      if (!row) {
        setPickerError("Slot non trovato.");
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
          : "Non è stato possibile aggiornare lo slot."
      );
    }
  };

  const handleClearStaff = async (assignmentId: number) => {
    try {
      const row = assignments.find((x) => x.id === assignmentId);
      await updateDesignatorAssignment(assignmentId, {
        staffId: null,
        ...(row ? assignmentRoleForApi(row) : {}),
      });
      await reloadAssignments();
      setReadyMap((prev) => ({ ...prev, [assignmentId]: false }));
    } catch (err) {
      console.error(err);
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
      alert(e instanceof Error ? e.message : "Errore");
    } finally {
      setActioningId(null);
    }
  };

  const handleAddSlot = async (roleId: number) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      alert("Ruolo non trovato.");
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
      alert(e instanceof Error ? e.message : "Errore");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleRegenerateFromStandard = async () => {
    if (!event?.standardOnsite || !event?.standardCologno) return;

    setIsGeneratingFromStandard(true);
    try {
      await generateAssignmentsFromStandard(event.id);
      const freshAssignments = await fetchAssignmentsByEvent(event.id);
      setAssignments(freshAssignments);
      setReadyMap({});
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Errore nella rigenerazione");
    } finally {
      setIsGeneratingFromStandard(false);
    }
  };

  const handleReadyToSend = async () => {
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

  if (loading && assignments.length === 0) {
    return (
      <>
        <PageHeader title="Designazioni evento" />
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
          Caricamento...
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Designazioni evento" />
        <div className="mt-6 rounded-lg border border-red-900/50 bg-red-900/20 p-6 text-red-300">
          {error}
        </div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <PageHeader title="Designazioni evento" />
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
          Evento non trovato
        </div>
      </>
    );
  }

  const match =
    event?.homeTeamNameShort && event?.awayTeamNameShort
      ? `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`
      : event?.homeTeamNameShort ?? event?.awayTeamNameShort ?? "—";

  return (
    <>
      <PageHeader
        title="Designazioni"
        subtitle={
          <Link
            href="/designazioni"
            className="text-pitch-gray hover:text-pitch-accent"
          >
            ← Torna alla lista
          </Link>
        }
      />

      <section className="mt-4 space-y-2">
        <h2 className="text-sm font-semibold text-pitch-white">
          Legenda stati
        </h2>
        <p className="text-[11px] leading-snug text-pitch-gray">
          Enum{" "}
          <code className="rounded bg-pitch-gray-dark px-1 font-mono text-[10px] text-pitch-accent">
            EventAssignmentsStatus
          </code>{" "}
          → campo{" "}
          <code className="rounded bg-pitch-gray-dark px-1 font-mono text-[10px] text-pitch-gray-light">
            assignments_status
          </code>
          ; enum{" "}
          <code className="rounded bg-pitch-gray-dark px-1 font-mono text-[10px] text-pitch-accent">
            AssignmentStatus
          </code>{" "}
          → campo{" "}
          <code className="rounded bg-pitch-gray-dark px-1 font-mono text-[10px] text-pitch-gray-light">
            status
          </code>{" "}
          su ogni riga.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-pitch-gray-dark bg-pitch-gray-dark/20 p-2 text-xs">
            <div className="mb-1.5 font-semibold text-pitch-gray-light">
              Stato designazioni (evento)
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
              Stato singole assegnazioni
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
            <p className="mt-1.5 border-t border-pitch-gray-dark/60 pt-1.5 text-[10px] leading-snug text-pitch-gray">
              <code className="font-mono text-pitch-gray-light">ACCEPTED</code> /{" "}
              <code className="font-mono text-pitch-gray-light">DECLINED</code>
              : solo legacy in dati/UI, trattati come Confermato / Rifiutato nei colori
              tabella.
            </p>
          </div>
        </div>
      </section>

      {/* Select evento */}
      <div className="mt-6">
        <label className="mb-2 block text-sm text-pitch-gray">
          Evento
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
                {formatKoItaly(ev.koItaly)} – {ev.homeTeamNameShort} vs{" "}
                {ev.awayTeamNameShort}
              </option>
            ));
          })()}
        </select>
      </div>

      {/* Riepilogo evento */}
      <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-sm text-pitch-gray">Data e KO: </span>
            <span className="text-pitch-white">
              {formatKoItaly(event.koItaly)}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Match: </span>
            <span className="text-pitch-white">{match}</span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Competizione: </span>
            <span className="text-pitch-white">
              {event.competitionName}
              {event.competitionCode ? ` (${event.competitionCode})` : ""}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Area produzione: </span>
            <span className="text-pitch-white">
              {event.areaProduzione ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Show: </span>
            <span className="text-pitch-white">{event.showName ?? "—"}</span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Stato evento: </span>
            <span className="text-pitch-white">{event.status}</span>
          </div>
          <div>
            <span className="text-sm text-pitch-gray">Stato designazioni: </span>
            {renderAssignmentsStatusBadge(event.assignmentsStatus)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReadyToSend}
              disabled={!hasAnyReady}
              className="rounded bg-pitch-accent px-3 py-1 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:bg-pitch-gray-dark disabled:text-pitch-gray"
            >
              Pronto all&apos;invio
            </button>
            <button
              type="button"
              onClick={handleRegenerateFromStandard}
              disabled={
                !event.standardOnsite ||
                !event.standardCologno ||
                isGeneratingFromStandard
              }
              className="rounded border border-pitch-gray px-3 py-1 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingFromStandard ? "Rigenerazione..." : "Rigenera da standard"}
            </button>
          </div>
        </div>
      </div>

      {/* Standard vs assegnato (riepilogo per ruolo) */}
      <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-5">
        <h3 className="text-base font-semibold text-pitch-white">
          Standard vs assegnato per ruolo
        </h3>
        <p className="mt-1 text-xs text-pitch-gray">
          Confronto tra FTE richiesti dagli standard e slot/assegnazioni
          correnti per <code className="text-pitch-gray-light">roleId</code>.
        </p>
        {standardRequirements.length === 0 ? (
          <p className="mt-4 text-sm text-pitch-gray">
            Nessuno standard requirement trovato per questo evento (mancano
            standard onsite/cologno o nessuna riga in anagrafica).
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                  <th className="px-3 py-2 font-medium">Ruolo</th>
                  <th className="px-3 py-2 font-medium text-right">Richiesti</th>
                  <th className="px-3 py-2 font-medium text-right">Slot</th>
                  <th className="px-3 py-2 font-medium text-right">Assegnati</th>
                  <th className="px-3 py-2 font-medium">Situazione</th>
                </tr>
              </thead>
              <tbody>
                {roleSummaries.map((row) => {
                  const lackSlots = row.required > row.slots;
                  const extraSlots = row.slots > row.required && row.required > 0;
                  const extraOnly = row.required === 0 && row.slots > 0;

                  let situation: ReactNode = (
                    <span className="text-pitch-gray">—</span>
                  );
                  if (lackSlots) {
                    situation = (
                      <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-200">
                        Mancano {row.required - row.slots} slot
                      </span>
                    );
                  } else if (extraSlots) {
                    situation = (
                      <span className="rounded-full bg-sky-900/40 px-2 py-0.5 text-xs text-sky-200">
                        +{row.slots - row.required} oltre standard
                      </span>
                    );
                  } else if (extraOnly) {
                    situation = (
                      <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-pitch-gray-light">
                        Solo extra (non in standard)
                      </span>
                    );
                  } else if (row.required > 0) {
                    situation = (
                      <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-200">
                        Slot allineati
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={row.roleId}
                      className="border-b border-pitch-gray-dark/40"
                    >
                      <td className="px-3 py-2 text-pitch-white">
                        <span className="font-medium">{row.roleCode}</span>
                        {row.description ? (
                          <span className="ml-2 text-xs text-pitch-gray">
                            {row.description}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-[10px] text-pitch-gray">
                          id {row.roleId}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-pitch-gray-light">
                        {row.required}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          lackSlots ? "text-amber-200" : "text-pitch-gray-light"
                        }`}
                      >
                        {row.slots}
                      </td>
                      <td className="px-3 py-2 text-right text-pitch-gray-light tabular-nums">
                        {row.assigned}
                        {row.slots > 0 && row.assigned < row.slots ? (
                          <span className="ml-1 text-[10px] text-amber-300">
                            ({row.slots - row.assigned} liberi)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{situation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabella Assegnazioni */}
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-pitch-white">
          Assegnazioni
        </h3>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => {
              const v = e.target.value;
              if (v) handleAddSlot(Number(v));
              e.target.value = "";
            }}
            disabled={addingSlot}
            className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
          >
            <option value="">Aggiungi slot...</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} - {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        {assignments.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
            Nessuna assegnazione. Aggiungi uno slot.
          </div>
        ) : (
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Ruolo
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Persona
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Fee
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Note
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  OK
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-pitch-gray">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.map((a) => {
                const isAssigned = a.staffId != null;
                const roleCode = a.roleCode || "—";

                return (
                  <tr
                    key={a.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-2 text-xs text-pitch-gray-light">
                      {roleCode}
                    </td>
                    <td className="px-4 py-2">
                      {isAssigned ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setStaffPickerForId(a.id)}
                            className={btnSmallYellow}
                          >
                            {a.staffSurname} {a.staffName}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearStaff(a.id)}
                            className={btnSmallGrey}
                          >
                            Svuota
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStaffPickerForId(a.id)}
                          className={btnSmallYellow}
                        >
                          Assegna
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-pitch-gray-light">
                      {a.staffFee != null ? a.staffFee : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAssignmentStatusClasses(a.status)}`}
                      >
                        {getAssignmentStatusLabel(a.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        defaultValue={a.notes ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (a.notes ?? "")) {
                            handleNotesChange(a.id, v);
                          }
                        }}
                        className="w-32 rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1 text-sm text-pitch-white"
                        placeholder="Note..."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={!!readyMap[a.id]}
                        disabled={!isAssigned}
                        onChange={(e) => {
                          setReadyMap((prev) => ({
                            ...prev,
                            [a.id]: e.target.checked,
                          }));
                        }}
                        className="h-4 w-4 rounded border-pitch-gray-dark"
                        title={
                          !isAssigned
                            ? "Seleziona prima una persona"
                            : "Designazione pronta"
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-300"
                        onClick={async () => {
                          const confirmDelete = window.confirm(
                            "Vuoi cancellare questo slot?"
                          );
                          if (!confirmDelete) return;
                          try {
                            await deleteDesignatorAssignment(a.id);
                            await reloadAssignments();
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      >
                        Cancella
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {staffPickerForId && (
        <StaffPicker
          assignmentId={staffPickerForId}
          assignments={assignments}
          staffList={staffList}
          errorMessage={pickerError}
          onClose={() => setStaffPickerForId(null)}
          onSelect={handleAssignStaff}
        />
      )}
    </>
  );
}
