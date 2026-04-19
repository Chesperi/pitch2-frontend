"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import {
  createProductionContactLeeds,
  deleteProductionContactLeeds,
  fetchProductionContactsLeeds,
  updateProductionContactLeeds,
  type ProductionContactLeeds,
  type ProductionContactLeedsPayload,
} from "@/lib/api/productionContactsLeeds";

const ALLOWED_USER_LEVELS = new Set(["MASTER", "STAFF"]);

/** Stessi pattern di `app/(dashboard)/eventi/page.tsx` (EventModal + tabella). */
const inputClass =
  "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

const btnPrimary =
  "rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50";

const btnSecondary =
  "rounded border border-pitch-gray-dark px-4 py-2 text-sm text-pitch-gray-light hover:bg-pitch-gray-dark";

const thClass =
  "px-4 py-3 text-left text-sm font-medium text-pitch-gray whitespace-nowrap";

const tdClass = "px-4 py-3 text-sm text-pitch-gray-light whitespace-nowrap";

const btnIconClass =
  "inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded p-2 text-pitch-gray-light hover:bg-pitch-gray-dark hover:text-pitch-accent disabled:opacity-40";

function emptyPayload(): ProductionContactLeedsPayload {
  return {
    competitionName: "",
    matchday: null,
    date: null,
    day: null,
    preDurationMinutes: null,
    koItalyTime: null,
    koGmtTime: null,
    mcrLineupGmtTime: null,
    podLineupGmtTime: null,
    homeTeamNameShort: null,
    awayTeamNameShort: null,
    standardCologno: null,
    facilities: null,
    liveProductionCoordinator: null,
    liveProductionCoordinatorContact: null,
    partyLine: null,
    mcrLeedsPhoneNumber: null,
    podLeeds: null,
    podOperator: null,
    podLeedsContact: null,
  };
}

function rowToPayload(
  row: ProductionContactLeeds
): ProductionContactLeedsPayload {
  const { id: _id, ...rest } = row;
  return rest;
}

function displayCell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function IconPencil() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

type FormFieldDef = {
  key: keyof ProductionContactLeedsPayload;
  label: string;
  type?: "text" | "number" | "date";
  required?: boolean;
};

const FORM_FIELDS: FormFieldDef[] = [
  { key: "competitionName", label: "Competition", required: true },
  { key: "matchday", label: "MD", type: "number" },
  { key: "date", label: "Date", type: "date" },
  { key: "day", label: "Day" },
  { key: "preDurationMinutes", label: "Pre (min)", type: "number" },
  { key: "koItalyTime", label: "KO Italy" },
  { key: "koGmtTime", label: "KO GMT" },
  { key: "mcrLineupGmtTime", label: "MCR Lineup GMT" },
  { key: "podLineupGmtTime", label: "POD Lineup GMT" },
  { key: "homeTeamNameShort", label: "Home" },
  { key: "awayTeamNameShort", label: "Away" },
  { key: "standardCologno", label: "Standard Cologno" },
  { key: "facilities", label: "Facilities" },
  { key: "liveProductionCoordinator", label: "Live Prod. Coordinator" },
  {
    key: "liveProductionCoordinatorContact",
    label: "Coordinator Contact",
  },
  { key: "partyLine", label: "Party Line" },
  { key: "mcrLeedsPhoneNumber", label: "MCR Leeds Phone" },
  { key: "podLeeds", label: "POD Leeds" },
  { key: "podOperator", label: "POD Operator" },
  { key: "podLeedsContact", label: "POD Contact" },
];

export default function LeedsTX() {
  const [accessReady, setAccessReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [items, setItems] = useState<ProductionContactLeeds[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductionContactLeedsPayload>(() =>
    emptyPayload()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const checkAccess = useCallback(async () => {
    setAccessReady(false);
    setAccessError(null);
    try {
      const me = await fetchAuthMe();
      const lvl = (me.user_level ?? "").toUpperCase().trim();
      setAllowed(ALLOWED_USER_LEVELS.has(lvl));
    } catch (e) {
      setAllowed(false);
      setAccessError(
        e instanceof Error ? e.message : "Impossibile verificare i permessi."
      );
    } finally {
      setAccessReady(true);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchProductionContactsLeeds();
      setItems(data);
    } catch (e) {
      setListError(
        e instanceof Error ? e.message : "Impossibile caricare i contatti."
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (!accessReady || !allowed) return;
    void loadList();
  }, [accessReady, allowed, loadList]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyPayload());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: ProductionContactLeeds) => {
    setEditingId(row.id);
    setForm(rowToPayload(row));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.competitionName.trim()) {
      setFormError("Competition è obbligatoria.");
      return;
    }
    setSaving(true);
    try {
      const payload: ProductionContactLeedsPayload = {
        ...form,
        competitionName: form.competitionName.trim(),
      };
      if (editingId != null) {
        const updated = await updateProductionContactLeeds(editingId, payload);
        setItems((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createProductionContactLeeds(payload);
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
      setEditingId(null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Salvataggio non riuscito."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: ProductionContactLeeds) => {
    const ok = window.confirm(
      `Eliminare la riga "${row.competitionName || row.id}"? L'operazione non è reversibile.`
    );
    if (!ok) return;
    setListError(null);
    try {
      await deleteProductionContactLeeds(row.id);
      setItems((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Eliminazione non riuscita."
      );
    }
  };

  const setField = (
    key: keyof ProductionContactLeedsPayload,
    value: string
  ) => {
    setForm((prev) => {
      if (key === "matchday" || key === "preDurationMinutes") {
        if (value === "") {
          return { ...prev, [key]: null };
        }
        const n = Number(value);
        return { ...prev, [key]: Number.isFinite(n) ? n : null };
      }
      return { ...prev, [key]: value === "" ? null : value };
    });
  };

  const formFields = useMemo(() => FORM_FIELDS, []);

  if (!accessReady) {
    return (
      <div className="text-sm text-pitch-gray">Verifica accesso…</div>
    );
  }

  if (accessError) {
    return (
      <div className="rounded border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        {accessError}
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded border border-pitch-gray-dark bg-pitch-gray-dark/20 px-4 py-3 text-sm text-pitch-gray-light">
        Non hai permesso di accedere a Leeds TX (solo MASTER o STAFF).
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Leeds TX"
        actions={
          <button type="button" className={btnPrimary} onClick={openCreate}>
            Aggiungi
          </button>
        }
      />

      {listError ? (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {listError}
        </p>
      ) : null}

      <ResponsiveTable minWidth="2200px">
        {loading ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
            <PageLoading />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
            Nessun contatto. Usa &quot;Aggiungi&quot; per crearne uno.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className={thClass}>Competition</th>
                <th className={thClass}>MD</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Day</th>
                <th className={thClass}>Pre (min)</th>
                <th className={thClass}>KO Italy</th>
                <th className={thClass}>KO GMT</th>
                <th className={thClass}>MCR Lineup GMT</th>
                <th className={thClass}>POD Lineup GMT</th>
                <th className={thClass}>Home</th>
                <th className={thClass}>Away</th>
                <th className={thClass}>Standard Cologno</th>
                <th className={thClass}>Facilities</th>
                <th className={thClass}>Live Prod. Coordinator</th>
                <th className={thClass}>Coordinator Contact</th>
                <th className={thClass}>Party Line</th>
                <th className={thClass}>MCR Leeds Phone</th>
                <th className={thClass}>POD Leeds</th>
                <th className={thClass}>POD Operator</th>
                <th className={thClass}>POD Contact</th>
                <th
                  className={`${thClass} sticky right-0 z-20 bg-pitch-bg border-l border-pitch-gray-dark`}
                >
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                >
                  <td className={`${tdClass} text-pitch-white`}>
                    {displayCell(row.competitionName)}
                  </td>
                  <td className={tdClass}>{displayCell(row.matchday)}</td>
                  <td className={tdClass}>{displayCell(row.date)}</td>
                  <td className={tdClass}>{displayCell(row.day)}</td>
                  <td className={tdClass}>
                    {displayCell(row.preDurationMinutes)}
                  </td>
                  <td className={tdClass}>{displayCell(row.koItalyTime)}</td>
                  <td className={tdClass}>{displayCell(row.koGmtTime)}</td>
                  <td className={tdClass}>
                    {displayCell(row.mcrLineupGmtTime)}
                  </td>
                  <td className={tdClass}>
                    {displayCell(row.podLineupGmtTime)}
                  </td>
                  <td className={tdClass}>
                    {displayCell(row.homeTeamNameShort)}
                  </td>
                  <td className={tdClass}>
                    {displayCell(row.awayTeamNameShort)}
                  </td>
                  <td className={tdClass}>{displayCell(row.standardCologno)}</td>
                  <td className={tdClass}>{displayCell(row.facilities)}</td>
                  <td className={tdClass}>
                    {displayCell(row.liveProductionCoordinator)}
                  </td>
                  <td className={tdClass}>
                    {displayCell(row.liveProductionCoordinatorContact)}
                  </td>
                  <td className={tdClass}>{displayCell(row.partyLine)}</td>
                  <td className={tdClass}>
                    {displayCell(row.mcrLeedsPhoneNumber)}
                  </td>
                  <td className={tdClass}>{displayCell(row.podLeeds)}</td>
                  <td className={tdClass}>{displayCell(row.podOperator)}</td>
                  <td className={tdClass}>{displayCell(row.podLeedsContact)}</td>
                  <td
                    className={`${tdClass} sticky right-0 z-10 border-l border-pitch-gray-dark bg-pitch-bg`}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={btnIconClass}
                        title="Modifica"
                        aria-label="Modifica"
                        onClick={() => openEdit(row)}
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        className={btnIconClass}
                        title="Elimina"
                        aria-label="Elimina"
                        onClick={() => void handleDelete(row)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ResponsiveTable>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => closeModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leeds-tx-modal-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3
              id="leeds-tx-modal-title"
              className="mb-4 text-lg font-semibold text-pitch-white"
            >
              {editingId != null ? "Modifica contatto" : "Nuovo contatto"}
            </h3>
            {formError ? (
              <p className="mb-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {formError}
              </p>
            ) : null}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {formFields.map((f) => {
                  const key = f.key;
                  const val = form[key];
                  const inputType =
                    f.type === "number"
                      ? "number"
                      : f.type === "date"
                        ? "date"
                        : "text";
                  const inputValue =
                    val == null
                      ? ""
                      : typeof val === "number"
                        ? String(val)
                        : val;
                  return (
                    <div key={String(key)}>
                      <label
                        htmlFor={`leeds-${String(key)}`}
                        className="mb-1 block text-xs text-pitch-gray"
                      >
                        {f.label}
                        {f.required ? (
                          <span className="text-red-400"> *</span>
                        ) : null}
                      </label>
                      <input
                        id={`leeds-${String(key)}`}
                        type={inputType}
                        className={inputClass}
                        value={inputValue}
                        onChange={(e) => setField(key, e.target.value)}
                        required={Boolean(f.required)}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className={btnSecondary}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={btnPrimary}
                >
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
