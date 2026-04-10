"use client";

import Link from "next/link";

export default function ProviderAssignmentsPlaceholderPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <div className="w-full max-w-lg rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-center shadow-lg">
        <h1 className="text-xl font-semibold text-pitch-accent">
          Area provider in costruzione
        </h1>
        <p className="mt-3 text-sm text-pitch-gray-light">
          Stiamo completando le funzionalita dedicate ai provider.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200"
        >
          Torna al login
        </Link>
      </div>
    </main>
  );
}
