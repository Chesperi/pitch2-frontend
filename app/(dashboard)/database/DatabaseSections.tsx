"use client";

import { useState } from "react";
import type { StaffItem } from "@/lib/api/staff";
import type { Role } from "@/lib/api/roles";
import type { StandardRequirementWithRole } from "@/lib/api/standardRequirements";

interface DatabaseSectionsProps {
  staff: StaffItem[];
  roles: Role[];
  standardRequirements: StandardRequirementWithRole[];
  roleMap: Record<string, string>;
}

function CollapsibleSection({
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
    <section className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-lg font-semibold text-pitch-white hover:bg-pitch-gray-dark/50"
      >
        {title}
        <span className="text-pitch-gray">
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && <div className="border-t border-pitch-gray-dark p-4">{children}</div>}
    </section>
  );
}

export function DatabaseSections({
  staff,
  roles,
  standardRequirements,
  roleMap,
}: DatabaseSectionsProps) {
  const [staffOpen, setStaffOpen] = useState(true);
  const [rolesOpen, setRolesOpen] = useState(true);
  const [standardOpen, setStandardOpen] = useState(true);

  return (
    <>
      <CollapsibleSection
        title="Staff"
        open={staffOpen}
        onToggle={() => setStaffOpen(!staffOpen)}
      >
        <div className="overflow-x-auto">
          {staff.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessuno staff
            </div>
          ) : (
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Cognome
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Telefono
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Azienda
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Ruolo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Sede
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Fee
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Targa(e)
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    User level
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Attivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {s.surname}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.company ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.default_role_code
                        ? roleMap[s.default_role_code] ?? s.default_role_code
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.default_location ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.fee ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.plates ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.user_level}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          s.active
                            ? "bg-green-900/50 text-green-300"
                            : "bg-pitch-gray-dark text-pitch-gray"
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Ruoli"
        open={rolesOpen}
        onToggle={() => setRolesOpen(!rolesOpen)}
      >
        <div className="overflow-x-auto">
          {roles.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessun ruolo
            </div>
          ) : (
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Active
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {r.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {r.location}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {r.description ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.active
                            ? "bg-green-900/50 text-green-300"
                            : "bg-pitch-gray-dark text-pitch-gray"
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Standard requirements"
        open={standardOpen}
        onToggle={() => setStandardOpen(!standardOpen)}
      >
        <div className="overflow-x-auto">
          {standardRequirements.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessun standard requirement
            </div>
          ) : (
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Standard onsite
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Standard Cologno
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Sede
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Area produzione
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Ruolo
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-pitch-gray">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {standardRequirements.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {req.standardOnsite}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.standardCologno}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.site}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.areaProduzione}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.roleCode} – {req.roleName}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-pitch-gray-light">
                      {req.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray">
                      {req.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
}
