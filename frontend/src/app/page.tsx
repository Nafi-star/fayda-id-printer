export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Fayda ID Printer Platform</h1>
          <p className="text-zinc-600 dark:text-zinc-300">
            Option 2 starter is ready: Next.js frontend plus Python worker.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Build sequence</h2>
          <ol className="list-decimal space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
            <li>Set environment variables in root `.env` from `.env.example`.</li>
            <li>Connect PostgreSQL, Redis, and S3-compatible storage.</li>
            <li>Run frontend API routes for job creation and status.</li>
            <li>Run Python worker to process queued PDF conversion jobs.</li>
            <li>Add Tellbirr/CBE payment integration after core flow works.</li>
          </ol>
        </section>

        <p className="rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-800">
          Next step: open the root `README.md` and follow Step 1 to bootstrap local
          services and install dependencies.
        </p>
      </main>
    </div>
  );
}
