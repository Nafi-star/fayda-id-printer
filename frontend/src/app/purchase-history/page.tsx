import { AppShell } from "@/components/app-shell";

export default function PurchaseHistoryPage() {
  return (
    <AppShell active="purchase-history">
      <section className="mx-auto max-w-5xl">
        <a href="/pricing" className="text-sm text-zinc-300 transition hover:text-white hover:underline">
          ← Back to Pricing
        </a>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Purchase History</h1>

        <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-[#161B26]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1e293b] text-zinc-200">
              <tr>
                <th className="px-5 py-4 font-semibold">Plan</th>
                <th className="px-5 py-4 font-semibold">Reference No</th>
                <th className="px-5 py-4 font-semibold">Amount</th>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="bg-[#131a24] px-5 py-20 text-center text-zinc-500">
                  No purchase records found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
