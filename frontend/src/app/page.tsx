"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  message: string;
  status: string;
};

const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHealth = async (): Promise<void> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/health`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: HealthResponse = (await response.json()) as HealthResponse;
        setHealth(data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void fetchHealth();
  }, []);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Oroborous</h1>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          Full-stack starter with Next.js, Tailwind CSS, and Python API.
        </p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h2 className="text-sm font-medium text-slate-300">API health</h2>

          {loading ? (
            <p className="mt-2 text-sm text-slate-400">Checking backend...</p>
          ) : null}

          {!loading && error ? (
            <p className="mt-2 text-sm text-red-400">Failed to fetch: {error}</p>
          ) : null}

          {!loading && !error && health ? (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                <span className="text-slate-400">Status:</span> {health.status}
              </p>
              <p>
                <span className="text-slate-400">Message:</span> {health.message}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
