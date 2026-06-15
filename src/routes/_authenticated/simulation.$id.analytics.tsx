import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, PanelHeader } from "@/components/eng-ui";
import { sweepRpm } from "@/lib/prediction/engine";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/simulation/$id/analytics")({
  component: Analytics,
  head: () => ({ meta: [{ title: "Analytics — EngineAI" }] }),
});

const CHARTS: Array<{ key: string; label: string; unit: string; color: string }> = [
  { key: "torque", label: "Torque", unit: "Nm", color: "#14b8a6" },
  { key: "brake_power", label: "Brake Power", unit: "kW", color: "#f97316" },
  { key: "fuel_consumption", label: "Fuel Consumption", unit: "kg/h", color: "#60a5fa" },
  { key: "thermal_efficiency", label: "Thermal Eff.", unit: "%", color: "#a78bfa" },
  { key: "bsfc", label: "BSFC", unit: "g/kWh", color: "#f472b6" },
  { key: "nox", label: "NOx", unit: "ppm", color: "#ef4444" },
  { key: "co", label: "CO", unit: "vol%", color: "#fb923c" },
  { key: "hc", label: "HC", unit: "ppm", color: "#fbbf24" },
];

function Analytics() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["sim-curve", id],
    queryFn: async () => {
      const sim = await supabase.from("simulations").select("*, fuels(*), engines(*)").eq("id", id).single();
      if (!sim.data) return null;
      return sweepRpm(
        { ...sim.data.fuels, carbon_fraction: sim.data.fuels.carbon_fraction ?? 0.86 },
        sim.data.engines,
        { rpm: sim.data.rpm, load_pct: sim.data.load_pct, ambient_temp: sim.data.ambient_temp, intake_temp: sim.data.intake_temp, intake_pressure: sim.data.intake_pressure },
      );
    },
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Computing RPM sweep…</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader eyebrow="Analytics" title="Engineering Charts" description="RPM sweep across the validated envelope." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CHARTS.map((c) => (
          <Panel key={c.key}>
            <PanelHeader title={`Engine Speed vs ${c.label}`}>
              <span className="label-eng">{c.unit}</span>
            </PanelHeader>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="2 4" />
                  <XAxis dataKey="rpm" stroke="#52525b" fontSize={10} />
                  <YAxis stroke="#52525b" fontSize={10} />
                  <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 12 }} />
                  <Line type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
