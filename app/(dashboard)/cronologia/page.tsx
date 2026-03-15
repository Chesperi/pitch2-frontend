import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";

export default function CronologiaPage() {
  return (
    <>
      <PageHeader title="Cronologia" />
      <div className="mt-4">
        <SearchBar placeholder="Cerca cronologia..." />
      </div>
      <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
        Qui verrà la lista cronologia
      </div>
    </>
  );
}
