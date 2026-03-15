import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { fetchRoles, fetchStaff } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DatabasePage() {
  const [roles, staffData] = await Promise.all([
    fetchRoles(),
    fetchStaff({ limit: 100, offset: 0 }),
  ]);
  const staff = staffData.items;
  const roleMap = new Map(roles.map((r) => [r.code, r.name]));

  return (
    <>
      <PageHeader title="Database" />
      <div className="mt-4">
        <SearchBar placeholder="Cerca nel database..." />
      </div>

      {/* Staff section */}
      <section className="mt-8">
        <h3 className="mb-4 text-lg font-semibold text-pitch-white">Staff</h3>
        <div className="overflow-x-auto">
          {staff.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessuno staff
            </div>
          ) : (
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Cognome</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Telefono</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Azienda</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Ruolo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Sede</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Fee</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Targa(e)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">User level</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Attivo</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">{s.surname}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.company ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.default_role_code ? roleMap.get(s.default_role_code) ?? s.default_role_code : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.default_location ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.fee ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.plates ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{s.user_level}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          s.active ? "bg-green-900/50 text-green-300" : "bg-pitch-gray-dark text-pitch-gray"
                        }`}
                      >
                        {s.active ? "Sì" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Ruoli section */}
      <section className="mt-12">
        <h3 className="mb-4 text-lg font-semibold text-pitch-white">Ruoli</h3>
        <div className="overflow-x-auto">
          {roles.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessun ruolo
            </div>
          ) : (
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">Active</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">{r.code}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{r.location}</td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">{r.description ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.active ? "bg-green-900/50 text-green-300" : "bg-pitch-gray-dark text-pitch-gray"
                        }`}
                      >
                        {r.active ? "Sì" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
