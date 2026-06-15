import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/eng-ui";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/fuels")({
  component: Fuels,
  head: () => ({ meta: [{ title: "Fuel Library — EngineAI" }] }),
});

function Fuels() {
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["fuels"], queryFn: async () => (await supabase.from("fuels").select("*").order("name")).data ?? [] });
  const rows = (data ?? []).filter((f: any) => f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader eyebrow="Library" title="Fuel Library" description="Reference fuel properties used in simulations." />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fuels…" className="max-w-sm bg-panel border-border" />
      <Panel>
        {/* Desktop / tablet table */}
        <div className="hidden md:block overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                {["Name","Type","LHV (MJ/kg)","Density (kg/m³)","AFR","Octane","Cetane","Source"].map(h => <th key={h} className="text-left px-3 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((f: any) => (
                <tr key={f.id} className="hover:bg-secondary/30">
                  <td className="px-3 py-3 font-medium">{f.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{f.fuel_type}</td>
                  <td className="px-3 py-3 num">{Number(f.calorific_value).toFixed(1)}</td>
                  <td className="px-3 py-3 num">{Number(f.density).toFixed(1)}</td>
                  <td className="px-3 py-3 num">{Number(f.air_fuel_ratio).toFixed(1)}</td>
                  <td className="px-3 py-3 num">{f.octane_number ?? "—"}</td>
                  <td className="px-3 py-3 num">{f.cetane_number ?? "—"}</td>
                  <td className="px-3 py-3"><span className="label-eng">{f.is_preset ? "Preset" : "Custom"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {rows.map((f: any) => (
            <div key={f.id} className="panel p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.fuel_type}</p>
                </div>
                <span className="label-eng shrink-0">{f.is_preset ? "Preset" : "Custom"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] num pt-1 border-t border-border/40">
                <div><span className="text-muted-foreground">LHV </span>{Number(f.calorific_value).toFixed(1)}</div>
                <div><span className="text-muted-foreground">Density </span>{Number(f.density).toFixed(1)}</div>
                <div><span className="text-muted-foreground">AFR </span>{Number(f.air_fuel_ratio).toFixed(1)}</div>
                <div><span className="text-muted-foreground">Oct/Cet </span>{f.octane_number ?? "—"}/{f.cetane_number ?? "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
