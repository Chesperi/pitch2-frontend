"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api/config";

type StaffSearchItem = {
  id: number;
  surname: string;
  name: string;
  company: string | null;
  defaultRoleCode: string | null;
  defaultLocation: string | null;
  plates: string | null;
  notes: string | null;
};

export type AccreditationListItem = {
  id: number;
  eventId: string;
  staffId: number;
  company: string | null;
  surname: string | null;
  name: string | null;
  roleCode: string | null;
  areas: string | null;
  plates: string | null;
  notes: string | null;
};

type Props = {
  eventId: string;
};

function parseAccreditationsResponse(data: unknown): AccreditationListItem[] {
  if (Array.isArray(data)) {
    return data as AccreditationListItem[];
  }
  if (
    data != null &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: AccreditationListItem[] }).items;
  }
  return [];
}

function normalizeStaffSearchRow(raw: Record<string, unknown>): StaffSearchItem {
  return {
    id: Number(raw.id),
    surname: String(raw.surname ?? ""),
    name: String(raw.name ?? ""),
    company:
      raw.company != null && String(raw.company).trim() !== ""
        ? String(raw.company)
        : null,
    defaultRoleCode:
      raw.defaultRoleCode != null && String(raw.defaultRoleCode).trim() !== ""
        ? String(raw.defaultRoleCode)
        : raw.default_role_code != null &&
            String(raw.default_role_code).trim() !== ""
          ? String(raw.default_role_code)
          : null,
    defaultLocation:
      raw.defaultLocation != null &&
      String(raw.defaultLocation).trim() !== ""
        ? String(raw.defaultLocation)
        : raw.default_location != null &&
            String(raw.default_location).trim() !== ""
          ? String(raw.default_location)
          : null,
    plates:
      raw.plates != null && String(raw.plates).trim() !== ""
        ? String(raw.plates)
        : null,
    notes:
      raw.notes != null && String(raw.notes).trim() !== ""
        ? String(raw.notes)
        : null,
  };
}

function parseStaffSearchResponse(data: unknown): StaffSearchItem[] {
  if (Array.isArray(data)) {
    return data.map((row) =>
      normalizeStaffSearchRow(row as Record<string, unknown>)
    );
  }
  if (
    data != null &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: Record<string, unknown>[] }).items.map(
      normalizeStaffSearchRow
    );
  }
  return [];
}

export function EventAccreditationsTab({ eventId }: Props) {
  const [items, setItems] = useState<AccreditationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterOnlyWithAreas, setFilterOnlyWithAreas] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staffQuery, setStaffQuery] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffSearchItem[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffSearchItem | null>(
    null
  );

  const [formRoleCode, setFormRoleCode] = useState<string>("");
  const [formAreas, setFormAreas] = useState<string>("");
  const [formPlates, setFormPlates] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(
        `${baseUrl}/api/accrediti/${encodeURIComponent(eventId)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error("Failed to load accreditations");
      const data = (await res.json()) as unknown;
      setItems(parseAccreditationsResponse(data));
    } catch (err) {
      console.error("load accreditations error", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchStaff = useCallback(async (q: string) => {
    const trimmed = q.trim();
    setStaffQuery(q);
    setSelectedStaff(null);
    setFormError(null);

    if (!trimmed) {
      setStaffOptions([]);
      return;
    }

    try {
      setStaffLoading(true);
      const baseUrl = getApiBaseUrl();
      const res = await fetch(
        `${baseUrl}/api/staff/search?q=${encodeURIComponent(trimmed)}`,
        { credentials: "include", cache: "no-store" }
      );
      if (!res.ok) throw new Error("search staff failed");
      const data = (await res.json()) as unknown;
      setStaffOptions(parseStaffSearchResponse(data));
    } catch (err) {
      console.error("searchStaff error", err);
      setFormError("Error searching staff");
      setStaffOptions([]);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const handleSelectStaff = (staffId: number) => {
    const found = staffOptions.find((s) => s.id === staffId) ?? null;
    setSelectedStaff(found);
    setFormError(null);

    if (found) {
      setFormRoleCode(found.defaultRoleCode ?? "");
      setFormAreas("");
      setFormPlates(found.plates ?? "");
      setFormNotes(found.notes ?? "");
    } else {
      setFormRoleCode("");
      setFormAreas("");
      setFormPlates("");
      setFormNotes("");
    }
  };

  const resetModalForm = useCallback(() => {
    setSelectedStaff(null);
    setStaffQuery("");
    setStaffOptions([]);
    setFormRoleCode("");
    setFormAreas("");
    setFormPlates("");
    setFormNotes("");
    setFormError(null);
  }, []);

  const handleSaveAccreditation = useCallback(async () => {
    if (!selectedStaff) {
      setFormError("Select a person from staff");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const baseUrl = getApiBaseUrl();
      const body = {
        eventId,
        staffId: selectedStaff.id,
        roleCode: formRoleCode || null,
        areas: formAreas || null,
        plates: formPlates || null,
        notes: formNotes || null,
      };

      const res = await fetch(`${baseUrl}/api/accrediti`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        setFormError("Staff already accredited for this event");
        return;
      }

      if (!res.ok) {
        throw new Error(`POST /api/accrediti failed: ${res.status}`);
      }

      await load();
      setShowModal(false);
      resetModalForm();
    } catch (err) {
      console.error("handleSaveAccreditation error", err);
      setFormError("Error saving");
    } finally {
      setSaving(false);
    }
  }, [
    eventId,
    selectedStaff,
    formRoleCode,
    formAreas,
    formPlates,
    formNotes,
    load,
    resetModalForm,
  ]);

  const companyOptions = Array.from(
    new Set(
      items
        .map((it) => (it.company ?? "").trim())
        .filter((v) => v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "it"));

  const roleOptions = Array.from(
    new Set(
      items
        .map((it) => (it.roleCode ?? "").trim())
        .filter((v) => v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "it"));

  const filtered = items.filter((it) => {
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      const haystack = [
        it.company,
        it.surname,
        it.name,
        it.roleCode,
        it.areas,
        it.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }

    if (filterCompany) {
      const c = (it.company ?? "").trim();
      if (!c || c !== filterCompany) {
        return false;
      }
    }

    if (filterRole) {
      const r = (it.roleCode ?? "").trim();
      if (!r || r !== filterRole) {
        return false;
      }
    }

    if (filterOnlyWithAreas) {
      const a = (it.areas ?? "").trim();
      if (!a) {
        return false;
      }
    }

    return true;
  });

  const resetListFilters = () => {
    setFilterText("");
    setFilterCompany("");
    setFilterRole("");
    setFilterOnlyWithAreas(false);
  };

  const handleDeactivate = useCallback(
    async (id: number) => {
      if (!window.confirm("Remove this accreditation from the event?")) return;
      setDeactivatingId(id);
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/accrediti/${id}/deactivate`, {
          method: "PATCH",
          credentials: "include",
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`Deactivate failed: ${res.status}`);
        }
        await load(); // ricarica la lista accreditati
      } catch (err) {
        console.error("handleDeactivate error", err);
      } finally {
        setDeactivatingId(null);
      }
    },
    [load]
  );

  const closeModal = () => {
    if (!saving) {
      setShowModal(false);
      setFormError(null);
    }
  };

  return (
    <>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by name, company, role…"
            className="min-w-[200px] rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white placeholder:text-pitch-gray"
          />

          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="min-w-[140px] rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white"
          >
            <option value="">All companies</option>
            {companyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="min-w-[140px] rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white"
          >
            <option value="">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-[11px] text-pitch-gray-light">
            <input
              type="checkbox"
              checked={filterOnlyWithAreas}
              onChange={(e) => setFilterOnlyWithAreas(e.target.checked)}
              className="h-3 w-3 rounded border border-pitch-gray-dark bg-pitch-gray-dark/60"
            />
            With areas only
          </label>

          <button
            type="button"
            onClick={resetListFilters}
            className="rounded border border-pitch-gray-dark px-2 py-1 text-[11px] text-pitch-gray-light hover:bg-pitch-gray-dark hover:text-pitch-white"
          >
            Reset filters
          </button>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded border border-pitch-gray-dark px-2 py-1 text-xs text-pitch-white hover:bg-pitch-gray-dark disabled:opacity-50"
          >
            {loading ? "Reloading…" : "Reload"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowModal(true);
              setFormError(null);
            }}
            className="rounded border border-pitch-accent px-2 py-1 text-xs font-medium text-pitch-accent hover:bg-pitch-accent/10"
          >
            + Add accreditation
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-pitch-gray-dark text-[11px] text-pitch-gray-light">
                <th className="px-2 py-1 text-left">COMPANY</th>
                <th className="px-2 py-1 text-left">LAST NAME</th>
                <th className="px-2 py-1 text-left">FIRST NAME</th>
                <th className="px-2 py-1 text-left">ROLE</th>
                <th className="px-2 py-1 text-left">AREAS</th>
                <th className="px-2 py-1 text-left">VEHICLE</th>
                <th className="px-2 py-1 text-left">NOTES</th>
                <th className="px-2 py-1 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-2 py-3 text-center text-pitch-gray"
                  >
                    Loading accreditations…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-2 py-3 text-center text-pitch-gray"
                  >
                    No accreditations for this event.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-pitch-gray-dark/60 hover:bg-pitch-gray-dark/40"
                  >
                    <td className="px-2 py-1 text-pitch-gray-light">
                      {it.company ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-pitch-gray-light">
                      {it.surname ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-pitch-gray-light">
                      {it.name ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-pitch-gray-light">
                      {it.roleCode ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-pitch-gray-light">
                      {it.areas ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-pitch-gray-light">
                      {it.plates ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-pitch-gray-light">
                      {it.notes ?? "—"}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => void handleDeactivate(it.id)}
                        disabled={deactivatingId === it.id}
                        className="rounded border border-red-500 px-2 py-[2px] text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {deactivatingId === it.id ? "Removing…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-pitch-gray-dark bg-pitch-bg px-4 py-3 text-xs text-pitch-white">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add accreditation</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-pitch-gray-light hover:text-pitch-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {formError ? (
              <p className="mb-2 text-[11px] text-red-400">{formError}</p>
            ) : null}

            <div className="mb-3 space-y-1">
              <label className="block text-[11px] text-pitch-gray-light">
                Search staff (last or first name)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  placeholder="Type at least 2 characters…"
                  className="flex-1 rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white placeholder:text-pitch-gray"
                />
                <button
                  type="button"
                  onClick={() =>
                    staffQuery.trim().length >= 2 && void searchStaff(staffQuery)
                  }
                  disabled={staffLoading || staffQuery.trim().length < 2}
                  className="rounded border border-pitch-gray-dark px-2 py-1 text-xs hover:bg-pitch-gray-dark disabled:opacity-50"
                >
                  {staffLoading ? "Searching…" : "Search"}
                </button>
              </div>
              {staffOptions.length > 0 ? (
                <select
                  value={selectedStaff?.id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setSelectedStaff(null);
                      setFormRoleCode("");
                      setFormAreas("");
                      setFormPlates("");
                      setFormNotes("");
                      setFormError(null);
                      return;
                    }
                    handleSelectStaff(Number(v));
                  }}
                  className="mt-1 w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white"
                >
                  <option value="">Select from list…</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.surname} {s.name}
                      {s.defaultRoleCode ? ` – ${s.defaultRoleCode}` : ""}
                      {s.company ? ` (${s.company})` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] text-pitch-gray-light">
                  Role (override)
                </label>
                <input
                  type="text"
                  value={formRoleCode}
                  onChange={(e) => setFormRoleCode(e.target.value)}
                  placeholder={selectedStaff?.defaultRoleCode ?? ""}
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white placeholder:text-pitch-gray"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-pitch-gray-light">
                  Areas (override)
                </label>
                <input
                  type="text"
                  value={formAreas}
                  onChange={(e) => setFormAreas(e.target.value)}
                  placeholder="Empty = auto calculate"
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white placeholder:text-pitch-gray"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-pitch-gray-light">
                  Vehicle / plate
                </label>
                <input
                  type="text"
                  value={formPlates}
                  onChange={(e) => setFormPlates(e.target.value)}
                  placeholder={selectedStaff?.plates ?? ""}
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white placeholder:text-pitch-gray"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-pitch-gray-light">
                  Note
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-2 py-1 text-xs text-pitch-white"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded border border-pitch-gray-dark px-3 py-1 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAccreditation()}
                disabled={saving || !selectedStaff}
                className="rounded border border-pitch-accent bg-pitch-accent px-3 py-1 text-xs font-medium text-black disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save accreditation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
