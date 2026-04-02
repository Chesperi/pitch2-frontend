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
import {
  createProductionContactLeeds,
  deleteProductionContactLeeds,
  fetchProductionContactsLeeds,
  updateProductionContactLeeds,
  type ProductionContactLeeds,
  type ProductionContactLeedsPayload,
} from "@/lib/api/productionContactsLeeds";

const ALLOWED_USER_LEVELS = new Set(["MASTER", "STAFF"]);

const BTN_PRIMARY =
  "rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

const BTN_SECONDARY =
  "rounded border border-pitch-gray-dark bg-transparent px-3 py-1.5 text-xs font-medium text-pitch-gray-light hover:border-pitch-accent hover:text-pitch-accent disabled:cursor-not-allowed disabled:opacity-50";

const BTN_ICON =
  "inline-flex items-center justify-center rounded p-1.5 text-pitch-gray-light hover:bg-pitch-gray-dark hover:text-pitch-accent disabled:opacity-40";

const INPUT_CLASS =
  "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1.5 text-xs text-pitch-white placeholder:text-pitch-gray focus:border-pitch-accent focus:outline-none";

const TH_CLASS =
  "sticky top-0 z-10 whitespace-nowrap bg-pitch-bg px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-pitch-gray";

const TD_CLASS = "whitespace-nowrap px-2 py-2 text-xs text-pitch-gray-light";

function emptyPayload(): ProductionContactLeedsPayload {
  return {
    competition: "",
    matchday: null,
    date: null,
    day: null,
    koItaly: null,
    koGmt: null,
    mcrLineupGmt: null,
    podLineupGmt: null,
    preMinutes: null,
    home: null,
    away: null,
    standardCologno: null,
    facilities: null,
    liveProdCoordinator: null,
    coordinatorContact: null,
    partyLine: null,
    mcrLeedsPhone: null,
    podLeeds: null,
    podOperator: null,
    podContact: null,
  };
}

function rowToPayload(row: ProductionContactLeeds): ProductionContactLeedsPayload {
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
    if (!form.competition.trim()) {
      setFormError("Competition è obbligatoria.");
      return;
    }
    setSaving(true);
    try {
      const payload: ProductionContactLeedsPayload = {
        ...form,
        competition: form.competition.trim(),
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
      `Eliminare la riga "${row.competition || row.id}"? L'operazione non è reversibile.`
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

  const formFields = useMemo(
    () =>
      [
        { key: "competition" as const, label: "Competition", required: true },
        { key: "matchday" as const, label: "MD", type: "number" as const },
        { key: "date" as const, label: "Date", type: "date" as const },
        { key: "day" as const, label: "Day" },
        { key: "koItaly" as const, label: "KO Italy" },
        { key: "koGmt" as const, label: "KO GMT" },
        { key: "mcrLineupGmt" as const, label: "MCR Lineup GMT" },
        { key: "podLineupGmt" as const, label: "POD Lineup GMT" },
        { key: "preMinutes" as const, label: "Pre (min)", type: "number" as const },
        { key: "home" as const, label: "Home" },
        { key: "away" as const, label: "Away" },
        { key: "standardCologno" as const, label: "Standard Cologno" },
        { key: "facilities" as const, label: "Facilities" },
        {
          key: "liveProdCoordinator" as const,
          label: "Live Prod. Coordinator",
        },
        { key: "coordinatorContact" as const, label: "Coordinator Contact" },
        { key: "partyLine" as const, label: "Party Line" },
        { key: "mcrLeedsPhone" as const, label: "MCR Leeds Phone" },
        { key: "podLeeds" as const, label: "POD Leeds" },
        { key: "podOperator" as const, label: "POD Operator" },
        { key: "podContact" as const, label: "POD Contact" },
      ] as const,
    []
  );

  const setField = (
    key: keyof ProductionContactLeedsPayload,
    value: string
  ) => {
    setForm((prev) => {
      if (key === "matchday" || key === "preMinutes") {
        if (value === "") {
          return { ...prev, [key]: null };
        }
        const n = Number(value);
        return { ...prev, [key]: Number.isFinite(n) ? n : null };
      }
      return { ...prev, [key]: value === "" ? null : value };
    });
  };

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
          <button type="button" className={BTN_PRIMARY} onClick={openCreate}>
            Aggiungi
          </button>
        }
      />

      {listError ? (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {listError}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/10">
        {loading ? (
          <div className="p-8 text-center text-sm text-pitch-gray">
            Caricamento…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-pitch-gray">
            Nessun contatto. Usa &quot;Aggiungi&quot; per crearne uno.
          </div>
        ) : (
          <table className="min-w-max w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className={TH_CLASS}>Competition</th>
                <th className={TH_CLASS}>MD</th>
                <th className={TH_CLASS}>Date</th>
                <th className={TH_CLASS}>Day</th>
                <th className={TH_CLASS}>KO Italy</th>
                <th className={TH_CLASS}>KO GMT</th>
                <th className={TH_CLASS}>MCR Lineup GMT</th>
                <th className={TH_CLASS}>POD Lineup GMT</th>
                <th className={TH_CLASS}>Pre (min)</th>
                <th className={TH_CLASS}>Home</th>
                <th className={TH_CLASS}>Away</th>
                <th className={TH_CLASS}>Standard Cologno</th>
                <th className={TH_CLASS}>Facilities</th>
                <th className={TH_CLASS}>Live Prod. Coordinator</th>
                <th className={TH_CLASS}>Coordinator Contact</th>
                <th className={TH_CLASS}>Party Line</th>
                <th className={TH_CLASS}>MCR Leeds Phone</th>
                <th className={TH_CLASS}>POD Leeds</th>
                <th className={TH_CLASS}>POD Operator</th>
                <th className={TH_CLASS}>POD Contact</th>
                <th className={`${TH_CLASS} sticky right-0 z-20 bg-pitch-bg`}>
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-pitch-gray-dark/80 hover:bg-pitch-gray-dark/30"
                >
                  <td className={TD_CLASS}>{displayCell(row.competition)}</td>
                  <td className={TD_CLASS}>{displayCell(row.matchday)}</td>
                  <td className={TD_CLASS}>{displayCell(row.date)}</td>
                  <td className={TD_CLASS}>{displayCell(row.day)}</td>
                  <td className={TD_CLASS}>{displayCell(row.koItaly)}</td>
                  <td className={TD_CLASS}>{displayCell(row.koGmt)}</td>
                  <td className={TD_CLASS}>{displayCell(row.mcrLineupGmt)}</td>
                  <td className={TD_CLASS}>{displayCell(row.podLineupGmt)}</td>
                  <td className={TD_CLASS}>{displayCell(row.preMinutes)}</td>
                  <td className={TD_CLASS}>{displayCell(row.home)}</td>
                  <td className={TD_CLASS}>{displayCell(row.away)}</td>
                  <td className={TD_CLASS}>{displayCell(row.standardCologno)}</td>
                  <td className={TD_CLASS}>{displayCell(row.facilities)}</td>
                  <td className={TD_CLASS}>
                    {displayCell(row.liveProdCoordinator)}
                  </td>
                  <td className={TD_CLASS}>
                    {displayCell(row.coordinatorContact)}
                  </td>
                  <td className={TD_CLASS}>{displayCell(row.partyLine)}</td>
                  <td className={TD_CLASS}>{displayCell(row.mcrLeedsPhone)}</td>
                  <td className={TD_CLASS}>{displayCell(row.podLeeds)}</td>
                  <td className={TD_CLASS}>{displayCell(row.podOperator)}</td>
                  <td className={TD_CLASS}>{displayCell(row.podContact)}</td>
                  <td
                    className={`${TD_CLASS} sticky right-0 z-10 bg-pitch-bg border-l border-pitch-gray-dark`}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={BTN_ICON}
                        title="Modifica"
                        aria-label="Modifica"
                        onClick={() => openEdit(row)}
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        className={BTN_ICON}
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
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => closeModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leeds-tx-modal-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2
              id="leeds-tx-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingId != null ? "Modifica contatto" : "Nuovo contatto"}
            </h2>
            {formError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {formError}
              </p>
            ) : null}
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                {formFields.map((f) => {
                  const key = f.key;
                  const val = form[key];
                  const inputType =
                    "type" in f && f.type === "number"
                      ? "number"
                      : "type" in f && f.type === "date"
                        ? "date"
                        : "text";
                  const inputValue =
                    val == null
                      ? ""
                      : typeof val === "number"
                        ? String(val)
                        : val;
                  return (
                    <div key={key}>
                      <label
                        htmlFor={`leeds-${key}`}
                        className="mb-1 block text-xs text-pitch-gray"
                      >
                        {f.label}
                        {"required" in f && f.required ? (
                          <span className="text-red-400"> *</span>
                        ) : null}
                      </label>
                      <input
                        id={`leeds-${key}`}
                        type={inputType}
                        className={INPUT_CLASS}
                        value={inputValue}
                        onChange={(e) => setField(key, e.target.value)}
                        required={"required" in f ? f.required : false}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={saving}
                  onClick={closeModal}
                >
                  Annulla
                </button>
                <button type="submit" className={BTN_PRIMARY} disabled={saving}>
                  {saving ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
