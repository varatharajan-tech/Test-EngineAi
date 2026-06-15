import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, EmptyState } from "@/components/eng-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Edit, Eye, Plus, Trash2, Play, Lock, Sparkles, Library } from "lucide-react";

export const Route = createFileRoute("/_authenticated/engines")({
  component: Engines,
  head: () => ({ meta: [{ title: "Engine Library — EngineAI" }] }),
});

type EngineRow = {
  id: string;
  user_id: string | null;
  is_preset: boolean;
  name: string;
  engine_type: string;
  cylinders: number;
  bore: number;
  stroke: number;
  compression_ratio: number;
  conn_rod_length: number | null;
  displacement: number | null;
  cooling: string;
  created_at: string;
  updated_at: string;
};

const ENGINE_TYPES = [
  "Spark Ignition (SI)",
  "Compression Ignition (CI)",
  "Turbocharged SI",
  "Turbocharged Diesel",
  "Hydrogen Engine",
  "Hybrid Engine",
];
const CYLINDER_OPTIONS = [1, 2, 3, 4, 6, 8, 12];
const COOLING_OPTIONS = ["Air Cooling", "Water Cooling", "Oil Cooling", "Liquid Cooling"];

const DEFAULT_FORM = {
  name: "",
  engine_type: "Spark Ignition (SI)",
  cylinders: 4,
  bore: 83,
  stroke: 92,
  compression_ratio: 10.5,
  cooling: "Water Cooling",
};
type FormState = typeof DEFAULT_FORM;

function calcDisplacement(bore: number, stroke: number, cylinders: number) {
  // L = (π/4 * Bore² * Stroke * Cylinders) / 1,000,000  (bore, stroke in mm)
  const v = (Math.PI / 4) * bore * bore * stroke * cylinders / 1_000_000;
  return Math.round(v * 1000) / 1000;
}

// Coerce legacy short codes (SI/CI/water) to readable labels in the UI form.
function normalizeEngineType(t: string): string {
  if (ENGINE_TYPES.includes(t)) return t;
  if (t === "SI") return "Spark Ignition (SI)";
  if (t === "CI") return "Compression Ignition (CI)";
  return t || "Spark Ignition (SI)";
}
function normalizeCooling(c: string): string {
  if (COOLING_OPTIONS.includes(c)) return c;
  const map: Record<string, string> = {
    air: "Air Cooling", water: "Water Cooling", oil: "Oil Cooling", liquid: "Liquid Cooling",
  };
  return map[c?.toLowerCase()] ?? "Water Cooling";
}

function Engines() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"library" | "custom">("library");
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<EngineRow | null>(null);
  const [deleting, setDeleting] = useState<EngineRow | null>(null);

  const { data: engines = [], isLoading } = useQuery<EngineRow[]>({
    queryKey: ["engines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("engines").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as EngineRow[];
    },
  });

  const builtIn = useMemo(() => engines.filter((e) => e.is_preset), [engines]);
  const custom = useMemo(() => engines.filter((e) => !e.is_preset), [engines]);

  const selected = engines.find((e) => e.id === selectedId);

  // Auto-calc displacement
  const displacement = useMemo(
    () => calcDisplacement(Number(form.bore) || 0, Number(form.stroke) || 0, Number(form.cylinders) || 0),
    [form.bore, form.stroke, form.cylinders],
  );

  // When switching to custom mode without an active edit, reset form
  useEffect(() => {
    if (mode === "library") {
      setEditingId(null);
    }
  }, [mode]);

  const upsert = useMutation({
    mutationFn: async (payload: { id?: string; form: FormState; sourceIsPreset?: boolean; cloneFromName?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const f = payload.form;

      // Validation
      if (!f.name.trim()) throw new Error("Engine name is required");
      if (f.bore < 50 || f.bore > 150) throw new Error("Bore must be between 50 and 150 mm");
      if (f.stroke < 50 || f.stroke > 200) throw new Error("Stroke must be between 50 and 200 mm");
      if (f.compression_ratio < 8 || f.compression_ratio > 25) throw new Error("Compression ratio must be between 8 and 25");

      const row = {
        user_id: user.id,
        is_preset: false,
        name: payload.cloneFromName ?? f.name.trim(),
        engine_type: f.engine_type,
        cylinders: f.cylinders,
        bore: f.bore,
        stroke: f.stroke,
        compression_ratio: f.compression_ratio,
        cooling: f.cooling,
        displacement: calcDisplacement(f.bore, f.stroke, f.cylinders),
      };

      if (payload.id && !payload.sourceIsPreset) {
        const { error } = await supabase.from("engines").update(row).eq("id", payload.id);
        if (error) throw error;
        return { mode: "updated" as const };
      }
      const { error } = await supabase.from("engines").insert(row);
      if (error) throw error;
      return { mode: payload.sourceIsPreset ? ("cloned" as const) : ("created" as const) };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["engines"] });
      toast.success(
        res.mode === "updated" ? "Custom engine updated" :
        res.mode === "cloned" ? "Cloned to Custom Engines" :
        "Custom engine saved",
      );
      setForm(DEFAULT_FORM);
      setEditingId(null);
      setMode("library");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("engines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engines"] });
      toast.success("Custom engine deleted");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed (engine may be in use)"),
  });

  const loadIntoForm = (e: EngineRow) => {
    setForm({
      name: e.name,
      engine_type: normalizeEngineType(e.engine_type),
      cylinders: e.cylinders,
      bore: Number(e.bore),
      stroke: Number(e.stroke),
      compression_ratio: Number(e.compression_ratio),
      cooling: normalizeCooling(e.cooling),
    });
  };

  const handleEdit = (e: EngineRow) => {
    loadIntoForm(e);
    if (e.is_preset) {
      // Clone-on-edit pattern
      setEditingId(null);
      setForm((prev) => ({ ...prev, name: `${e.name} - Custom V1` }));
      setMode("custom");
      toast.info("Editing a built-in engine creates a custom copy on save.");
    } else {
      setEditingId(e.id);
      setMode("custom");
    }
  };

  const handleUseInSim = (id: string) => {
    navigate({ to: "/simulation/new", search: { engineId: id } as any });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Engine Library"
        description="Browse built-in engines, create custom specifications, and launch simulations."
        actions={
          <div className="panel p-1 flex gap-1 w-full sm:w-auto">
            <Button
              size="sm"
              variant={mode === "library" ? "default" : "ghost"}
              onClick={() => setMode("library")}
              className={"flex-1 sm:flex-none " + (mode === "library" ? "bg-brand text-brand-foreground hover:bg-brand/90" : "")}
            >
              <Library className="size-4" /> <span className="hidden sm:inline">Use Engine </span>Library
            </Button>
            <Button
              size="sm"
              variant={mode === "custom" ? "default" : "ghost"}
              onClick={() => { setEditingId(null); setForm(DEFAULT_FORM); setMode("custom"); }}
              className={"flex-1 sm:flex-none " + (mode === "custom" ? "bg-brand text-brand-foreground hover:bg-brand/90" : "")}
            >
              <Plus className="size-4" /> <span className="hidden sm:inline">Create </span>Custom
            </Button>
          </div>
        }
      />

      {mode === "library" ? (
        <Panel>
          <p className="label-eng mb-3">Select an engine (read-only preview)</p>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="bg-panel border-border max-w-md">
              <SelectValue placeholder="Select engine…" />
            </SelectTrigger>
            <SelectContent>
              {engines.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.is_preset ? "🔒 " : "★ "}{e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Engine Name", selected.name],
                ["Type", normalizeEngineType(selected.engine_type)],
                ["Cylinders", selected.cylinders],
                ["Bore (mm)", Number(selected.bore).toFixed(1)],
                ["Stroke (mm)", Number(selected.stroke).toFixed(1)],
                ["Compression Ratio", Number(selected.compression_ratio).toFixed(2)],
                ["Cooling", normalizeCooling(selected.cooling)],
                ["Displacement (L)", (selected.displacement ?? calcDisplacement(+selected.bore, +selected.stroke, selected.cylinders)).toString()],
              ].map(([l, v]) => (
                <div key={l as string} className="panel p-3">
                  <p className="label-eng">{l}</p>
                  <p className="num text-sm mt-1 flex items-center gap-1.5">
                    {selected.is_preset && l === "Engine Name" ? <Lock className="size-3 text-muted-foreground" /> : null}
                    {v}
                  </p>
                </div>
              ))}
              <div className="sm:col-span-2 md:col-span-4 flex flex-col sm:flex-row gap-2 pt-2">
                <Button onClick={() => handleUseInSim(selected.id)} className="bg-brand text-brand-foreground hover:bg-brand/90">
                  <Play className="size-4" /> Use in Simulation
                </Button>
                <Button variant="outline" onClick={() => handleEdit(selected)}>
                  <Edit className="size-4" /> {selected.is_preset ? "Clone & Edit" : "Edit"}
                </Button>
              </div>
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="label-eng text-brand">{editingId ? "Editing Custom Engine" : "Create Custom Engine"}</p>
              <h3 className="text-sm font-semibold mt-1">All fields editable · Displacement auto-calculated</h3>
            </div>
            <Sparkles className="size-4 text-brand" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="label-eng">Engine Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Custom 2.5L Turbo"
                className="mt-1.5 bg-panel border-border"
              />
            </div>

            <div>
              <Label className="label-eng">Engine Type</Label>
              <Select value={form.engine_type} onValueChange={(v) => setForm({ ...form, engine_type: v })}>
                <SelectTrigger className="mt-1.5 bg-panel border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENGINE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="label-eng">Cylinders</Label>
              <Select value={String(form.cylinders)} onValueChange={(v) => setForm({ ...form, cylinders: Number(v) })}>
                <SelectTrigger className="mt-1.5 bg-panel border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYLINDER_OPTIONS.map((c) => <SelectItem key={c} value={String(c)}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="label-eng">Cooling Method</Label>
              <Select value={form.cooling} onValueChange={(v) => setForm({ ...form, cooling: v })}>
                <SelectTrigger className="mt-1.5 bg-panel border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COOLING_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="label-eng">Bore Diameter (mm) · 50–150</Label>
              <Input
                type="number" min={50} max={150} step={0.1}
                value={form.bore}
                onChange={(e) => setForm({ ...form, bore: Number(e.target.value) })}
                className="mt-1.5 bg-panel border-border num"
              />
            </div>

            <div>
              <Label className="label-eng">Stroke Length (mm) · 50–200</Label>
              <Input
                type="number" min={50} max={200} step={0.1}
                value={form.stroke}
                onChange={(e) => setForm({ ...form, stroke: Number(e.target.value) })}
                className="mt-1.5 bg-panel border-border num"
              />
            </div>

            <div>
              <Label className="label-eng">Compression Ratio · 8–25</Label>
              <Input
                type="number" min={8} max={25} step={0.1}
                value={form.compression_ratio}
                onChange={(e) => setForm({ ...form, compression_ratio: Number(e.target.value) })}
                className="mt-1.5 bg-panel border-border num"
              />
            </div>

            <div>
              <Label className="label-eng flex items-center gap-1.5"><Lock className="size-3" /> Displacement (L) · auto</Label>
              <Input
                value={displacement}
                disabled
                readOnly
                className="mt-1.5 bg-secondary/40 border-border num text-brand"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={() => upsert.mutate({ id: editingId ?? undefined, form })}
              disabled={upsert.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {editingId ? "Update Engine" : "Save Custom Engine"}
            </Button>
            <Button variant="ghost" onClick={() => { setForm(DEFAULT_FORM); setEditingId(null); setMode("library"); }}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {/* Built-In Engines */}
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="label-eng">System Presets</p>
            <h2 className="text-sm font-semibold mt-0.5">Built-In Engines <span className="text-muted-foreground font-normal">({builtIn.length})</span></h2>
          </div>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="size-3" /> Read-only</span>
        </div>
        {/* Desktop / tablet table */}
        <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Cyl</TableHead>
              <TableHead className="text-right">Bore</TableHead>
              <TableHead className="text-right">Stroke</TableHead>
              <TableHead className="text-right">CR</TableHead>
              <TableHead className="text-right">Disp. (L)</TableHead>
              <TableHead>Cooling</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {builtIn.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell className="text-xs">{normalizeEngineType(e.engine_type)}</TableCell>
                <TableCell className="text-right num">{e.cylinders}</TableCell>
                <TableCell className="text-right num">{Number(e.bore).toFixed(1)}</TableCell>
                <TableCell className="text-right num">{Number(e.stroke).toFixed(1)}</TableCell>
                <TableCell className="text-right num">{Number(e.compression_ratio).toFixed(1)}</TableCell>
                <TableCell className="text-right num">{e.displacement ?? "—"}</TableCell>
                <TableCell className="text-xs">{normalizeCooling(e.cooling)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(e)} title="View"><Eye className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(e)} title="Clone & Edit"><Edit className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleUseInSim(e.id)} title="Use in Simulation"><Play className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {builtIn.map((e) => (
            <div key={e.id} className="panel p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{normalizeEngineType(e.engine_type)}</p>
                </div>
                <Lock className="size-3 text-muted-foreground shrink-0 mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] num pt-1 border-t border-border/40">
                <div><span className="text-muted-foreground">Disp </span>{e.displacement ?? "—"} L</div>
                <div><span className="text-muted-foreground">CR </span>{Number(e.compression_ratio).toFixed(1)}</div>
                <div><span className="text-muted-foreground">Cyl </span>{e.cylinders}</div>
              </div>
              <div className="flex gap-1 pt-1">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => setViewing(e)}><Eye className="size-3.5 mr-1" /> View</Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleEdit(e)}><Edit className="size-3.5 mr-1" /> Edit</Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleUseInSim(e.id)}><Play className="size-3.5 mr-1" /> Use</Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Custom Engines */}
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="label-eng">User Saved</p>
            <h2 className="text-sm font-semibold mt-0.5">Custom Engines <span className="text-muted-foreground font-normal">({custom.length})</span></h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm(DEFAULT_FORM); setMode("custom"); }}>
            <Plus className="size-4" /> New
          </Button>
        </div>
        {custom.length === 0 ? (
          <EmptyState
            title="No custom engines yet"
            hint="Switch to Create Custom Engine to build your first specification."
          />
        ) : (
          <>
          {/* Desktop / tablet table */}
          <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Cyl</TableHead>
                <TableHead className="text-right">Bore</TableHead>
                <TableHead className="text-right">Stroke</TableHead>
                <TableHead className="text-right">CR</TableHead>
                <TableHead className="text-right">Disp. (L)</TableHead>
                <TableHead>Cooling</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custom.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-xs">{normalizeEngineType(e.engine_type)}</TableCell>
                  <TableCell className="text-right num">{e.cylinders}</TableCell>
                  <TableCell className="text-right num">{Number(e.bore).toFixed(1)}</TableCell>
                  <TableCell className="text-right num">{Number(e.stroke).toFixed(1)}</TableCell>
                  <TableCell className="text-right num">{Number(e.compression_ratio).toFixed(1)}</TableCell>
                  <TableCell className="text-right num">{e.displacement ?? "—"}</TableCell>
                  <TableCell className="text-xs">{normalizeCooling(e.cooling)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(e)} title="View"><Eye className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(e)} title="Edit"><Edit className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleUseInSim(e.id)} title="Use in Simulation"><Play className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(e)} title="Delete"><Trash2 className="size-4 text-danger" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {custom.map((e) => (
              <div key={e.id} className="panel p-3 space-y-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{normalizeEngineType(e.engine_type)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] num pt-1 border-t border-border/40">
                  <div><span className="text-muted-foreground">Disp </span>{e.displacement ?? "—"} L</div>
                  <div><span className="text-muted-foreground">CR </span>{Number(e.compression_ratio).toFixed(1)}</div>
                  <div><span className="text-muted-foreground">Cyl </span>{e.cylinders}</div>
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setViewing(e)}><Eye className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleEdit(e)}><Edit className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleUseInSim(e.id)}><Play className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(e)}><Trash2 className="size-3.5 text-danger" /></Button>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </Panel>

      {isLoading && <p className="text-center text-muted-foreground text-sm">Loading engines…</p>}

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              {viewing?.is_preset ? "Built-in system engine · Read-only" : "Custom engine"}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Type", normalizeEngineType(viewing.engine_type)],
                ["Cylinders", viewing.cylinders],
                ["Bore (mm)", Number(viewing.bore).toFixed(1)],
                ["Stroke (mm)", Number(viewing.stroke).toFixed(1)],
                ["Compression Ratio", Number(viewing.compression_ratio).toFixed(2)],
                ["Cooling", normalizeCooling(viewing.cooling)],
                ["Displacement (L)", viewing.displacement ?? calcDisplacement(+viewing.bore, +viewing.stroke, viewing.cylinders)],
                ["Created", new Date(viewing.created_at).toLocaleDateString()],
              ].map(([l, v]) => (
                <div key={l as string} className="panel p-3">
                  <p className="label-eng">{l}</p>
                  <p className="num text-sm mt-1">{v as any}</p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            {viewing && (
              <Button onClick={() => { handleUseInSim(viewing.id); setViewing(null); }} className="bg-brand text-brand-foreground hover:bg-brand/90">
                <Play className="size-4" /> Use in Simulation
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom engine?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be permanently removed. Engines referenced by existing simulations cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && del.mutate(deleting.id)}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
