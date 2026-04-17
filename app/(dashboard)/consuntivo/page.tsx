"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api/apiFetch";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { canSeeFinance } from "@/lib/auth/financeAccess";
import MultiSelectFilter, {
  type MultiSelectOption,
} from "@/components/MultiSelectFilter";
import { fetchRoles } from "@/lib/api/roles";
import { fetchStaff } from "@/lib/api/staff";

type ConsuntivoRow = {
  eventId: string;
  eventDate: string | null;
  matchday: number | null;
  staffId: number;
  staffName: string;
  providerId: number | null;
  providerName: string | null;
  providerSurname: string | null;
  providerCompany: string | null;
  roleCode: string;
  roleName: string;
  location: string | null;
  fee: number;
  extraFee: number;
  invoicedAmount: number | null;
  assignmentStatus: string;
};

type ConsuntivoResponse = {
  items: ConsuntivoRow[];
  total: number;
  totalAmount: number;
};

type ProviderOption = {
  id: number;
  name: string;
  surname: string;
  company: string | null;
};

type MatchdaysResponse = {
  matchdays?: number[];
};

const INPUT_CLASS =
  "rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

const BTN_PRIMARY =
  "rounded bg-pitch-accent px-4 py-2 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "READY", label: "READY" },
  { value: "SENT", label: "SENT" },
  { value: "CONFIRMED", label: "CONFIRMED" },
];

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const dateTimeIt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatEventDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeIt.format(d);
}

async function readFetchError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

export default function ConsuntivoPage() {
  const [showFinance, setShowFinance] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedMatchdays, setSelectedMatchdays] = useState<string[]>([]);
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [matchdayOptions, setMatchdayOptions] = useState<MultiSelectOption[]>(
    []
  );
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<MultiSelectOption[]>([]);

  const [rawItems, setRawItems] = useState<ConsuntivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsuntivo = useCallback(
    async (params: {
      from: string;
      to: string;
      matchdays: string[];
      roleCodes: string[];
      providerIds: string[];
      staffIds: string[];
      status: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (params.from.trim()) q.set("from", params.from.trim());
        if (params.to.trim()) q.set("to", params.to.trim());
        params.matchdays.forEach((v) => q.append("matchdays", v));
        params.roleCodes.forEach((v) => q.append("roleCodes", v));
        params.providerIds.forEach((v) => q.append("providerIds", v));
        params.staffIds.forEach((v) => q.append("staffIds", v));
        if (params.status.trim()) {
          q.set("status", params.status.trim());
        }

        const qs = q.toString();
        const res = await apiFetch(
          `/api/consuntivo${qs ? `?${qs}` : ""}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(await readFetchError(res));
        }
        const data = (await res.json()) as ConsuntivoResponse;
        setRawItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to load summary."
        );
        setRawItems([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchProviders = useCallback(async () => {
    try {
      const res = await apiFetch("/api/providers", { cache: "no-store" });
      if (!res.ok) throw new Error(await readFetchError(res));
      const items = (await res.json()) as Array<Record<string, unknown>>;
      setProviderOptions(
        items
          .map((p) => ({
            id: Number(p.id ?? 0),
            name: String(p.name ?? ""),
            surname: String(p.surname ?? ""),
            company:
              p.company != null && String(p.company).trim() !== ""
                ? String(p.company)
                : null,
          }))
          .filter((p) => Number.isFinite(p.id) && p.id > 0)
      );
    } catch {
      setProviderOptions([]);
    }
  }, []);

  const fetchMatchdays = useCallback(async () => {
    try {
      const res = await apiFetch("/api/events/matchdays", { cache: "no-store" });
      if (!res.ok) throw new Error(await readFetchError(res));
      const body = (await res.json()) as MatchdaysResponse;
      const options = (body.matchdays ?? [])
        .filter((md) => Number.isFinite(md))
        .map((md) => ({ value: String(md), label: `MD ${md}` }));
      setMatchdayOptions(options);
    } catch {
      setMatchdayOptions([]);
    }
  }, []);

  const fetchRoleOptions = useCallback(async () => {
    try {
      const roles = await fetchRoles();
      setRoleOptions(
        roles.map((role) => ({
          value: role.code,
          label: role.name?.trim() ? role.name : role.code,
        }))
      );
    } catch {
      setRoleOptions([]);
    }
  }, []);

  const fetchStaffOptions = useCallback(async () => {
    try {
      const response = await fetchStaff({ limit: 200, offset: 0 });
      const options = (response.items ?? [])
        .map((staff) => ({
          value: String(staff.id),
          label: `${staff.surname ?? ""} ${staff.name ?? ""}`.trim(),
          surname: String(staff.surname ?? "").toLowerCase(),
          name: String(staff.name ?? "").toLowerCase(),
        }))
        .filter((item) => item.label.length > 0)
        .sort((a, b) =>
          a.surname === b.surname
            ? a.name.localeCompare(b.name, "it")
            : a.surname.localeCompare(b.surname, "it")
        )
        .map(({ value, label }) => ({ value, label }));
      setStaffOptions(options);
    } catch {
      setStaffOptions([]);
    }
  }, []);

  useEffect(() => {
    void fetchConsuntivo({
      from: "",
      to: "",
      matchdays: [],
      roleCodes: [],
      providerIds: [],
      staffIds: [],
      status: "",
    });
  }, [fetchConsuntivo]);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    void fetchMatchdays();
    void fetchRoleOptions();
    void fetchStaffOptions();
  }, [fetchMatchdays, fetchRoleOptions, fetchStaffOptions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled) {
          setShowFinance(canSeeFinance(me));
        }
      } catch {
        if (!cancelled) setShowFinance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => rawItems, [rawItems]);

  const visibleTotalFee = useMemo(
    () => filteredItems.reduce((sum, r) => sum + (Number(r.fee) || 0), 0),
    [filteredItems]
  );

  const handleApplyFilters = () => {
    void fetchConsuntivo({
      from,
      to,
      matchdays: selectedMatchdays,
      roleCodes: selectedRoleCodes,
      providerIds: selectedProviderIds,
      staffIds: selectedStaffIds,
      status,
    });
  };

  return (
    <>
      <PageHeader title="Scorecard" />

      <div className="mt-4 space-y-4 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/10 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">From</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">To</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={loading}
            />
          </div>
          <MultiSelectFilter
            label="MD"
            options={matchdayOptions}
            selected={selectedMatchdays}
            onChange={setSelectedMatchdays}
            placeholder="Seleziona MD"
          />
          <MultiSelectFilter
            label="Nominativo"
            options={staffOptions}
            selected={selectedStaffIds}
            onChange={setSelectedStaffIds}
            placeholder="Seleziona staff"
          />
          <MultiSelectFilter
            label="Ruolo"
            options={roleOptions}
            selected={selectedRoleCodes}
            onChange={setSelectedRoleCodes}
            placeholder="Seleziona ruolo"
          />
          <MultiSelectFilter
            label="Provider"
            options={providerOptions.map((provider) => {
              const fallbackName =
                `${provider.name} ${provider.surname}`.trim() || `#${provider.id}`;
              return {
                value: String(provider.id),
                label: provider.company?.trim() || fallbackName,
              };
            })}
            selected={selectedProviderIds}
            onChange={setSelectedProviderIds}
            placeholder="Seleziona provider"
          />
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">Status</label>
            <select
              className={INPUT_CLASS}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={loading}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 border-t border-pitch-gray-dark/50 pt-4">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={loading}
            onClick={handleApplyFilters}
          >
            Apply filters
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!showFinance ? (
        <p className="mt-4 rounded border border-pitch-gray-dark bg-pitch-gray-dark/30 px-3 py-2 text-sm text-pitch-gray-light">
          I dati economici non sono visibili con il tuo profilo.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-pitch-gray">Loading…</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-6 text-sm text-pitch-gray-light">
        <span>
          Rows: <strong className="text-pitch-white">{filteredItems.length}</strong>
        </span>
        {showFinance ? (
          <span>
            Total fee (visible rows):{" "}
            <strong className="text-pitch-white">
              {eur.format(visibleTotalFee)}
            </strong>
          </span>
        ) : null}
      </div>

      {!loading && !error && filteredItems.length === 0 ? (
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-center text-sm text-pitch-gray">
          No rows for the selected filters.
        </div>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-pitch-gray-dark">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Event date
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  MD
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Staff
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Provider
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Location
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Status
                </th>
                {showFinance ? (
                  <th className="px-4 py-3 text-right font-medium text-pitch-gray">
                    Fee
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row, idx) => (
                <tr
                  key={`${row.eventId}-${row.staffId}-${row.roleCode}-${row.assignmentStatus}-${idx}`}
                  className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/10"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-pitch-gray-light">
                    {formatEventDate(row.eventDate)}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.matchday ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    <span className="text-pitch-white">{row.staffName}</span>
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.providerCompany?.trim()
                      ? row.providerCompany
                      : `${row.providerName ?? ""} ${row.providerSurname ?? ""}`.trim() ||
                        "—"}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    <span className="font-mono text-xs text-pitch-white">
                      {row.roleCode}
                    </span>
                    <span className="ml-1 text-pitch-gray">· {row.roleName}</span>
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.assignmentStatus}
                  </td>
                  {showFinance ? (
                    <td className="whitespace-nowrap px-4 py-3 text-right text-pitch-white">
                      {eur.format(Number(row.fee) || 0)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
