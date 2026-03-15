import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";

export default function MasterPage() {
  return (
    <>
      <PageHeader title="Master" />
      <div className="mt-4">
        <SearchBar placeholder="Cerca master..." />
      </div>
      <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
        Qui verrà la lista master
      </div>
    </>
  );
}
