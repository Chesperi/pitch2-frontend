import { cookies } from "next/headers";
import { PageHeader } from "@/components/PageHeader";
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

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const [initialTasks, initialDocuments] = await Promise.all([
    fetchCookiesJarTasks({ date: initialDate }, { cookieHeader }),
    fetchDocuments({}, { cookieHeader }),
  ]);

  return (
    <>
      <PageHeader title="Cookies jar" />
      <CookiesJarTasksPage
        initialDate={initialDate}
        initialTasks={initialTasks}
        initialDocuments={initialDocuments}
      />
    </>
  );
}
