"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import FreelanceTopBar from "@/components/FreelanceTopBar";
import {
  type MyAssignmentDetail,
  type UserProfile,
  fetchAuthMe,
  fetchMyAssignmentDetail,
  formatCrewLocationLabel,
  formatFreelanceDetailDateLine,
  freelanceAssignmentStatusLabel,
} from "@/lib/api/freelanceAssignments";

function venueLine(d: MyAssignmentDetail): string {
  const parts = [d.venue_name, d.venue_city].filter(
    (p): p is string => !!p && String(p).trim() !== ""
  );
  if (parts.length) return parts.join(", ");
  if (d.location?.trim()) return d.location.trim();
  return "—";
}

function matchLine(d: MyAssignmentDetail): string | null {
  const h = d.home_team_name_short?.trim();
  const a = d.away_team_name_short?.trim();
  if (h && a) return `${h} vs ${a}`;
  if (h) return h;
  if (a) return a;
  return null;
}

export default function FreelanceAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentIdParam = params.assignmentId;
  const assignmentId =
    typeof assignmentIdParam === "string"
      ? Number(assignmentIdParam)
      : Array.isArray(assignmentIdParam)
        ? Number(assignmentIdParam[0])
        : NaN;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [detail, setDetail] = useState<MyAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const me = await fetchAuthMe();
      setProfile(me);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 401 || status === 403) {
        router.replace("/freelance/login");
        return;
      }
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [router]);

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const data = await fetchMyAssignmentDetail(assignmentId);
      setDetail(data);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 401 || status === 403) {
        router.replace("/freelance/login");
        return;
      }
      if (status === 404) {
        setNotFound(true);
        setDetail(null);
        return;
      }
      setError(
        e instanceof Error ? e.message : "Errore nel caricamento del dettaglio."
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const match = detail ? matchLine(detail) : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <FreelanceTopBar
        title="DETTAGLIO ASSEGNAZIONE"
        user={profile}
        userLoading={profileLoading}
      />

      <main className="mx-auto max-w-5xl px-4 py-4 md:px-6">
        <Link
          href="/freelance/le-mie-assegnazioni"
          className="inline-flex items-center gap-1 text-sm text-pitch-accent hover:underline"
        >
          ← Torna alle mie assegnazioni
        </Link>

        {loading && (
          <p className="mt-8 text-center text-pitch-gray">
            Caricamento assegnazione…
          </p>
        )}

        {!loading && notFound && (
          <div className="mt-8 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-6 text-pitch-gray-light">
            <p className="font-medium text-pitch-white">
              Assegnazione non trovata
            </p>
            <p className="mt-2 text-sm">
              L&apos;assegnazione richiesta non esiste o non è disponibile per il
              tuo account.
            </p>
          </div>
        )}

        {!loading && error && !notFound && (
          <p className="mt-8 text-red-400">{error}</p>
        )}

        {!loading && detail && !notFound && (
          <div className="mt-8 space-y-10">
            <section className="space-y-3 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-5">
              <h2 className="text-lg font-semibold text-pitch-white">
                {detail.competition_name || "Evento"}
              </h2>
              {detail.competition_code && (
                <p className="text-sm text-pitch-gray">
                  Codice: {detail.competition_code}
                  {detail.matchday != null ? ` · Giornata ${detail.matchday}` : ""}
                </p>
              )}
              {!detail.competition_code && detail.matchday != null && (
                <p className="text-sm text-pitch-gray">
                  Giornata {detail.matchday}
                </p>
              )}
              {match && (
                <p className="text-sm text-pitch-gray-light">
                  <span className="text-pitch-gray">Match: </span>
                  {match}
                </p>
              )}
              <p className="text-sm text-pitch-gray-light">
                <span className="text-pitch-gray">Data: </span>
                {formatFreelanceDetailDateLine(detail.date, detail.weekday)}
              </p>
              <p className="text-sm text-pitch-gray-light">
                <span className="text-pitch-gray">Ora KO: </span>
                {detail.ko_time || "—"}
              </p>
              <p className="text-sm text-pitch-gray-light">
                <span className="text-pitch-gray">Sede: </span>
                {venueLine(detail)}
              </p>
              <p className="mt-4 rounded-md border border-pitch-accent/40 bg-pitch-accent/10 px-4 py-3 text-sm font-medium text-pitch-accent">
                Il tuo ruolo: {detail.role_name || "—"}
              </p>
            </section>

            <section className="space-y-2 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-pitch-gray">
                Stato e note
              </h3>
              <p className="text-sm">
                <span className="text-pitch-gray">Stato: </span>
                <span className="font-medium text-pitch-accent">
                  {freelanceAssignmentStatusLabel(detail.status)}
                </span>
              </p>
              <div className="mt-2">
                <p className="text-xs text-pitch-gray">Note</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-pitch-gray-light">
                  {detail.notes?.trim()
                    ? detail.notes
                    : "Nessuna nota per questa assegnazione."}
                </p>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-base font-semibold text-pitch-white">
                Crew dell&apos;evento
              </h3>
              {detail.crew.length === 0 ? (
                <p className="text-sm text-pitch-gray">
                  Nessun membro in crew per questo evento.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-pitch-gray-dark">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/40">
                        <th className="px-4 py-3 font-medium text-pitch-gray">
                          Nome
                        </th>
                        <th className="px-4 py-3 font-medium text-pitch-gray">
                          Ruolo
                        </th>
                        <th className="px-4 py-3 font-medium text-pitch-gray">
                          Location
                        </th>
                        <th className="px-4 py-3 font-medium text-pitch-gray">
                          Stato
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.crew.map((row, idx) => (
                        <tr
                          key={`${row.staff_id ?? "slot"}-${row.role_name}-${idx}`}
                          className="border-b border-pitch-gray-dark/50 last:border-0 hover:bg-pitch-gray-dark/20"
                        >
                          <td className="px-4 py-3 text-pitch-white">
                            {row.staff_name?.trim()
                              ? row.staff_name
                              : "Slot libero"}
                          </td>
                          <td className="px-4 py-3 text-pitch-gray-light">
                            {row.role_name || "—"}
                          </td>
                          <td className="px-4 py-3 text-pitch-gray-light">
                            {formatCrewLocationLabel(row.location)}
                          </td>
                          <td className="px-4 py-3 font-medium text-pitch-accent">
                            {freelanceAssignmentStatusLabel(row.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
