import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, EmptyState } from "@/components/eng-ui";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { exportSimulationPdf, exportSimulationXlsx } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: "Reports — EngineAI" }] }),
});

function Reports() {
  const { data } = useQuery({
    queryKey: ["sims-for-reports"],
    queryFn: async () =>
      (
        await supabase
          .from("simulations")
          .select("*, fuels(*), engines(*)")
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  const [busy, setBusy] = useState<{ id: string; kind: "pdf" | "xlsx" } | null>(null);

  async function handleExport(sim: any, kind: "pdf" | "xlsx") {
    setBusy({ id: sim.id, kind });
    try {
      const { data: res, error } = await supabase
        .from("simulation_results")
        .select("*")
        .eq("simulation_id", sim.id)
        .maybeSingle();
      if (error) throw error;
      if (!res) throw new Error("No results found for this simulation");
      if (kind === "pdf") exportSimulationPdf(sim, res);
      else exportSimulationXlsx(sim, res);
      toast.success("Report downloaded successfully");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate report");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Report Generator"
        description="Export PDF or Excel reports of any completed simulation."
      />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No simulations to report on" hint="Run a simulation first, then export it from here." />
      ) : (
        <Panel>
          {/* Desktop / tablet table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left py-2.5">Date</th>
                <th className="text-left">Fuel / Engine</th>
                <th className="text-left">RPM / Load</th>
                <th className="text-right">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data!.map((s: any) => {
                const pdfBusy = busy?.id === s.id && busy?.kind === "pdf";
                const xlsxBusy = busy?.id === s.id && busy?.kind === "xlsx";
                const anyBusy = busy?.id === s.id;
                return (
                  <tr key={s.id}>
                    <td className="py-3 text-muted-foreground num">{fmtDate(s.created_at)}</td>
                    <td className="py-3">
                      {s.fuels?.name} · {s.engines?.name}
                    </td>
                    <td className="py-3 num text-muted-foreground">
                      {s.rpm} · {s.load_pct}%
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border bg-panel mr-2"
                        disabled={anyBusy}
                        onClick={() => handleExport(s, "pdf")}
                      >
                        {pdfBusy ? (
                          <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Generating Report...</>
                        ) : (
                          <><FileText className="size-3.5 mr-1.5" /> PDF</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border bg-panel"
                        disabled={anyBusy}
                        onClick={() => handleExport(s, "xlsx")}
                      >
                        {xlsxBusy ? (
                          <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Generating Report...</>
                        ) : (
                          <><FileSpreadsheet className="size-3.5 mr-1.5" /> Excel</>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {data!.map((s: any) => {
              const pdfBusy = busy?.id === s.id && busy?.kind === "pdf";
              const xlsxBusy = busy?.id === s.id && busy?.kind === "xlsx";
              const anyBusy = busy?.id === s.id;
              return (
                <div key={s.id} className="panel p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm truncate">{s.fuels?.name} · {s.engines?.name}</p>
                    <p className="text-[11px] text-muted-foreground num mt-0.5">
                      {fmtDate(s.created_at)} · {s.rpm} RPM · {s.load_pct}%
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-border/40">
                    <Button size="sm" variant="outline" className="flex-1 border-border bg-panel" disabled={anyBusy} onClick={() => handleExport(s, "pdf")}>
                      {pdfBusy ? <><Loader2 className="size-3.5 mr-1 animate-spin" /></> : <><FileText className="size-3.5 mr-1" /> PDF</>}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 border-border bg-panel" disabled={anyBusy} onClick={() => handleExport(s, "xlsx")}>
                      {xlsxBusy ? <><Loader2 className="size-3.5 mr-1 animate-spin" /></> : <><FileSpreadsheet className="size-3.5 mr-1" /> Excel</>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
