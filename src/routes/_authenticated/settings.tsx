import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/eng-ui";
import { MODELS } from "@/lib/prediction/models";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
  head: () => ({ meta: [{ title: "Settings — EngineAI" }] }),
});

function Settings() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader eyebrow="Settings" title="Workspace Preferences" />
      <Panel>
        <h3 className="text-sm font-semibold mb-3">Prediction Models</h3>
        <div className="space-y-2">
          {MODELS.map(m => (
            <div key={m.id} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
              <div>
                <p className="text-sm">{m.label}</p>
                <p className="label-eng mt-0.5">{m.id}</p>
              </div>
              <span className={"text-[10px] uppercase font-bold px-2 py-0.5 rounded ring-1 " + (m.status === "active" ? "text-brand bg-brand/10 ring-brand/30" : "text-muted-foreground bg-secondary ring-white/5")}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h3 className="text-sm font-semibold mb-3">About</h3>
        <p className="text-sm text-muted-foreground">EngineAI v1.0 · Heuristic physics predictor. Future ML modules (XGBoost, Random Forest, Neural Net) coming soon.</p>
      </Panel>
    </div>
  );
}
