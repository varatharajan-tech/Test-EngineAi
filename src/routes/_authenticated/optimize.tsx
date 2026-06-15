import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, PanelHeader } from "@/components/eng-ui";
import { Button } from "@/components/ui/button";
import { predict } from "@/lib/prediction/engine";

export const Route = createFileRoute("/_authenticated/optimize")({
  component: Optimize,
  head: () => ({ meta: [{ title: "Optimization — EngineAI" }] }),
});

const OBJ = [
  { id: "power", label: "Maximum Power" },
  { id: "eff", label: "Maximum Efficiency" },
  { id: "fuel", label: "Minimum Fuel Consumption" },
  { id: "emit", label: "Minimum Emissions" },
  { id: "balanced", label: "Balanced" },
] as const;

function Optimize() {
  const [obj, setObj] = useState<(typeof OBJ)[number]["id"]>("balanced");
  const [recommendation, setRecommendation] = useState<any>(null);
  const { data: fuels } = useQuery({ queryKey: ["fuels"], queryFn: async () => (await supabase.from("fuels").select("*").eq("is_preset", true)).data ?? [] });
  const { data: engines } = useQuery({ queryKey: ["engines-preset"], queryFn: async () => (await supabase.from("engines").select("*").eq("is_preset", true)).data ?? [] });

  const optimize = () => {
    if (!fuels || !engines) return;
    let best: any = null; let bestScore = -Infinity;
    for (const f of fuels) for (const e of engines) {
      for (const rpm of [1500, 2500, 3500, 4500]) for (const load of [50, 70, 90]) {
        const r = predict({ ...f, carbon_fraction: f.carbon_fraction ?? 0.86 }, e, { rpm, load_pct: load, ambient_temp: 25, intake_temp: 30, intake_pressure: 1.013 });
        const score =
          obj === "power" ? r.brake_power :
          obj === "eff" ? r.thermal_efficiency :
          obj === "fuel" ? -r.bsfc :
          obj === "emit" ? -(r.nox + r.co * 100 + r.hc) :
          r.thermal_efficiency * 0.5 + r.brake_power * 0.3 - r.nox * 0.05;
        if (score > bestScore) { bestScore = score; best = { fuel: f, engine: e, rpm, load, r, score }; }
      }
    }
    setRecommendation(best);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader eyebrow="Optimization" title="Configuration Optimizer" description="Search the operating envelope for the configuration that best meets your objective." />
      <Panel>
        <PanelHeader title="Objective" />
        <div className="flex flex-wrap gap-2">
          {OBJ.map(o => (
            <button key={o.id} onClick={() => setObj(o.id)} className={"px-3 py-1.5 rounded text-xs border " + (obj === o.id ? "border-brand bg-brand/10 text-brand" : "border-border bg-panel text-muted-foreground")}>
              {o.label}
            </button>
          ))}
        </div>
        <Button onClick={optimize} className="mt-6 bg-brand text-brand-foreground hover:bg-brand/90">Run Optimization</Button>
      </Panel>

      {recommendation && (
        <Panel>
          <PanelHeader title="Recommended Configuration" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="panel p-3"><p className="label-eng">Fuel</p><p className="mt-1 font-medium">{recommendation.fuel.name}</p></div>
            <div className="panel p-3"><p className="label-eng">Engine</p><p className="mt-1 font-medium">{recommendation.engine.name}</p></div>
            <div className="panel p-3"><p className="label-eng">RPM</p><p className="mt-1 num">{recommendation.rpm}</p></div>
            <div className="panel p-3"><p className="label-eng">Load</p><p className="mt-1 num">{recommendation.load}%</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
            <div className="panel p-3"><p className="label-eng">Brake Power</p><p className="num mt-1">{recommendation.r.brake_power} kW</p></div>
            <div className="panel p-3"><p className="label-eng">Thermal Eff.</p><p className="num mt-1">{recommendation.r.thermal_efficiency}%</p></div>
            <div className="panel p-3"><p className="label-eng">BSFC</p><p className="num mt-1">{recommendation.r.bsfc} g/kWh</p></div>
            <div className="panel p-3"><p className="label-eng">NOx</p><p className="num mt-1 text-accent">{recommendation.r.nox} ppm</p></div>
          </div>
          <p className="label-eng text-brand mt-4">Optimization Score: {recommendation.score.toFixed(2)}</p>
        </Panel>
      )}
    </div>
  );
}
