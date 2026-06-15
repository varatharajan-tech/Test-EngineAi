import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, PanelHeader } from "@/components/eng-ui";
import { predict } from "@/lib/prediction/engine";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/compare")({
  component: Compare,
  head: () => ({ meta: [{ title: "Fuel Comparison — EngineAI" }] }),
});

function Compare() {
  const [selected, setSelected] = useState<string[]>([]);
  const { data: fuels } = useQuery({ queryKey: ["fuels"], queryFn: async () => (await supabase.from("fuels").select("*").eq("is_preset", true).order("name")).data ?? [] });
  const { data: engines } = useQuery({ queryKey: ["engines-preset"], queryFn: async () => (await supabase.from("engines").select("*").eq("is_preset", true).limit(1)).data ?? [] });

  const engine = engines?.[0];
  const cond = { rpm: 3000, load_pct: 70, ambient_temp: 25, intake_temp: 30, intake_pressure: 1.013 };
  const results = (fuels ?? []).filter((f: any) => selected.includes(f.id)).map((f: any) => ({
    fuel: f, r: engine ? predict({ ...f, carbon_fraction: f.carbon_fraction ?? 0.86 }, engine, cond) : null,
  }));

  const radarData = ["torque", "brake_power", "thermal_efficiency"].map(k => {
    const obj: any = { metric: k.replace("_", " ") };
    results.forEach(({ fuel, r }) => { if (r) obj[fuel.name] = (r as any)[k]; });
    return obj;
  });

  const ranking = results.length ? {
    power: results.slice().sort((a, b) => (b.r?.brake_power ?? 0) - (a.r?.brake_power ?? 0))[0],
    eco:   results.slice().sort((a, b) => (a.r?.bsfc ?? 9e9) - (b.r?.bsfc ?? 9e9))[0],
    emit:  results.slice().sort((a, b) => (a.r?.nox ?? 9e9) - (b.r?.nox ?? 9e9))[0],
  } : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader eyebrow="Comparison" title="Fuel Comparison" description="Select multiple fuels to benchmark on a reference engine at 3000 RPM / 70% load." />

      <Panel>
        <PanelHeader title="Select Fuels (multi-select)" />
        <div className="flex flex-wrap gap-2">
          {(fuels ?? []).map((f: any) => {
            const on = selected.includes(f.id);
            return (
              <button key={f.id} onClick={() => setSelected(on ? selected.filter(x => x !== f.id) : [...selected, f.id])}
                className={"px-3 py-1.5 rounded text-xs border " + (on ? "border-brand bg-brand/10 text-brand" : "border-border bg-panel text-muted-foreground hover:text-foreground")}>
                {f.name}
              </button>
            );
          })}
        </div>
      </Panel>

      {ranking && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Panel><p className="label-eng text-brand">Best Performance</p><h3 className="text-lg font-semibold mt-1">{ranking.power.fuel.name}</h3><p className="num text-sm mt-1">{ranking.power.r?.brake_power} kW</p></Panel>
          <Panel><p className="label-eng text-brand">Best Economy</p><h3 className="text-lg font-semibold mt-1">{ranking.eco.fuel.name}</h3><p className="num text-sm mt-1">{ranking.eco.r?.bsfc} g/kWh</p></Panel>
          <Panel><p className="label-eng text-brand">Lowest Emissions</p><h3 className="text-lg font-semibold mt-1">{ranking.emit.fuel.name}</h3><p className="num text-sm mt-1">{ranking.emit.r?.nox} ppm NOx</p></Panel>
        </div>
      )}

      {results.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel>
            <PanelHeader title="Radar Comparison" />
            <div className="h-56 sm:h-72">
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#27272a" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                  {results.map((r, i) => (
                    <Radar key={r.fuel.id} name={r.fuel.name} dataKey={r.fuel.name} stroke={["#14b8a6","#f97316","#60a5fa","#a78bfa","#f472b6"][i % 5]} fill={["#14b8a6","#f97316","#60a5fa","#a78bfa","#f472b6"][i % 5]} fillOpacity={0.2} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="NOx Emissions (ppm)" />
            <div className="h-56 sm:h-72">
              <ResponsiveContainer>
                <BarChart data={results.map(r => ({ name: r.fuel.name, nox: r.r?.nox ?? 0 }))}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="2 4" />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} />
                  <YAxis stroke="#52525b" fontSize={10} />
                  <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 12 }} />
                  <Bar dataKey="nox" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      )}

      {results.length > 0 && (
        <Panel>
          <PanelHeader title="Comparison Table" />
          {/* Desktop / tablet */}
          <div className="hidden md:block overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  {["Fuel","Torque","Power","Eff.","BSFC","CO","HC","NOx"].map(h => <th key={h} className="text-left px-3 py-2.5">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {results.map(({ fuel, r }) => (
                  <tr key={fuel.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-3 font-medium">{fuel.name}</td>
                    <td className="px-3 py-3 num">{r?.torque} Nm</td>
                    <td className="px-3 py-3 num">{r?.brake_power} kW</td>
                    <td className="px-3 py-3 num">{r?.thermal_efficiency}%</td>
                    <td className="px-3 py-3 num">{r?.bsfc}</td>
                    <td className="px-3 py-3 num">{r?.co}</td>
                    <td className="px-3 py-3 num">{r?.hc}</td>
                    <td className="px-3 py-3 num">{r?.nox}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {results.map(({ fuel, r }) => (
              <div key={fuel.id} className="panel p-3 space-y-2">
                <p className="font-medium text-sm">{fuel.name}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] num pt-1 border-t border-border/40">
                  <div><span className="text-muted-foreground">Torque </span>{r?.torque} Nm</div>
                  <div><span className="text-muted-foreground">Power </span>{r?.brake_power} kW</div>
                  <div><span className="text-muted-foreground">Eff. </span>{r?.thermal_efficiency}%</div>
                  <div><span className="text-muted-foreground">BSFC </span>{r?.bsfc}</div>
                  <div><span className="text-muted-foreground">CO </span>{r?.co}</div>
                  <div><span className="text-muted-foreground">HC </span>{r?.hc}</div>
                  <div><span className="text-muted-foreground">NOx </span>{r?.nox}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
