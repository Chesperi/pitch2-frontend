"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import {
  fetchLookupValues,
  createLookupValue,
  updateLookupValue,
  deleteLookupValue,
} from "@/lib/api/lookupValues";
import type { LookupValue } from "@/lib/types";
import {
  DB_TH,
  DB_TBODY_TR,
  DB_TD,
  DB_TD_EMPTY,
} from "./dbSectionStyles";

const PRIMARY_BTN_SM =
  "rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

const LOOKUP_CATEGORY_ORDER = [
  { key: "standard_onsite", label: "Standard Onsite" },
  { key: "standard_cologno", label: "Standard Cologno" },
  { key: "facilities", label: "Facilities" },
  { key: "studio", label: "Studio" },
  { key: "show", label: "Show" },
  { key: "rights_holder", label: "Rights holder" },
] as const;

type CategoryKey = (typeof LOOKUP_CATEGORY_ORDER)[number]["key"];

const inputClass =
  "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

function CategoryCollapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-base font-semibold text-pitch-white hover:bg-pitch-gray-dark/50"
      >
        {title}
        <span className="text-pitch-gray">{open ? "▼" : "▶"}</span>
      </button>
      {open ? (
        <div className="border-t border-pitch-gray-dark p-4">{children}</div>
      ) : null}
    </section>
  );
}

export function LookupValuesSection() {
  const { levelByPageKey } = usePagePermissions();
  const canEditDatabase = levelByPageKey.database === "edit";

  const [items, setItems] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openByCat, setOpenByCat] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      LOOKUP_CATEGORY_ORDER.map((c, i) => [c.key, i === 0])
    ) as Record<string, boolean>
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<CategoryKey | null>(null);
  const [editing, setEditing] = useState<LookupValue | null>(null);
  const [formValue, setFormValue] = useState("");
  const [formOrder, setFormOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchLookupValues();
      setItems(rows);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load vocabulary."
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byCategory = useMemo(() => {
    const m = new Map<string, LookupValue[]>();
    for (const c of LOOKUP_CATEGORY_ORDER) {
      m.set(c.key, []);
    }
    for (const row of items) {
      const list = m.get(row.category);
      if (list) list.push(row);
    }
    for (const c of LOOKUP_CATEGORY_ORDER) {
      const list = m.get(c.key)!;
      list.sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.value.localeCompare(b.value, "it")
      );
    }
    return m;
  }, [items]);

  const openAdd = (cat: CategoryKey) => {
    setEditing(null);
    setModalCategory(cat);
    setFormValue("");
    setFormOrder(0);
    setModalOpen(true);
  };

  const openEdit = (row: LookupValue) => {
    setEditing(row);
    setModalCategory(row.category as CategoryKey);
    setFormValue(row.value);
    setFormOrder(row.sort_order);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setModalCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCategory) return;
    const v = formValue.trim();
    if (!v) {
      alert("Inserisci un valore.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateLookupValue(editing.id, {
          value: v,
          sort_order: formOrder,
        });
      } else {
        await createLookupValue({
          category: modalCategory,
          value: v,
          sort_order: formOrder,
        });
      }
      closeModal();
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: LookupValue) => {
    if (!confirm(`Remove "${row.value}" from ${row.category}?`)) return;
    try {
      await deleteLookupValue(row.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete error");
    }
  };

  const toggleCat = (key: string) =>
    setOpenByCat((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-pitch-white">Vocabulary</h2>
      <p className="mt-1 text-xs text-pitch-gray">
        Controlled values for standard onsite, Cologno, facilities, studio, show and
        rights holder (used in event forms and automatic rules).
      </p>

      {error ? (
        <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-pitch-gray">Loading…</p>
      ) : (
        <div className="mt-4">
          {LOOKUP_CATEGORY_ORDER.map((cat) => {
            const rows = byCategory.get(cat.key) ?? [];
            const open = openByCat[cat.key] ?? false;
            return (
              <CategoryCollapsible
                key={cat.key}
                title={cat.label}
                open={open}
                onToggle={() => toggleCat(cat.key)}
              >
                <div className="mb-3 flex justify-end">
                  {canEditDatabase ? (
                    <button
                      type="button"
                      className={PRIMARY_BTN_SM}
                      onClick={() => openAdd(cat.key)}
                    >
                      Add value
                    </button>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-lg border border-[#2a2a2a]">
                  <table className="w-full min-w-[480px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className={DB_TH}>Value</th>
                        <th className={DB_TH}>Order</th>
                        <th className={DB_TH}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr className={DB_TBODY_TR}>
                          <td
                            colSpan={3}
                            className={`${DB_TD_EMPTY} py-4 text-center`}
                          >
                            No values — use &quot;Add value&quot;.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id} className={DB_TBODY_TR}>
                            <td className={DB_TD}>{row.value}</td>
                            <td className={DB_TD}>{row.sort_order}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-sm">
                              {canEditDatabase ? (
                                <>
                                  <button
                                    type="button"
                                    className="mr-2 text-xs text-pitch-accent underline-offset-2 hover:underline"
                                    onClick={() => openEdit(row)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-red-400 underline-offset-2 hover:underline"
                                    onClick={() => void handleDelete(row)}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <span className="text-sm text-[#3F4547]">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CategoryCollapsible>
            );
          })}
        </div>
      )}

      {modalOpen && modalCategory ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
            <h3 className="mb-4 text-base font-semibold text-pitch-white">
              {editing ? "Edit value" : "New value"} —{" "}
              {
                LOOKUP_CATEGORY_ORDER.find((c) => c.key === modalCategory)
                  ?.label
              }
            </h3>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Value
                </label>
                <input
                  type="text"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Order
                </label>
                <input
                  type="number"
                  value={formOrder}
                  onChange={(e) =>
                    setFormOrder(Number(e.target.value) || 0)
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
                  className={PRIMARY_BTN_SM}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
