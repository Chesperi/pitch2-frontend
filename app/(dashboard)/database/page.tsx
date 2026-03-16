import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import {
  fetchRoles,
  fetchStaff,
} from "@/lib/api";
import { fetchAllStandardRequirements } from "@/lib/api/standardRequirements";
import { DatabaseSections } from "./DatabaseSections";

export const dynamic = "force-dynamic";

export default async function DatabasePage() {
  const [roles, staffData, standardRequirements] = await Promise.all([
    fetchRoles(),
    fetchStaff({ limit: 100, offset: 0 }),
    fetchAllStandardRequirements(),
  ]);
  const staff = staffData.items ?? [];
  const roleMap: Record<string, string> = Object.fromEntries(
    roles.map((r) => [r.code, r.name])
  );
  const reqs = Array.isArray(standardRequirements) ? standardRequirements : [];

  return (
    <>
      <PageHeader title="Database" />
      <div className="mt-4">
        <SearchBar placeholder="Cerca nel database..." />
      </div>

      <div className="mt-8">
        <DatabaseSections
          staff={staff}
          roles={roles}
          standardRequirements={reqs}
          roleMap={roleMap}
        />
      </div>
    </>
  );
}
