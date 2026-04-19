"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchEventRules,
  createEventRule,
  updateEventRule,
  deleteEventRule,
} from "@/lib/api/eventRules";
import { fetchLookupValues } from "@/lib/api/lookupValues";
import type { CreateEventRulePayload, EventRule, LookupValue } from "@/lib/types";
import {
  DB_TH_CELL,
  DB_TH_FIRST,
  DB_TBODY_TR_COMPACT,
  DB_TD_CELL,
  DB_TD_EMPTY_CELL,
  DB_TD_FIRST,
} from "./dbSectionStyles";

const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

function dayLabel(d: number | null): string {
  if (d == null || Number.isNaN(d)) return "—";
  const opt = DAY_OPTIONS.find((o) => o.value === String(d));
  return opt?.label ?? String(d);
}

function emptyForm(): CreateEventRulePayload {
  return {
    competition_name: "",
    day_of_week: undefined,
    ko_time_from: "",
    ko_time_to: "",
    standard_onsite: "",
    standard_cologno: "",
    facilities: "",
    studio: "",
    show_name: "",
    pre_duration_minutes: undefined,
    priority: 0,
    notes: "",
  };
}

function defaultCompetitionName(options: LookupValue[]): string {
  const found = options.find((o) => o.value === "Serie A");
  return found ? found.value : "";
}

function ruleToForm(r: EventRule): CreateEventRulePayload {
  return {
    competition_name: r.competition_name ?? "",
    day_of_week: r.day_of_week,
    ko_time_from: r.ko_time_from ?? "",
    ko_time_to: r.ko_time_from ?? r.ko_time_to ?? "",
    standard_onsite: r.standard_onsite ?? "",
    standard_cologno: r.standard_cologno ?? "",
    facilities: r.facilities ?? "",
    studio: r.studio ?? "",
    show_name: r.show_name ?? "",
    pre_duration_minutes: r.pre_duration_minutes ?? undefined,
    priority: r.priority ?? 0,
    notes: r.notes ?? "",
  };
}

function payloadForApi(p: CreateEventRulePayload): CreateEventRulePayload {
  const dayRaw = p.day_of_week;
  return {
    competition_name: p.competition_name?.trim() || undefined,
    day_of_week:
      dayRaw === undefined || dayRaw === null || Number.isNaN(Number(dayRaw))
        ? null
        : Number(dayRaw),
    ko_time_from: p.ko_time_from?.trim() || null,
    ko_time_to: p.ko_time_from?.trim() || null,
    standard_onsite: p.standard_onsite?.trim() || null,
    standard_cologno: p.standard_cologno?.trim() || null,
    facilities: p.facilities?.trim() || null,
    studio: p.studio?.trim() || null,
    show_name: p.show_name?.trim() || null,
    pre_duration_minutes:
      p.pre_duration_minutes === undefined ||
      p.pre_duration_minutes === null ||
      String(p.pre_duration_minutes) === ""
        ? null
        : Number(p.pre_duration_minutes),
    priority: p.priority ?? 0,
    notes: p.notes?.trim() || null,
  };
}

const inputClass =
  "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

function LookupSelect({
  label,
  fieldValue,
  onChange,
  options,
}: {
  label: string;
  fieldValue: string;
  onChange: (v: string) => void;
  options: LookupValue[];
}) {
  const v = fieldValue ?? "";
  const inList = options.some((o) => o.value === v);
  return (
    <div>
      <label className="mb-1 block text-xs text-pitch-gray">{label}</label>
      <select
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <option value="">— any —</option>
        {options.map((o) => (
          <option key={o.id} value={o.value}>
            {o.value}
          </option>
        ))}
        {v && !inList ? (
          <option value={v}>
            {v} (not in list)
          </option>
        ) : null}
      </select>
    </div>
  );
}

type EventRulesSectionProps = {
  embedded?: boolean;
  onCountChange?: (n: number) => void;
};

export function EventRulesSection({
  embedded = false,
  onCountChange,
}: EventRulesSectionProps = {}) {
  const [rules, setRules] = useState<EventRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateEventRulePayload>(() => emptyForm());
  const [saving, setSaving] = useState(false);

  const [lookupOnsite, setLookupOnsite] = useState<LookupValue[]>([]);
  const [lookupCologno, setLookupCologno] = useState<LookupValue[]>([]);
  const [lookupFacilities, setLookupFacilities] = useState<LookupValue[]>([]);
  const [lookupStudio, setLookupStudio] = useState<LookupValue[]>([]);
  const [lookupShow, setLookupShow] = useState<LookupValue[]>([]);
  const [lookupCompetition, setLookupCompetition] = useState<LookupValue[]>([]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchEventRules();
      setRules(rows);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load rules."
      );
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    onCountChange?.(rules.length);
  }, [rules.length, onCountChange]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [a, b, c, d, e, f] = await Promise.all([
          fetchLookupValues("standard_onsite"),
          fetchLookupValues("standard_cologno"),
          fetchLookupValues("facilities"),
          fetchLookupValues("studio"),
          fetchLookupValues("show"),
          fetchLookupValues("competition"),
        ]);
        if (!cancelled) {
          setLookupOnsite(a);
          setLookupCologno(b);
          setLookupFacilities(c);
          setLookupStudio(d);
          setLookupShow(e);
          setLookupCompetition(f);
          setForm((prev) =>
            prev.competition_name
              ? prev
              : { ...prev, competition_name: defaultCompetitionName(f) }
          );
        }
      } catch {
        if (!cancelled) {
          setLookupOnsite([]);
          setLookupCologno([]);
          setLookupFacilities([]);
          setLookupStudio([]);
          setLookupShow([]);
          setLookupCompetition([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      competition_name: defaultCompetitionName(lookupCompetition),
    });
    setModalOpen(true);
  };

  const openEdit = (r: EventRule) => {
    setEditingId(r.id);
    setForm(ruleToForm(r));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = payloadForApi(form);
      if (editingId != null) {
        await updateEventRule(editingId, body);
      } else {
        await createEventRule(body);
      }
      closeModal();
      await loadRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: EventRule) => {
    if (
      !confirm(
        `Delete rule #${r.id}${r.competition_name ? ` (${r.competition_name})` : ""}?`
      )
    ) {
      return;
    }
    try {
      await deleteEventRule(r.id);
      await loadRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete error");
    }
  };

  const daySelectValue =
    form.day_of_week === undefined || form.day_of_week === null
      ? ""
      : String(form.day_of_week);

  const toolbar = (
    <div
      className={`mb-4 flex items-center gap-2 ${
        embedded
          ? "justify-end"
          : "flex-col sm:flex-row sm:justify-between"
      }`}
    >
      {!embedded ? (
        <h3 className="text-lg font-semibold text-pitch-white">
          Automatic event rules
        </h3>
      ) : null}
      <button
        type="button"
        onClick={openNew}
        className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200"
      >
        New rule
      </button>
    </div>
  );

  const body = (
    <>
      {toolbar}

      {error ? (
        <p className="mb-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-pitch-gray">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-pitch-gray-dark">
          <table className="w-full min-w-[1100px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
                <th className={DB_TH_FIRST}>Competition</th>
                <th className={DB_TH_CELL}>Day</th>
                <th className={DB_TH_CELL}>Time</th>
                <th className={DB_TH_CELL}>Onsite</th>
                <th className={DB_TH_CELL}>Cologno</th>
                <th className={DB_TH_CELL}>Facilities</th>
                <th className={DB_TH_CELL}>Studio</th>
                <th className={DB_TH_CELL}>Show</th>
                <th className={DB_TH_CELL}>PRE</th>
                <th className={DB_TH_CELL}>Pri.</th>
                <th className={DB_TH_CELL}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr className={DB_TBODY_TR_COMPACT}>
                  <td
                    colSpan={11}
                    className={`${DB_TD_EMPTY_CELL} text-center`}
                  >
                    No rules. Create the first one with &quot;New rule&quot;.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr
                    key={r.id}
                    className={`${DB_TBODY_TR_COMPACT} hover:bg-pitch-gray-dark/10`}
                  >
                    <td className={`${DB_TD_FIRST} whitespace-nowrap`}>
                      {r.competition_name?.trim() || "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {dayLabel(r.day_of_week)}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.ko_time_from ?? r.ko_time_to ?? "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.standard_onsite ?? "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.standard_cologno ?? "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.facilities ?? "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.studio ?? "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.show_name ?? "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.pre_duration_minutes ?? "—"}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      {r.priority}
                    </td>
                    <td className={`${DB_TD_CELL} whitespace-nowrap`}>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="mr-2 text-pitch-accent underline-offset-2 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(r)}
                        className="text-red-400 underline-offset-2 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
            <h4 className="mb-4 text-base font-semibold text-pitch-white">
              {editingId != null ? `Edit rule #${editingId}` : "New rule"}
            </h4>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Competition (optional, empty = any)
                </label>
                <select
                  value={form.competition_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, competition_name: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="">— any —</option>
                  {lookupCompetition.map((o) => (
                    <option key={o.id} value={o.value}>
                      {o.value}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Day of week
                </label>
                <select
                  value={daySelectValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({
                      ...f,
                      day_of_week: v === "" ? null : Number(v),
                    }));
                  }}
                  className={inputClass}
                >
                  {DAY_OPTIONS.map((o) => (
                    <option key={o.value || "any"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  KO time (HH:MM)
                </label>
                <input
                  type="time"
                  value={form.ko_time_from ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ko_time_from: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <LookupSelect
                label="Standard onsite"
                fieldValue={form.standard_onsite ?? ""}
                onChange={(v) =>
                  setForm((f) => ({ ...f, standard_onsite: v }))
                }
                options={lookupOnsite}
              />
              <LookupSelect
                label="Standard Cologno"
                fieldValue={form.standard_cologno ?? ""}
                onChange={(v) =>
                  setForm((f) => ({ ...f, standard_cologno: v }))
                }
                options={lookupCologno}
              />
              <LookupSelect
                label="Facilities"
                fieldValue={form.facilities ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, facilities: v }))}
                options={lookupFacilities}
              />
              <LookupSelect
                label="Studio"
                fieldValue={form.studio ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, studio: v }))}
                options={lookupStudio}
              />
              <LookupSelect
                label="Show"
                fieldValue={form.show_name ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, show_name: v }))}
                options={lookupShow}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    PRE (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={
                      form.pre_duration_minutes === undefined ||
                      form.pre_duration_minutes === null
                        ? ""
                        : form.pre_duration_minutes
                    }
                    onChange={(e) => {
                      const t = e.target.value;
                      setForm((f) => ({
                        ...f,
                        pre_duration_minutes:
                          t === "" ? undefined : Number(t),
                      }));
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    Priority (higher wins)
                  </label>
                  <input
                    type="number"
                    value={form.priority ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priority: Number(e.target.value) || 0,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded border border-pitch-gray-dark px-4 py-2 text-sm text-pitch-white hover:bg-pitch-gray-dark/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return body;
  }

  return (
    <section className="mt-10 border-t border-pitch-gray-dark pt-8">
      {body}
    </section>
  );
}
