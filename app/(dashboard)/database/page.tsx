import { Suspense } from "react";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import {
  fetchRoles,
  fetchStaff,
} from "@/lib/api";
import { fetchStandardCombos } from "@/lib/api/standardCombos";
import PageLoading from "@/components/ui/PageLoading";
import DesktopRecommended from "@/components/ui/DesktopRecommended";
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
    fetchStaff(
      { limit: 50, offset: 0, includeRoles: true },
      { cookieHeader }
    ),
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
      <DesktopRecommended />
      <div className="mt-4">
        <SearchBar placeholder="Search database..." />
      </div>

      <div className="mt-8">
        <Suspense fallback={<PageLoading />}>
          <DatabaseSections
            staff={staff}
            staffTotal={staffData.total ?? 0}
            roles={roles}
            standardCombos={combos}
            roleMap={roleMap}
          />
        </Suspense>
      </div>
    </>
  );
}
