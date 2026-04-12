"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getApiBaseUrl } from "@/lib/api/config";
import { fetchEventById, type EventItem } from "@/lib/api/events";
import { downloadBackendFile } from "@/lib/utils/downloadFile";
import { EventAccreditationsTab } from "./EventAccreditationsTab";

type EventTab = "info" | "accrediti";

const exportBtnClass =
  "rounded border border-pitch-gray-dark px-2 py-1 text-[11px] font-medium text-pitch-white hover:bg-pitch-gray-dark disabled:cursor-not-allowed disabled:opacity-50";

function formatKoItaly(koItaly: string | null): string {
  if (!koItaly) return "—";
  try {
    const date = new Date(koItaly);
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return koItaly;
  }
}

export default function EventoDettaglioPage() {
  const params = useParams();
  const rawId = params.id;
  const eventId =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
        ? rawId[0] ?? ""
        : "";

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloadingType, setDownloadingType] = useState<
    "pdf" | "xlsx" | null
  >(null);
  const [activeTab, setActiveTab] = useState<EventTab>("info");

  const load = useCallback(async () => {
    if (!eventId.trim()) {
      setNotFound(true);
      setEvent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const ev = await fetchEventById(eventId);
      if (!ev) {
        setNotFound(true);
        setEvent(null);
      } else {
        setEvent(ev);
      }
    } catch {
      setNotFound(true);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (type: "pdf" | "xlsx") => {
    if (!event?.id) return;
    setDownloadingType(type);
    const baseUrl = getApiBaseUrl();
    const url =
      type === "pdf"
        ? `${baseUrl}/api/accrediti/${encodeURIComponent(event.id)}/pdf`
        : `${baseUrl}/api/accrediti/${encodeURIComponent(event.id)}/export-xlsx`;
    const filename =
      type === "pdf"
        ? `accrediti-event-${event.id}.pdf`
        : `accrediti-event-${event.id}.xlsx`;

    await downloadBackendFile({
      url,
      filename,
      onError: () => {
        alert("Error downloading file");
      },
    });

    setDownloadingType(null);
  };

  const matchLabel =
    event &&
    event.homeTeamNameShort &&
    event.awayTeamNameShort
      ? `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`
      : event
        ? (event.homeTeamNameShort ?? event.awayTeamNameShort ?? "—")
        : "—";

  return (
    <>
      <PageHeader
        title={loading ? "Event" : notFound ? "Event not found" : "Event detail"}
        actions={
          <Link
            href="/eventi"
            className="rounded border border-pitch-gray-dark px-4 py-2 text-sm text-pitch-gray-light hover:bg-pitch-gray-dark"
          >
            Back to list
          </Link>
        }
      />

      {loading ? (
        <p className="mt-6 text-sm text-pitch-gray">Loading…</p>
      ) : notFound || !event ? (
        <p className="mt-6 text-sm text-pitch-gray">
          The requested event is not available.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/10 px-4 py-3">
            <span className="text-sm font-medium text-pitch-white">Accreditations</span>
            <button
              type="button"
              onClick={() => void handleDownload("pdf")}
              disabled={downloadingType === "pdf"}
              className={exportBtnClass}
            >
              {downloadingType === "pdf" ? "PDF…" : "PDF"}
            </button>
            <button
              type="button"
              onClick={() => void handleDownload("xlsx")}
              disabled={downloadingType === "xlsx"}
              className={exportBtnClass}
            >
              {downloadingType === "xlsx" ? "XLSX…" : "XLSX"}
            </button>
          </div>

          <div className="mt-4 border-b border-pitch-gray-dark">
            <nav className="-mb-px flex gap-4 text-sm">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={
                  activeTab === "info"
                    ? "border-b-2 border-pitch-accent pb-2 text-pitch-white"
                    : "border-b-2 border-transparent pb-2 text-pitch-gray-light hover:text-pitch-white"
                }
              >
                Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("accrediti")}
                className={
                  activeTab === "accrediti"
                    ? "border-b-2 border-pitch-accent pb-2 text-pitch-white"
                    : "border-b-2 border-transparent pb-2 text-pitch-gray-light hover:text-pitch-white"
                }
              >
                Accreditations
              </button>
            </nav>
          </div>

          {activeTab === "info" && (
            <div className="mt-4 space-y-6">
              <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/10 p-4">
                <h2 className="text-lg font-semibold text-pitch-white">
                  {matchLabel}
                </h2>
                <p className="mt-1 text-sm text-pitch-gray-light">
                  {event.competitionName}
                </p>
                <p className="mt-1 text-xs text-pitch-gray">
                  KO Italy: {formatKoItaly(event.koItaly)}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  href={`/designazioni/${event.id}`}
                  className="text-pitch-accent underline-offset-2 hover:underline"
                >
                  Open assignments
                </Link>
              </div>
            </div>
          )}

          {activeTab === "accrediti" && (
            <EventAccreditationsTab eventId={event.id} />
          )}
        </div>
      )}
    </>
  );
}
