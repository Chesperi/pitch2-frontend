"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api/apiFetch";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { canSeeFinance } from "@/lib/auth/financeAccess";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";
import DesktopRecommended from "@/components/ui/DesktopRecommended";
import ComposableFilters, {
  type ActiveFilter,
  type FilterOption,
} from "@/components/ui/ComposableFilters";

type ConsuntivoRow = {
  eventId: string;
  eventDate: string | null;
  koItalyTime: string | null;
  competitionName: string | null;
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
  fee: number | null;
  extraFee: number | null;
  invoicedAmount: number | null;
  assignmentStatus: string;
};

type ConsuntivoResponse = {
  items: ConsuntivoRow[];
  total: number;
  totalAmount: number | null;
};

type FilterProvider = {
  id: number;
  name: string;
  surname: string;
  company: string | null;
  label: string;
};

type FilterStaff = {
  id: number;
  name: string;
  surname: string;
};

type FilterRole = {
  code: string;
  description: string | null;
  location: string | null;
};

type FilterOptionsResponse = {
  matchdays?: number[];
  staff?: FilterStaff[];
  roles?: FilterRole[];
  providers?: FilterProvider[];
  competitions?: string[];
  statuses?: string[];
};

type FilterOptionsState = {
  matchdays: Array<{ value: string; label: string }>;
  staff: Array<{ value: string; label: string }>;
  roles: Array<{ value: string; label: string }>;
  providers: Array<{ value: string; label: string; id: number }>;
  competitions: Array<{ value: string; label: string }>;
};

async function fetchFilterOptions(filters: {
  from: string;
  to: string;
}): Promise<FilterOptionsResponse> {
  const q = new URLSearchParams();
  if (filters.from.trim()) q.set("from", filters.from.trim());
  if (filters.to.trim()) q.set("to", filters.to.trim());
  const qs = q.toString();
  const res = await apiFetch(
    `/api/consuntivo/filter-options${qs ? `?${qs}` : ""}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(await readFetchError(res));
  return (await res.json()) as FilterOptionsResponse;
}

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function formatEventDate(dateIso: string | null, koItalyTime: string | null): string {
  if (!dateIso && !koItalyTime) return "—";

  let datePart = "—";
  if (dateIso) {
    const raw = String(dateIso).trim();
    const alreadyFormatted = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    if (alreadyFormatted) {
      datePart = raw;
    } else {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
      if (match) {
        datePart = `${match[3]}/${match[2]}/${match[1]}`;
      } else {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
          datePart = new Intl.DateTimeFormat("it-IT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(d);
        }
      }
    }
  }

  const koPart =
    koItalyTime != null && String(koItalyTime).trim() !== ""
      ? String(koItalyTime).trim().slice(0, 5)
      : null;
  return koPart ? `${datePart} ${koPart}` : datePart;
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
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsState>({
    matchdays: [],
    staff: [],
    roles: [],
    providers: [],
    competitions: [],
  });
  const [rawItems, setRawItems] = useState<ConsuntivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsuntivo = useCallback(
    async (params: { from: string; to: string; activeFilters: ActiveFilter[] }) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (params.from.trim()) q.set("from", params.from.trim());
        if (params.to.trim()) q.set("to", params.to.trim());
        const providerIdByLabel = new Map(
          filterOptions.providers.map((provider) => [provider.value, String(provider.id)])
        );
        for (const filter of params.activeFilters) {
          if (!filter.value) continue;
          if (filter.key === "competition") q.set("competition", filter.value);
          if (filter.key === "staff") q.set("nominativo", filter.value);
          if (filter.key === "role") q.set("roleCode", filter.value);
          if (filter.key === "matchday") q.set("matchday", filter.value);
          if (filter.key === "provider") {
            const providerId = providerIdByLabel.get(filter.value);
            if (providerId) q.set("providerId", providerId);
          }
          if (filter.key === "status") q.set("status", filter.value);
        }

        const qs = q.toString();
        const res = await apiFetch(`/api/consuntivo${qs ? `?${qs}` : ""}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await readFetchError(res));
        const data = (await res.json()) as ConsuntivoResponse;
        setRawItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load scorecard.");
        setRawItems([]);
      } finally {
        setLoading(false);
      }
    },
    [filterOptions.providers]
  );

  const loadFilterOptions = async (filters: { from: string; to: string }) => {
    setLoadingOptions(true);
    try {
      const data = await fetchFilterOptions(filters);

      const nextOptions: FilterOptionsState = {
        matchdays: (data.matchdays ?? [])
          .filter((md) => Number.isFinite(md))
          .sort((a, b) => a - b)
          .map((md) => ({ value: String(md), label: String(md) })),
        competitions: (data.competitions ?? [])
          .map((name) => String(name ?? "").trim())
          .filter((name) => name.length > 0)
          .sort((a, b) => a.localeCompare(b, "it"))
          .map((name) => ({ value: name, label: name })),
        staff: (data.staff ?? [])
          .map((staff) => ({
            value: `${staff.surname ?? ""} ${staff.name ?? ""}`.trim(),
            label: `${staff.surname ?? ""} ${staff.name ?? ""}`.trim(),
            surname: String(staff.surname ?? ""),
            name: String(staff.name ?? ""),
          }))
          .filter((staff) => staff.value.length > 0)
          .sort((a, b) =>
            a.surname === b.surname
              ? a.name.localeCompare(b.name, "it")
              : a.surname.localeCompare(b.surname, "it")
          )
          .map(({ value, label }) => ({ value, label })),
        roles: (data.roles ?? [])
          .map((role) => ({
            value: role.code,
            label: role.description?.trim()
              ? `${role.description}${role.location ? ` – ${role.location}` : ""}`
              : role.code,
            location: String(role.location ?? ""),
          }))
          .filter((role) => role.value.length > 0)
          .sort((a, b) =>
            a.value === b.value
              ? a.location.localeCompare(b.location, "it")
              : a.value.localeCompare(b.value, "it")
          )
          .map(({ value, label }) => ({ value, label })),
        providers: (data.providers ?? [])
          .map((provider) => ({
            value:
              provider.label?.trim() ||
              provider.company?.trim() ||
              `${provider.surname ?? ""} ${provider.name ?? ""}`.trim() ||
              `#${provider.id}`,
            label:
              provider.label?.trim() ||
              provider.company?.trim() ||
              `${provider.surname ?? ""} ${provider.name ?? ""}`.trim() ||
              `#${provider.id}`,
            id: provider.id,
          }))
          .filter((provider) => provider.id > 0)
          .sort((a, b) => a.label.localeCompare(b.label, "it")),
      };

      setFilterOptions(nextOptions);
    } catch (err) {
      console.error("filter-options error:", err);
    } finally {
      setLoadingOptions(false);
    }
  };

  const scorecardFilterOptions = useMemo<FilterOption[]>(
    () => [
      { key: "competition", label: "Competition", values: filterOptions.competitions },
      { key: "staff", label: "Staff", values: filterOptions.staff },
      { key: "role", label: "Role", values: filterOptions.roles },
      { key: "matchday", label: "Matchday", values: filterOptions.matchdays },
      { key: "provider", label: "Provider", values: filterOptions.providers },
      {
        key: "status",
        label: "Status",
        values: [
          { value: "SENT", label: "Sent", color: "#818cf8" },
          { value: "CONFIRMED", label: "Confirmed", color: "#4ade80" },
          { value: "DRAFT", label: "Draft", color: "#888" },
        ],
      },
    ],
    [filterOptions]
  );

  useEffect(() => {
    void fetchConsuntivo({ from: "", to: "", activeFilters: [] });
  }, [fetchConsuntivo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled) setShowFinance(canSeeFinance(me));
      } catch {
        if (!cancelled) setShowFinance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveFilters([]);
    void loadFilterOptions({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const visibleTotalFee = useMemo(
    () => rawItems.reduce((sum, r) => sum + (Number(r.fee) || 0), 0),
    [rawItems]
  );

  const handleApplyFilters = () => {
    void fetchConsuntivo({
      from,
      to,
      activeFilters,
    });
  };

  return (
    <>
      <PageHeader title="Scorecard" />
      <DesktopRecommended />

      <ComposableFilters
        className="mt-4"
        filters={scorecardFilterOptions}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
        dateRange={{
          from,
          to,
          onFromChange: setFrom,
          onToChange: setTo,
        }}
        onApply={handleApplyFilters}
      />

      {loadingOptions ? (
        <p className="mt-2 text-[11px] text-[#666]">Loading filter values...</p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!showFinance ? (
        <p className="mt-4 rounded border border-pitch-gray-dark bg-pitch-gray-dark/30 px-3 py-2 text-sm text-pitch-gray-light">
          Financial data is not visible for your profile.
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <PageLoading />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-6 text-sm text-pitch-gray-light">
        <span>
          Rows: <strong className="text-pitch-white">{rawItems.length}</strong>
        </span>
        {showFinance ? (
          <span>
            Total fee (visible rows):{" "}
            <strong className="text-pitch-white">{eur.format(visibleTotalFee)}</strong>
          </span>
        ) : null}
      </div>

      {!loading && !error && rawItems.length === 0 ? (
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <EmptyState message="No data available" icon="document" />
        </div>
      ) : null}

      {!loading && rawItems.length > 0 ? (
        <ResponsiveTable
          className="mt-4 rounded-lg border border-pitch-gray-dark"
          minWidth="1000px"
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Event date
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">MD</th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Competition
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">Staff</th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Provider
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">Role</th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Location
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">Status</th>
                {showFinance ? (
                  <th className="px-4 py-3 text-right font-medium text-pitch-gray">Fee</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rawItems.map((row, idx) => (
                <tr
                  key={`${row.eventId}-${row.staffId}-${row.roleCode}-${row.assignmentStatus}-${idx}`}
                  className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/10"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-pitch-gray-light">
                    {formatEventDate(row.eventDate, row.koItalyTime)}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.matchday ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">
                    {row.competitionName ?? "—"}
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
                    <span className="text-pitch-white">
                      {row.roleName ?? row.roleCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-pitch-gray-light">{row.location ?? "—"}</td>
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
        </ResponsiveTable>
      ) : null}
    </>
  );
}
