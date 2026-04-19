"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api/apiFetch";

type AuditLogItem = {
  id: number;
  createdAt: string;
  actorType: "staff" | "system";
  actorId: number | null;
  actorName: string;
  entityType: string;
  entityId: string;
  action: string;
  actionLabel: string;
  entityLabel: string;
  metadata: unknown;
};

type AuditLogResponse = {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
};

const FILTER_SELECT_CLASS =
  "rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

/** Etichette UI (stesso dizionario del backend per i tipi noti). */
const ENTITY_LABELS_IT: Record<string, string> = {
  assignment: "Assegnazione",
  event: "Evento",
  role: "Ruolo",
  staff: "Staff",
  cookies_task: "Attività",
  standard: "Standard",
};

function entityTypeLabelIt(entityType: string): string {
  const t = entityType.trim();
  return ENTITY_LABELS_IT[t] ?? t;
}

/** Colonna Entity: nome da metadata se presente, altrimenti solo tipo in italiano (senza ID). */
function entityColumnDisplay(item: AuditLogItem): string {
  const m = metaRecord(item.metadata);
  if (m) {
    if (
      typeof m.entityName === "string" &&
      m.entityName.trim()
    ) {
      return m.entityName.trim();
    }
    if (typeof m.name === "string" && m.name.trim()) {
      return m.name.trim();
    }
    if (typeof m.title === "string" && m.title.trim()) {
      return m.title.trim();
    }
  }
  return entityTypeLabelIt(item.entityType);
}

function formatDateTimeIt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function metaRecord(meta: unknown): Record<string, unknown> | null {
  if (
    meta !== undefined &&
    meta !== null &&
    typeof meta === "object" &&
    !Array.isArray(meta)
  ) {
    return meta as Record<string, unknown>;
  }
  return null;
}

function fieldColumn(meta: unknown): string {
  const m = metaRecord(meta);
  if (!m) return "—";
  const field = m.field;
  if (typeof field === "string" && field.trim()) return field.trim();
  const cf = m.changedFields;
  if (
    Array.isArray(cf) &&
    cf.length > 0 &&
    typeof cf[0] === "string" &&
    cf[0].trim()
  ) {
    return cf[0].trim();
  }
  return "—";
}

function oldValueColumn(meta: unknown, action: string): string {
  if (action === "create") return "—";
  const m = metaRecord(meta);
  if (!m) return "—";
  if ("from" in m && m.from !== undefined && m.from !== null) {
    return String(m.from);
  }
  if ("oldValue" in m && m.oldValue !== undefined && m.oldValue !== null) {
    return String(m.oldValue);
  }
  return "—";
}

/** Per action create: primo valore utile nei campi tipici, poi primo primitivo non vuoto. */
function firstSignificantCreateValue(meta: unknown): string {
  const m = metaRecord(meta);
  if (!m) return "—";
  const priorityKeys = ["name", "title", "code", "entityName"] as const;
  for (const k of priorityKeys) {
    const v = m[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  const skip = new Set([
    "changedFields",
    "from",
    "to",
    "oldValue",
    "newValue",
    "field",
  ]);
  for (const [k, v] of Object.entries(m)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return "—";
}

function newValueColumn(meta: unknown, action: string): string {
  if (action === "create") {
    return firstSignificantCreateValue(meta);
  }
  const m = metaRecord(meta);
  if (!m) return "—";
  if ("to" in m && m.to !== undefined && m.to !== null) {
    return String(m.to);
  }
  if ("newValue" in m && m.newValue !== undefined && m.newValue !== null) {
    return String(m.newValue);
  }
  return "—";
}

function fullMetadataJson(meta: unknown): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

export default function CronologiaPage() {
  const [entityType, setEntityType] = useState("");
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenEntityTypes, setSeenEntityTypes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: "100" });
      if (entityType) {
        q.set("entityType", entityType);
      }
      const res = await apiFetch(`/api/audit-log?${q.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as AuditLogResponse;
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setTotal(typeof data.total === "number" ? data.total : list.length);

      const fromPayload = [
        ...new Set(list.map((i) => i.entityType).filter(Boolean)),
      ];
      setSeenEntityTypes((prev) =>
        Array.from(new Set([...prev, ...fromPayload])).sort()
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load history."
      );
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const entityTypeOptions = useMemo(() => {
    const predefined: { value: string; label: string }[] = [
      { value: "", label: "Tutte le entità" },
      { value: "assignment", label: ENTITY_LABELS_IT.assignment },
      { value: "event", label: ENTITY_LABELS_IT.event },
      { value: "role", label: ENTITY_LABELS_IT.role },
      { value: "staff", label: ENTITY_LABELS_IT.staff },
      { value: "cookies_task", label: ENTITY_LABELS_IT.cookies_task },
      { value: "standard", label: ENTITY_LABELS_IT.standard },
    ];
    const known = new Set(predefined.map((o) => o.value));
    const extra = seenEntityTypes
      .filter((t) => t && !known.has(t))
      .map((t) => ({ value: t, label: entityTypeLabelIt(t) }));
    return [...predefined, ...extra];
  }, [seenEntityTypes]);

  return (
    <>
      <PageHeader title="History" />

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="cronologia-entity-type"
            className="mb-1 block text-xs text-pitch-gray"
          >
            Tipo entità
          </label>
          <select
            id="cronologia-entity-type"
            className={FILTER_SELECT_CLASS}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            disabled={loading}
          >
            {entityTypeOptions.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {!loading && !error ? (
          <p className="text-xs text-pitch-gray">
            {items.length} entries shown
            {total > items.length ? ` (total filtered: ${total})` : null}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-pitch-gray">Loading…</p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-center text-sm text-pitch-gray">
          No history entries.
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-pitch-gray-dark">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Date/Time
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  User
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Entity
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Action
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Campo
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Valore precedente
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Nuovo valore
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/15"
                  title={fullMetadataJson(row.metadata)}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-pitch-gray-light">
                    {formatDateTimeIt(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.actorName ?? "Sistema"}
                  </td>
                  <td className="px-4 py-3 text-pitch-white">
                    {entityColumnDisplay(row)}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.actionLabel}
                  </td>
                  <td className="max-w-[140px] px-4 py-3 text-xs text-pitch-gray-light">
                    {fieldColumn(row.metadata)}
                  </td>
                  <td className="max-w-[180px] break-words px-4 py-3 text-xs text-pitch-gray">
                    {oldValueColumn(row.metadata, row.action)}
                  </td>
                  <td className="max-w-[180px] break-words px-4 py-3 text-xs text-pitch-gray">
                    {newValueColumn(row.metadata, row.action)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
