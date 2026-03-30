import { PageHeader } from "@/components/PageHeader";
import { fetchStaff } from "@/lib/api";
import { fetchCookiesJarTasks } from "@/lib/api/cookiesJarTasks";
import { fetchDocuments } from "@/lib/api/documents";
import { CookiesJarTasksPage } from "./CookiesJarTasksPage";

export const dynamic = "force-dynamic";

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CookiesJarPage() {
  const initialDate = toYyyyMmDd(new Date());

  const [initialTasks, staffData, initialDocuments] = await Promise.all([
    fetchCookiesJarTasks({ date: initialDate }),
    fetchStaff({ limit: 100, offset: 0 }),
    fetchDocuments({}),
  ]);

  const staff = staffData.items ?? [];
  const staffForSelect = staff.map((s) => ({
    id: s.id,
    fullName: `${s.surname} ${s.name}`.trim(),
  }));

  return (
    <>
      <PageHeader title="Cookies jar" />
      <CookiesJarTasksPage
        initialDate={initialDate}
        initialTasks={initialTasks}
        staffForSelect={staffForSelect}
        initialDocuments={initialDocuments}
      />
    </>
  );
}
