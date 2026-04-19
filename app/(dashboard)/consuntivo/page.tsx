"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api/apiFetch";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { canSeeFinance } from "@/lib/auth/financeAccess";
import MultiSelectFilter, {
  type MultiSelectOption,
} from "@/components/MultiSelectFilter";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";
import DesktopRecommended from "@/components/ui/DesktopRecommended";

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
  matchdays: MultiSelectOption[];
  staff: MultiSelectOption[];
  roles: MultiSelectOption[];
  providers: MultiSelectOption[];
  competitions: MultiSelectOption[];
  statuses: MultiSelectOption[];
};

type AppliedFilters = {
  from: string;
  to: string;
  matchdays: string[];
  competitions: string[];
  staffIds: string[];
  roleCodes: string[];
  providerIds: string[];
  statuses: string[];
};

async function fetchFilterOptions(
  filters: AppliedFilters
): Promise<FilterOptionsResponse> {
  const q = new URLSearchParams();
  if (filters.from.trim()) q.set("from", filters.from.trim());
  if (filters.to.trim()) q.set("to", filters.to.trim());
  filters.matchdays.forEach((v) => q.append("matchdays", v));
  filters.competitions.forEach((v) => q.append("competitions", v));
  filters.staffIds.forEach((v) => q.append("staffIds", v));
  filters.roleCodes.forEach((v) => q.append("roleCodes", v));
  filters.providerIds.forEach((v) => q.append("providerIds", v));
  filters.statuses.forEach((v) => q.append("statuses", v));
  const qs = q.toString();
  const res = await apiFetch(
    `/api/consuntivo/filter-options${qs ? `?${qs}` : ""}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(await readFetchError(res));
  return (await res.json()) as FilterOptionsResponse;
}

const INPUT_CLASS =
  "rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

const BTN_PRIMARY =
  "rounded bg-pitch-accent px-4 py-2 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

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

  const koPart = koItalyTime != null && String(koItalyTime).trim() !== ""
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
  const [selectedMatchdays, setSelectedMatchdays] = useState<string[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsState>({
    matchdays: [],
    staff: [],
    roles: [],
    providers: [],
    competitions: [],
    statuses: [],
  });

  const [rawItems, setRawItems] = useState<ConsuntivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsuntivo = useCallback(
    async (params: {
      from: string;
      to: string;
      matchdays: string[];
      competitions: string[];
      staffIds: string[];
      roleCodes: string[];
      providerIds: string[];
      statuses: string[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (params.from.trim()) q.set("from", params.from.trim());
        if (params.to.trim()) q.set("to", params.to.trim());
        params.matchdays.forEach((v) => q.append("matchdays", v));
        params.competitions.forEach((v) => q.append("competitions", v));
        params.staffIds.forEach((v) => q.append("staffIds", v));
        params.roleCodes.forEach((v) => q.append("roleCodes", v));
        params.providerIds.forEach((v) => q.append("providerIds", v));
        params.statuses.forEach((v) => q.append("statuses", v));

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

  const loadFilterOptions = async (filters: AppliedFilters) => {
    setLoadingOptions(true);
    try {
      const data = await fetchFilterOptions(filters);

      const nextOptions: FilterOptionsState = {
        matchdays: (data.matchdays ?? [])
          .filter((md) => Number.isFinite(md))
          .sort((a, b) => a - b)
          .map((md) => ({ value: String(md), label: `MD ${md}` })),
        competitions: (data.competitions ?? [])
          .map((name) => String(name ?? "").trim())
          .filter((name) => name.length > 0)
          .sort((a, b) => a.localeCompare(b, "it"))
          .map((name) => ({ value: name, label: name })),
        staff: (data.staff ?? [])
          .map((staff) => ({
            value: String(staff.id),
            label: `${staff.surname ?? ""} ${staff.name ?? ""}`.trim(),
            surname: String(staff.surname ?? ""),
            name: String(staff.name ?? ""),
          }))
          .filter((staff) => staff.value !== "0" && staff.label.length > 0)
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
            value: String(provider.id),
            label:
              provider.label?.trim() ||
              provider.company?.trim() ||
              `${provider.surname ?? ""} ${provider.name ?? ""}`.trim() ||
              `#${provider.id}`,
          }))
          .filter((provider) => provider.value !== "0")
          .sort((a, b) => a.label.localeCompare(b.label, "it")),
        statuses: (data.statuses ?? [])
          .map((status) => String(status ?? "").trim())
          .filter((status) => status.length > 0)
          .sort((a, b) => a.localeCompare(b, "it"))
          .map((status) => ({ value: status, label: status })),
      };

      setFilterOptions(nextOptions);
    } catch (err) {
      console.error("filter-options error:", err);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    void fetchConsuntivo({
      from: "",
      to: "",
      matchdays: [],
      competitions: [],
      staffIds: [],
      roleCodes: [],
      providerIds: [],
      statuses: [],
    });
  }, [fetchConsuntivo]);

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

  useEffect(() => {
    setSelectedMatchdays([]);
    setSelectedCompetitions([]);
    setSelectedStaffIds([]);
    setSelectedRoleCodes([]);
    setSelectedProviderIds([]);
    setSelectedStatuses([]);
    void loadFilterOptions({
      from,
      to,
      matchdays: [],
      competitions: [],
      staffIds: [],
      roleCodes: [],
      providerIds: [],
      statuses: [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const filteredItems = useMemo(() => rawItems, [rawItems]);

  const visibleTotalFee = useMemo(
    () => filteredItems.reduce((sum, r) => sum + (Number(r.fee) || 0), 0),
    [filteredItems]
  );

  const handleMatchdaysChange = (values: string[]) => {
    setSelectedMatchdays(values);
    void loadFilterOptions({
      from,
      to,
      matchdays: values,
      competitions: selectedCompetitions,
      staffIds: selectedStaffIds,
      roleCodes: selectedRoleCodes,
      providerIds: selectedProviderIds,
      statuses: selectedStatuses,
    });
  };

  const handleCompetitionsChange = (values: string[]) => {
    setSelectedCompetitions(values);
    void loadFilterOptions({
      from,
      to,
      matchdays: selectedMatchdays,
      competitions: values,
      staffIds: selectedStaffIds,
      roleCodes: selectedRoleCodes,
      providerIds: selectedProviderIds,
      statuses: selectedStatuses,
    });
  };

  const handleStaffIdsChange = (values: string[]) => {
    setSelectedStaffIds(values);
    void loadFilterOptions({
      from,
      to,
      matchdays: selectedMatchdays,
      competitions: selectedCompetitions,
      staffIds: values,
      roleCodes: selectedRoleCodes,
      providerIds: selectedProviderIds,
      statuses: selectedStatuses,
    });
  };

  const handleRoleCodesChange = (values: string[]) => {
    setSelectedRoleCodes(values);
    void loadFilterOptions({
      from,
      to,
      matchdays: selectedMatchdays,
      competitions: selectedCompetitions,
      staffIds: selectedStaffIds,
      roleCodes: values,
      providerIds: selectedProviderIds,
      statuses: selectedStatuses,
    });
  };

  const handleProviderIdsChange = (values: string[]) => {
    setSelectedProviderIds(values);
    void loadFilterOptions({
      from,
      to,
      matchdays: selectedMatchdays,
      competitions: selectedCompetitions,
      staffIds: selectedStaffIds,
      roleCodes: selectedRoleCodes,
      providerIds: values,
      statuses: selectedStatuses,
    });
  };

  const handleStatusesChange = (values: string[]) => {
    setSelectedStatuses(values);
    void loadFilterOptions({
      from,
      to,
      matchdays: selectedMatchdays,
      competitions: selectedCompetitions,
      staffIds: selectedStaffIds,
      roleCodes: selectedRoleCodes,
      providerIds: selectedProviderIds,
      statuses: values,
    });
  };

  const roleOptions = filterOptions.roles;
  const staffOptions = filterOptions.staff;
  const providerOptions = filterOptions.providers;
  const matchdayOptions = filterOptions.matchdays;
  const competitionOptions = filterOptions.competitions;
  const statusOptions = filterOptions.statuses;

  const areOptionFiltersDisabled = loadingOptions || loading;

  const handleApplyFilters = () => {
    void fetchConsuntivo({
      from,
      to,
      matchdays: selectedMatchdays,
      competitions: selectedCompetitions,
      staffIds: selectedStaffIds,
      roleCodes: selectedRoleCodes,
      providerIds: selectedProviderIds,
      statuses: selectedStatuses,
    });
  };

  return (
    <>
      <PageHeader title="Consuntivo" />
      <DesktopRecommended />

      <div className="mt-4 space-y-4 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/10 p-4">
        <div className="flex flex-wrap items-end gap-2">
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
            onChange={handleMatchdaysChange}
            placeholder="Seleziona MD"
            disabled={areOptionFiltersDisabled}
          />
          <MultiSelectFilter
            label="Competition"
            options={competitionOptions}
            selected={selectedCompetitions}
            onChange={handleCompetitionsChange}
            placeholder="Seleziona competizione"
            disabled={areOptionFiltersDisabled}
          />
          <MultiSelectFilter
            label="Staff"
            options={staffOptions}
            selected={selectedStaffIds}
            onChange={handleStaffIdsChange}
            placeholder="Seleziona staff"
            disabled={areOptionFiltersDisabled}
          />
          <MultiSelectFilter
            label="Role"
            options={roleOptions}
            selected={selectedRoleCodes}
            onChange={handleRoleCodesChange}
            placeholder="Seleziona ruolo"
            disabled={areOptionFiltersDisabled}
          />
          <MultiSelectFilter
            label="Provider"
            options={providerOptions}
            selected={selectedProviderIds}
            onChange={handleProviderIdsChange}
            placeholder="Seleziona provider"
            disabled={areOptionFiltersDisabled}
          />
          <MultiSelectFilter
            label="Status"
            options={statusOptions}
            selected={selectedStatuses}
            onChange={handleStatusesChange}
            placeholder="Seleziona stato"
            disabled={areOptionFiltersDisabled}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-pitch-gray-dark/50 pt-4">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={loading}
            onClick={handleApplyFilters}
          >
            Applica filtri
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
          Righe:{" "}
          <strong className="text-pitch-white">{filteredItems.length}</strong>
        </span>
        {showFinance ? (
          <span>
            Totale fee (righe visibili):{" "}
            <strong className="text-pitch-white">
              {eur.format(visibleTotalFee)}
            </strong>
          </span>
        ) : null}
      </div>

      {!loading && !error && filteredItems.length === 0 ? (
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <EmptyState message="Nessun dato disponibile" icon="document" />
        </div>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <ResponsiveTable
          className="mt-4 rounded-lg border border-pitch-gray-dark"
          minWidth="1000px"
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Data evento
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  MD
                </th>
                <th className="px-4 py-3 text-left font-medium text-pitch-gray">
                  Competizione
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
        </ResponsiveTable>
      ) : null}
    </>
  );
}
