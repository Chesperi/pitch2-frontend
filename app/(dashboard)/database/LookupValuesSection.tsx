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
  DB_TH_CELL,
  DB_TH_FIRST,
  DB_TBODY_TR_COMPACT,
  DB_TD_CELL,
  DB_TD_EMPTY_CELL,
  DB_TD_FIRST,
} from "./dbSectionStyles";

const PRIMARY_BTN_SM =
  "rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

/** Placeholder row so a new category appears in the list before real values are added. */
const PLACEHOLDER_LOOKUP_VALUE = "(empty)";

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

type LookupValuesSectionProps = {
  embedded?: boolean;
  onCountChange?: (n: number) => void;
};

export function LookupValuesSection({
  embedded = false,
  onCountChange,
}: LookupValuesSectionProps = {}) {
  const { levelByPageKey } = usePagePermissions();
  const canEditDatabase = levelByPageKey.database === "edit";

  const [items, setItems] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openByCat, setOpenByCat] = useState<Record<string, boolean>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<LookupValue | null>(null);
  const [formValue, setFormValue] = useState("");
  const [formOrder, setFormOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingNewCategory, setSavingNewCategory] = useState(false);

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

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  const categoryKeys = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) {
      if (row.category) set.add(row.category);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [items]);

  useEffect(() => {
    setOpenByCat((prev) => {
      const next: Record<string, boolean> = {};
      let hadAnyPrevKey = false;
      for (const k of categoryKeys) {
        if (k in prev) hadAnyPrevKey = true;
        next[k] = prev[k] ?? false;
      }
      if (categoryKeys.length > 0 && !hadAnyPrevKey) {
        next[categoryKeys[0]] = true;
      }
      return next;
    });
  }, [categoryKeys]);

  const byCategory = useMemo(() => {
    const m = new Map<string, LookupValue[]>();
    for (const k of categoryKeys) {
      m.set(k, []);
    }
    for (const row of items) {
      const list = m.get(row.category);
      if (list) list.push(row);
    }
    for (const k of categoryKeys) {
      const list = m.get(k)!;
      list.sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.value.localeCompare(b.value, undefined, { sensitivity: "base" })
      );
    }
    return m;
  }, [items, categoryKeys]);

  const openAdd = (cat: string) => {
    setEditing(null);
    setModalCategory(cat);
    setFormValue("");
    setFormOrder(0);
    setModalOpen(true);
  };

  const openEdit = (row: LookupValue) => {
    setEditing(row);
    setModalCategory(row.category);
    setFormValue(row.value);
    setFormOrder(row.sort_order);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setModalCategory(null);
  };

  const closeNewCategoryModal = () => {
    setNewCategoryModalOpen(false);
    setNewCategoryName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCategory) return;
    const v = formValue.trim();
    if (!v) {
      alert("Enter a value.");
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

  const handleNewCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      alert("Enter a category name.");
      return;
    }
    setSavingNewCategory(true);
    try {
      await createLookupValue({
        category: name,
        value: PLACEHOLDER_LOOKUP_VALUE,
        sort_order: 0,
      });
      closeNewCategoryModal();
      await load();
      setOpenByCat((prev) => ({ ...prev, [name]: true }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save error");
    } finally {
      setSavingNewCategory(false);
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

  const inner = (
    <>
      {error ? (
        <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={`text-sm text-pitch-gray ${embedded ? "" : "mt-4"}`}>
          Loading…
        </p>
      ) : (
        <div className={embedded ? "mt-0" : "mt-4"}>
          {canEditDatabase ? (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className={PRIMARY_BTN_SM}
                onClick={() => {
                  setNewCategoryName("");
                  setNewCategoryModalOpen(true);
                }}
              >
                New category
              </button>
            </div>
          ) : null}
          {categoryKeys.map((catKey) => {
            const rows = byCategory.get(catKey) ?? [];
            const open = openByCat[catKey] ?? false;
            return (
              <CategoryCollapsible
                key={catKey}
                title={catKey}
                open={open}
                onToggle={() => toggleCat(catKey)}
              >
                <div className="mb-3 flex justify-end">
                  {canEditDatabase ? (
                    <button
                      type="button"
                      className={PRIMARY_BTN_SM}
                      onClick={() => openAdd(catKey)}
                    >
                      Add value
                    </button>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-lg border border-[#2a2a2a]">
                  <table className="w-full min-w-[480px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className={DB_TH_FIRST}>Value</th>
                        <th className={DB_TH_CELL}>Order</th>
                        <th className={DB_TH_CELL}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr className={DB_TBODY_TR_COMPACT}>
                          <td
                            colSpan={3}
                            className={`${DB_TD_EMPTY_CELL} text-center`}
                          >
                            No values — use &quot;Add value&quot;.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id} className={DB_TBODY_TR_COMPACT}>
                            <td className={DB_TD_FIRST}>{row.value}</td>
                            <td className={DB_TD_CELL}>{row.sort_order}</td>
                            <td className={`${DB_TD_CELL} whitespace-nowrap`}>
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
          {categoryKeys.length === 0 ? (
            <p className="mt-2 text-sm text-pitch-gray">
              No categories yet.{" "}
              {canEditDatabase ? 'Use "New category" to create one.' : ""}
            </p>
          ) : null}
        </div>
      )}

      {modalOpen && modalCategory ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
            <h3 className="mb-4 text-base font-semibold text-pitch-white">
              {editing ? "Edit value" : "New value"} — {modalCategory}
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

      {newCategoryModalOpen ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
            <h3 className="mb-4 text-base font-semibold text-pitch-white">
              New category
            </h3>
            <form
              onSubmit={(e) => void handleNewCategorySubmit(e)}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Category name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. my_category"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-pitch-gray">
                A placeholder value &quot;{PLACEHOLDER_LOOKUP_VALUE}&quot; (order 0) will be
                created so the category appears; delete it after adding real values if
                you like.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeNewCategoryModal}
                  disabled={savingNewCategory}
                  className="rounded border border-pitch-gray-dark px-4 py-2 text-sm text-pitch-white hover:bg-pitch-gray-dark/40 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewCategory}
                  className={PRIMARY_BTN_SM}
                >
                  {savingNewCategory ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return inner;
  }

  return <section className="mt-6">{inner}</section>;
}
