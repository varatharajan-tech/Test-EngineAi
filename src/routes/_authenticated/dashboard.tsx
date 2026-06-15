import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, PanelHeader, KpiTile, StatusPill } from "@/components/eng-ui";
import { Button } from "@/components/ui/button";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";
import { PlayCircle, GitCompareArrows, Database } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — EngineAI" }] }),
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [fuels, engines, sims, results] = await Promise.all([
        supabase.from("fuels").select("id", { count: "exact", head: true }),
        supabase.from("engines").select("id", { count: "exact", head: true }),
        supabase.from("simulations").select("id, rpm, status, created_at, fuels(name), engines(name)").order("created_at", { ascending: false }).limit(8),
        supabase.from("simulation_results").select("thermal_efficiency, brake_power, nox, co2"),
      ]);
      const r = results.data ?? [];
      const avg = (k: keyof (typeof r)[number]) => r.length ? r.reduce((a, x) => a + Number(x[k] ?? 0), 0) / r.length : 0;
      return {
        fuels: fuels.count ?? 0,
        engines: engines.count ?? 0,
        simCount: (sims.data?.length ?? 0),
        sims: sims.data ?? [],
        avgEff: avg("thermal_efficiency"),
        avgPower: avg("brake_power"),
        avgNox: avg("nox"),
        avgCo2: avg("co2"),
      };
    },
  });

  // Synthetic curve data when no sims yet (for demo)
  const rpmCurve = Array.from({ length: 11 }, (_, i) => {
    const rpm = 1000 + i * 500;
    return { rpm, torque: 380 - Math.pow((rpm - 3500) / 100, 2) * 0.8, power: (rpm / 60) * (380 - Math.pow((rpm - 3500) / 100, 2) * 0.8) * 2 * Math.PI / 1000 };
  });
  const emissionTrend = Array.from({ length: 12 }, (_, i) => ({
    t: `W${i + 1}`,
    nox: 180 + Math.sin(i / 2) * 40 + i * 2,
    co2: 220 - i * 4,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Control Room"
        title="Mission Dashboard"
        description="Telemetry and history across your simulation workspace."
        actions={
          <>
            <Button asChild variant="outline" className="border-border bg-panel"><Link to={"/compare" as any}><GitCompareArrows className="size-4 mr-1.5" /> Compare</Link></Button>
            <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90"><Link to={"/simulation/new" as any}><PlayCircle className="size-4 mr-1.5" /> New Simulation</Link></Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiTile label="Total Simulations" value={fmtInt(data?.simCount)} trend={data?.simCount ? "+ active" : "Run your first"} />
        <KpiTile label="Avg Thermal Eff." value={fmt(data?.avgEff, 2)} unit="%" />
        <KpiTile label="Mean Brake Power" value={fmt(data?.avgPower, 1)} unit="kW" />
        <KpiTile label="Avg NOx" value={fmt(data?.avgNox, 0)} unit="ppm" accent="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Performance Characteristics: RPM vs Torque/Power">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider"><i className="size-1.5 rounded-full bg-brand" /> Torque (Nm)</span>
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider"><i className="size-1.5 rounded-full bg-accent" /> Power (kW)</span>
            </div>
          </PanelHeader>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer>
              <LineChart data={rpmCurve} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="2 4" />
                <XAxis dataKey="rpm" stroke="#52525b" fontSize={10} />
                <YAxis stroke="#52525b" fontSize={10} />
                <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 12 }} />
                <Line type="monotone" dataKey="torque" stroke="#14b8a6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="power" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Emissions Trend" />
          <div className="h-56 sm:h-72">
            <ResponsiveContainer>
              <AreaChart data={emissionTrend} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="nox" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="2 4" />
                <XAxis dataKey="t" stroke="#52525b" fontSize={10} />
                <YAxis stroke="#52525b" fontSize={10} />
                <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 12 }} />
                <Area type="monotone" dataKey="nox" stroke="#f97316" fill="url(#nox)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Recent Simulations">
          <Button asChild size="sm" variant="ghost"><Link to={"/datasets" as any}><Database className="size-3.5 mr-1.5" /> Datasets</Link></Button>
        </PanelHeader>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left font-semibold px-5 py-2.5">Date</th>
                <th className="text-left font-semibold py-2.5">Fuel</th>
                <th className="text-left font-semibold py-2.5">Engine</th>
                <th className="text-right font-semibold py-2.5">RPM</th>
                <th className="text-right font-semibold px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(data?.sims ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No simulations yet. Run your first to populate this archive.</td></tr>
              ) : (
                data!.sims.map((s: any) => (
                  <tr key={s.id} className="hover:bg-secondary/30">
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(s.created_at)}</td>
                    <td className="py-3 text-foreground">{s.fuels?.name ?? "—"}</td>
                    <td className="py-3 text-muted-foreground">{s.engines?.name ?? "—"}</td>
                    <td className="py-3 text-right num">{s.rpm}</td>
                    <td className="px-5 py-3 text-right"><StatusPill status={s.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {(data?.sims ?? []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No simulations yet.</p>
          ) : (
            data!.sims.map((s: any) => (
              <div key={s.id} className="panel p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{s.fuels?.name ?? "—"}</span>
                  <StatusPill status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate">{s.engines?.name ?? "—"}</p>
                <div className="flex justify-between text-[11px] text-muted-foreground num pt-1">
                  <span>{fmtDate(s.created_at)}</span>
                  <span>{s.rpm} RPM</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
