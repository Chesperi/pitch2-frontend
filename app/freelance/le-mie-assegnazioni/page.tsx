"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import FreelanceTopBar from "@/components/FreelanceTopBar";
import {
  type MyAssignmentListItem,
  type UserProfile,
  confirmAllMyAssignments,
  confirmMyAssignment,
  fetchAuthMe,
  fetchMyAssignments,
  patchMyAssignmentNotes,
} from "@/lib/api/freelanceAssignments";

function formatUpdatedLine(): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
}

function formatDateRow(
  dateStr: string | null,
  weekdayFromApi: string | null
): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const base = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  if (weekdayFromApi?.trim()) {
    return `${weekdayFromApi.trim()}, ${base}`;
  }
  return base;
}

function statusLabel(status: string): string {
  const u = status.toUpperCase();
  if (u === "SENT") return "DA CONFERMARE";
  if (u === "CONFIRMED") return "CONFERMATO";
  if (u === "CANCELED" || u === "CANCELLED") return "ANNULLATO";
  if (u === "REJECTED") return "RIFIUTATO";
  return u || "—";
}

function venueLine(row: MyAssignmentListItem): string {
  const parts = [row.venue_name, row.venue_city].filter(
    (p): p is string => !!p && String(p).trim() !== ""
  );
  if (parts.length) return parts.join(", ");
  if (row.location?.trim()) return row.location.trim();
  return "—";
}

export default function FreelanceLeMieAssegnazioniPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [items, setItems] = useState<MyAssignmentListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const updatedLine = useMemo(() => formatUpdatedLine(), []);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setAuthError(null);
    try {
      const me = await fetchAuthMe();
      setProfile(me);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 401 || status === 403) {
        router.replace("/freelance/login");
        return;
      }
      setAuthError("Sessione scaduta o non disponibile. Accedi di nuovo.");
      setProfile(null);
      setListLoading(false);
    } finally {
      setProfileLoading(false);
    }
  }, [router]);

  const loadAssignments = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const list = await fetchMyAssignments();
      setItems(list);
      setNoteDrafts((prev) => {
        const next = { ...prev };
        for (const row of list) {
          if (next[row.id] === undefined) {
            next[row.id] = row.notes ?? "";
          }
        }
        return next;
      });
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 401 || status === 403) {
        router.replace("/freelance/login");
        return;
      }
      setListError(
        e instanceof Error ? e.message : "Errore nel caricamento delle assegnazioni."
      );
    } finally {
      setListLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (authError) return;
    if (!profileLoading && profile) {
      loadAssignments();
    }
    if (!profileLoading && !profile && !authError) {
      setListLoading(false);
    }
  }, [profile, profileLoading, authError, loadAssignments]);

  const sentCount = useMemo(
    () => items.filter((i) => i.status.toUpperCase() === "SENT").length,
    [items]
  );

  const handleSaveNotes = async (id: number) => {
    const text = noteDrafts[id] ?? "";
    setSavingNoteId(id);
    try {
      await patchMyAssignmentNotes(id, text);
      setItems((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, notes: text } : row
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore salvataggio note");
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleConfirmOne = async (id: number) => {
    setConfirmingId(id);
    try {
      await confirmMyAssignment(id);
      setItems((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, status: "CONFIRMED" } : row
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore conferma");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    try {
      await confirmAllMyAssignments();
      await loadAssignments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore conferma tutti");
    } finally {
      setConfirmingAll(false);
    }
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-black text-white">
        <FreelanceTopBar
          title="LE MIE ASSEGNAZIONI"
          user={null}
          userLoading={false}
        />
        <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <p className="text-pitch-gray-light">{authError}</p>
          <Link
            href="/freelance/login"
            className="mt-4 inline-block text-sm text-pitch-accent underline"
          >
            Vai al login
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <FreelanceTopBar
        title="LE MIE ASSEGNAZIONI"
        user={profile}
        userLoading={profileLoading}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <p className="text-sm text-pitch-gray-light">
          Di seguito le tue assegnazioni. Ultimo aggiornamento: {updatedLine}
        </p>

        {sentCount > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleConfirmAll}
              disabled={confirmingAll || listLoading}
              className="rounded-lg bg-pitch-accent px-4 py-2 text-sm font-medium text-black hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmingAll ? "Conferma in corso…" : "Conferma tutti"}
            </button>
          </div>
        )}

        {listLoading && (
          <p className="mt-8 text-center text-pitch-gray">Caricamento…</p>
        )}

        {!listLoading && listError && (
          <p className="mt-8 text-red-400">{listError}</p>
        )}

        {!listLoading && !listError && items.length === 0 && (
          <p className="mt-8 text-center text-pitch-gray-light">
            Al momento non hai assegnazioni attive.
          </p>
        )}

        {!listLoading && !listError && items.length > 0 && (
          <ul className="mt-8 flex flex-col gap-6">
            {items.map((row) => {
              const isSent = row.status.toUpperCase() === "SENT";
              const noteValue = noteDrafts[row.id] ?? row.notes ?? "";

              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-4 md:p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <p>
                        <span className="text-pitch-gray">Competizione: </span>
                        <span className="text-pitch-white">
                          {row.competition_name || "—"}
                        </span>
                      </p>
                      <p>
                        <span className="text-pitch-gray">Data: </span>
                        <span className="text-pitch-white">
                          {formatDateRow(row.date, row.weekday ?? null)}
                        </span>
                      </p>
                      <p>
                        <span className="text-pitch-gray">Ora KO: </span>
                        <span className="text-pitch-white">
                          {row.ko_time ?? "—"}
                        </span>
                      </p>
                      <p>
                        <span className="text-pitch-gray">Ruolo: </span>
                        <span className="text-pitch-white">
                          {row.role_name || "—"}
                        </span>
                      </p>
                      <p>
                        <span className="text-pitch-gray">Sede: </span>
                        <span className="text-pitch-white">{venueLine(row)}</span>
                      </p>
                      <p>
                        <span className="text-pitch-gray">Stato: </span>
                        <span className="font-medium text-pitch-accent">
                          {statusLabel(row.status)}
                        </span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center md:flex-col md:items-stretch">
                      {isSent && (
                        <button
                          type="button"
                          onClick={() => handleConfirmOne(row.id)}
                          disabled={confirmingId === row.id}
                          className="rounded-lg bg-pitch-accent px-3 py-2 text-sm font-medium text-black hover:bg-yellow-200 disabled:opacity-50"
                        >
                          {confirmingId === row.id ? "…" : "Conferma"}
                        </button>
                      )}
                      <Link
                        href={`/freelance/le-mie-assegnazioni/${row.id}`}
                        className="rounded-lg border border-pitch-gray-dark px-3 py-2 text-center text-sm text-pitch-gray-light hover:bg-pitch-gray-dark/50"
                      >
                        Dettaglio
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-pitch-gray-dark/50 pt-4">
                    <label className="mb-1 block text-xs text-pitch-gray">
                      Note
                    </label>
                    <textarea
                      value={noteValue}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded border border-pitch-gray-dark bg-black px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveNotes(row.id)}
                      disabled={savingNoteId === row.id}
                      className="mt-2 rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark/50 disabled:opacity-50"
                    >
                      {savingNoteId === row.id ? "Salvataggio…" : "Salva note"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
