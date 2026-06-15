import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, PanelHeader, MetricTile } from "@/components/eng-ui";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";
import { BarChart3, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulation/$id")({
  component: SimResult,
  head: () => ({ meta: [{ title: "Simulation Results — EngineAI" }] }),
});

function SimResult() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["sim", id],
    queryFn: async () => {
      const sim = await supabase.from("simulations").select("*, fuels(*), engines(*)").eq("id", id).single();
      const res = await supabase.from("simulation_results").select("*").eq("simulation_id", id).single();
      return { sim: sim.data, res: res.data };
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading telemetry…</div>;
  if (!data?.sim || !data?.res) return <div className="p-8 text-muted-foreground">Simulation not found.</div>;
  const r = data.res; const s = data.sim; const conf = Number(r.confidence ?? 90);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow={`Batch ${id.slice(0, 8).toUpperCase()}`}
        title="Live Result Metrics"
        description={`${s.fuels?.name} on ${s.engines?.name} · ${s.rpm} RPM · ${s.load_pct}% load`}
        actions={
          <>
            <Button asChild variant="outline" className="border-border bg-panel"><Link to="/simulation/$id/analytics" params={{ id }}><BarChart3 className="size-4 mr-1.5" /> Analytics</Link></Button>
            <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90"><Link to="/reports"><FileText className="size-4 mr-1.5" /> Reports</Link></Button>
          </>
        }
      />

      <Panel>
        <PanelHeader title="Performance" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricTile label="Torque" value={fmt(r.torque, 1)} unit="Nm" confidence={conf} />
          <MetricTile label="Brake Power" value={fmt(r.brake_power, 2)} unit="kW" confidence={conf} />
          <MetricTile label="Indicated Power" value={fmt(r.indicated_power, 2)} unit="kW" confidence={conf} />
          <MetricTile label="Fuel Consumption" value={fmt(r.fuel_consumption, 3)} unit="kg/h" confidence={conf} />
          <MetricTile label="BSFC" value={fmt(r.bsfc, 1)} unit="g/kWh" confidence={conf} />
          <MetricTile label="Thermal Eff." value={fmt(r.thermal_efficiency, 2)} unit="%" confidence={conf} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Emissions" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricTile label="CO" value={fmt(r.co, 3)} unit="vol%" confidence={conf * 0.9} />
          <MetricTile label="CO₂" value={fmt(r.co2, 1)} unit="g/kWh" confidence={conf} />
          <MetricTile label="HC" value={fmt(r.hc, 1)} unit="ppm" confidence={conf * 0.85} />
          <MetricTile label="NOx" value={fmt(r.nox, 1)} unit="ppm" confidence={conf * 0.88} />
          <MetricTile label="Smoke" value={fmt(r.smoke, 3)} unit="FSN" confidence={conf * 0.8} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Efficiencies" />
        <div className="grid grid-cols-3 gap-3">
          <MetricTile label="Thermal" value={fmt(r.thermal_efficiency, 2)} unit="%" confidence={conf} />
          <MetricTile label="Mechanical" value={fmt(r.mechanical_efficiency, 2)} unit="%" confidence={conf} />
          <MetricTile label="Volumetric" value={fmt(r.volumetric_efficiency, 2)} unit="%" confidence={conf} />
        </div>
      </Panel>
    </div>
  );
}
