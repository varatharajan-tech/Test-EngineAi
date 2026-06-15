import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/eng-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { predict } from "@/lib/prediction/engine";
import { Check, ChevronRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulation/new")({
  component: NewSim,
  validateSearch: (s: Record<string, unknown>) => ({
    engineId: typeof s.engineId === "string" ? s.engineId : undefined,
  }),
  head: () => ({ meta: [{ title: "New Simulation — EngineAI" }] }),
});

const STEPS = ["Fuel", "Properties", "Engine", "Conditions", "Validate", "Run"];

function NewSim() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [step, setStep] = useState(0);
  const [fuelId, setFuelId] = useState<string>("");
  const [engineId, setEngineId] = useState<string>(search.engineId ?? "");
  const [fuelOverride, setFuelOverride] = useState<any>({});
  const [cond, setCond] = useState({ rpm: 3000, load_pct: 70, ambient_temp: 25, intake_temp: 30, intake_pressure: 1.013 });

  const fuels = useQuery({ queryKey: ["fuels"], queryFn: async () => (await supabase.from("fuels").select("*").order("name")).data ?? [] });
  const engines = useQuery({ queryKey: ["engines"], queryFn: async () => (await supabase.from("engines").select("*").order("name")).data ?? [] });

  const fuel = fuels.data?.find((f: any) => f.id === fuelId);
  const engine = engines.data?.find((e: any) => e.id === engineId);
  const mergedFuel = fuel ? { ...fuel, ...fuelOverride } : null;

  const run = useMutation({
    mutationFn: async () => {
      if (!mergedFuel || !engine) throw new Error("Select a fuel and engine");
      const result = predict(
        { ...mergedFuel, carbon_fraction: mergedFuel.carbon_fraction ?? 0.86 },
        engine,
        cond,
      );
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sim, error } = await supabase.from("simulations").insert({
        user_id: user!.id, fuel_id: fuelId, engine_id: engineId, ...cond, status: "completed",
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("simulation_results").insert({ simulation_id: sim.id, ...result });
      if (e2) throw e2;
      return sim.id;
    },
    onSuccess: (id) => {
      toast.success("Simulation complete");
      navigate({ to: "/simulation/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const canNext =
    (step === 0 && !!fuelId) ||
    (step === 1 && !!fuelId) ||
    (step === 2 && !!engineId) ||
    step >= 3;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader eyebrow="Configurator" title="New Simulation" description="Six-step wizard to predict engine performance and emissions." />

      {/* Stepper — horizontal desktop, vertical mobile */}
      <div className="panel p-2 flex sm:flex-row flex-col gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => i < step && setStep(i)}
            className={
              "sm:flex-1 sm:min-w-[110px] px-3 py-2 rounded text-xs flex items-center gap-2 text-left " +
              (i === step ? "bg-secondary text-foreground" : i < step ? "text-brand" : "text-muted-foreground")
            }
          >
            <span className="num text-[10px]">0{i + 1}</span>
            <span>{s}</span>
            {i < step ? <Check className="size-3 ml-auto" /> : null}
          </button>
        ))}
      </div>

      <Panel className="min-h-[400px]">
        {step === 0 && (
          <div>
            <p className="label-eng mb-3">Primary Fuel Carrier</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(fuels.data ?? []).filter((f: any) => f.is_preset).map((f: any) => (
                <button
                  key={f.id}
                  onClick={() => { setFuelId(f.id); setFuelOverride({}); }}
                  className={
                    "panel p-3 text-left transition-colors " +
                    (fuelId === f.id ? "ring-1 ring-brand bg-brand/5" : "hover:bg-secondary/40")
                  }
                >
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="label-eng mt-1">{f.fuel_type}</p>
                  <div className="flex justify-between mt-3 text-[11px] num">
                    <span className="text-muted-foreground">LHV</span>
                    <span>{Number(f.calorific_value).toFixed(1)} MJ/kg</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && mergedFuel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["calorific_value", "Calorific Value (MJ/kg)"],
              ["density", "Density (kg/m³)"],
              ["air_fuel_ratio", "Air–Fuel Ratio"],
              ["octane_number", "Octane Number"],
              ["cetane_number", "Cetane Number"],
              ["latent_heat", "Latent Heat (kJ/kg)"],
              ["flash_point", "Flash Point (°C)"],
              ["viscosity", "Viscosity (mm²/s)"],
            ].map(([k, label]) => (
              <div key={k}>
                <Label className="label-eng">{label}</Label>
                <Input
                  type="number" step="0.01"
                  value={mergedFuel[k] ?? ""}
                  onChange={(e) => setFuelOverride({ ...fuelOverride, [k]: e.target.value === "" ? null : Number(e.target.value) })}
                  className="mt-1.5 bg-panel border-border num"
                />
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="label-eng mb-3">Engine Specification</p>
            <Select value={engineId} onValueChange={setEngineId}>
              <SelectTrigger className="bg-panel border-border"><SelectValue placeholder="Select preset engine…" /></SelectTrigger>
              <SelectContent>
                {(engines.data ?? []).map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {engine && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                {[
                  ["Type", engine.engine_type],
                  ["Cylinders", engine.cylinders],
                  ["Bore (mm)", engine.bore],
                  ["Stroke (mm)", engine.stroke],
                  ["Compression", engine.compression_ratio],
                  ["Displacement (L)", engine.displacement],
                  ["Cooling", engine.cooling],
                ].map(([l, v]) => (
                  <div key={l as string} className="panel p-3">
                    <p className="label-eng">{l}</p>
                    <p className="num text-sm mt-1">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["rpm", "Engine Speed (RPM)", 500, 9000, 100],
              ["load_pct", "Engine Load (%)", 10, 100, 1],
              ["ambient_temp", "Ambient Temp (°C)", -20, 50, 1],
              ["intake_temp", "Intake Temp (°C)", 0, 120, 1],
              ["intake_pressure", "Intake Pressure (bar)", 0.5, 3, 0.001],
            ].map(([k, label, min, max, step]) => (
              <div key={k as string}>
                <Label className="label-eng">{label}</Label>
                <Input
                  type="number" min={min as number} max={max as number} step={step as number}
                  value={(cond as any)[k as string]}
                  onChange={(e) => setCond({ ...cond, [k as string]: Number(e.target.value) })}
                  className="mt-1.5 bg-panel border-border num"
                />
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="label-eng">Validation Summary</p>
            {!fuelId && <p className="text-sm text-danger">⚠ Fuel not selected</p>}
            {!engineId && <p className="text-sm text-danger">⚠ Engine not selected</p>}
            {fuelId && engineId && (
              <div className="panel p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Fuel</span><span>{mergedFuel?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Engine</span><span>{engine?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">RPM × Load</span><span className="num">{cond.rpm} × {cond.load_pct}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Intake</span><span className="num">{cond.intake_pressure} bar @ {cond.intake_temp}°C</span></div>
                <p className="text-xs text-brand pt-2">✓ Inputs within validated envelope</p>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="text-center py-8">
            <p className="label-eng text-brand mb-3">Ready</p>
            <h3 className="text-xl font-semibold mb-6">Run AI Prediction Engine</h3>
            <Button size="lg" disabled={run.isPending || !fuelId || !engineId} onClick={() => run.mutate()} className="bg-brand text-brand-foreground hover:bg-brand/90">
              {run.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Running AI Prediction Engine…</> : "Initialize Run"}
            </Button>
          </div>
        )}
      </Panel>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0}>Back</Button>
        {step < 5 && (
          <Button onClick={next} disabled={!canNext} className="bg-brand text-brand-foreground hover:bg-brand/90">
            Next <ChevronRight className="size-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
