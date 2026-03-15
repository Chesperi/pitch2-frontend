import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { fetchEvents } from "@/lib/api/events";

export const dynamic = "force-dynamic";

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

function renderEventStatus(status: string | null): React.ReactNode {
  const value = status?.toUpperCase() ?? "";
  switch (value) {
    case "TBC":
      return (
        <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">
          Da confermare
        </span>
      );
    case "OK":
    case "CONFIRMED":
      return (
        <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300">
          {value === "OK" ? "OK" : "Confermato"}
        </span>
      );
    case "CANCELLED":
      return (
        <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300">
          Cancellato
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
          {status || "—"}
        </span>
      );
  }
}

export default async function EventiPage() {
  const { items } = await fetchEvents({ limit: 50, offset: 0 });

  return (
    <>
      <PageHeader title="Eventi" />
      <div className="mt-4">
        <SearchBar placeholder="Cerca eventi..." />
      </div>
      <div className="mt-6 overflow-x-auto">
        {items.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
            Nessun evento
          </div>
        ) : (
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Match</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Competizione</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Categoria</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Data KO</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">PRE</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Standard Onsite</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Standard Cologno</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Show</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => {
                const match =
                  event.home_team_name_short && event.away_team_name_short
                    ? `${event.home_team_name_short} vs ${event.away_team_name_short}`
                    : event.home_team_name_short ?? event.away_team_name_short ?? "—";
                return (
                  <tr
                    key={event.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">{match}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{event.competition_name}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{event.category}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {formatKoItaly(event.ko_italy)}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{event.pre_duration_minutes}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{event.standard_onsite ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{event.standard_cologno ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{event.location ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{event.show_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {renderEventStatus(event.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
