import { cookies } from "next/headers";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import {
  fetchRoles,
  fetchStaff,
} from "@/lib/api";
import { fetchStandardCombos } from "@/lib/api/standardCombos";
import { DatabaseSections } from "./DatabaseSections";

export const dynamic = "force-dynamic";

export default async function DatabasePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const [roles, staffData, standardCombos] = await Promise.all([
    fetchRoles({ cookieHeader }),
    fetchStaff({ limit: 50, offset: 0 }, { cookieHeader }),
    fetchStandardCombos({ cookieHeader }),
  ]);
  const staff = staffData.items ?? [];
  const roleMap: Record<string, string> = Object.fromEntries(
    roles.map((r) => [r.code, r.name])
  );
  const combos = Array.isArray(standardCombos) ? standardCombos : [];

  return (
    <>
      <PageHeader title="Database" />
      <p className="mt-3 text-xs leading-relaxed text-pitch-gray">
        Anagrafiche di sistema (ruoli, staff, pacchetti standard) usate nei menu e nei
        flussi delle altre pagine — ad esempio Eventi, Designazioni e accrediti. Ruoli,
        staff e pacchetti standard si possono creare o modificare da questa pagina.
      </p>
      <div className="mt-4">
        <SearchBar placeholder="Cerca nel database..." />
      </div>

      <div className="mt-8">
        <DatabaseSections
          staff={staff}
          staffTotal={staffData.total ?? 0}
          roles={roles}
          standardCombos={combos}
          roleMap={roleMap}
        />
      </div>
    </>
  );
}
