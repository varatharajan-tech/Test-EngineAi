import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PageHeader, Panel } from "@/components/eng-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { Bot, Send, User, Copy, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  component: Assistant,
  head: () => ({ meta: [{ title: "AI Assistant — EngineAI" }] }),
});

const SAMPLES = [
  "Why is NOx high in lean-burn conditions?",
  "Suggest settings to reduce emissions without losing power",
  "Explain BSFC and what good values look like",
  "Analyze my current simulation results",
];

type SimContext = Record<string, unknown> | null;

function Assistant() {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pull most recent simulation + results to inject as context
  const { data: simContext } = useQuery<SimContext>({
    queryKey: ["assistant-active-sim"],
    queryFn: async () => {
      const { data: sim } = await supabase
        .from("simulations")
        .select("id, rpm, load_pct, fuels(name, fuel_type), engines(name, compression_ratio)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sim) return null;
      const { data: res } = await supabase
        .from("simulation_results")
        .select("*")
        .eq("simulation_id", sim.id)
        .maybeSingle();
      const fuel = (sim as any).fuels;
      const eng = (sim as any).engines;
      return {
        FuelType: fuel?.name ?? fuel?.fuel_type,
        EngineName: eng?.name,
        CompressionRatio: eng?.compression_ratio,
        RPM: sim.rpm,
        LoadPct: sim.load_pct,
        Torque_Nm: res?.torque,
        BrakePower_kW: res?.brake_power,
        FuelConsumption_kgph: res?.fuel_consumption,
        ThermalEfficiency_pct: res?.thermal_efficiency,
        CO_volpct: res?.co,
        CO2_gpkwh: res?.co2,
        HC_ppm: res?.hc,
        NOx_ppm: res?.nox,
      };
    },
  });

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const h: Record<string, string> = {};
          if (token) h.Authorization = `Bearer ${token}`;
          return h;
        },
      }),
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const send = async (text: string) => {
    if (!text.trim()) return;
    await sendMessage({ text }, { body: { simulation: simContext ?? null } });
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await send(text);
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-4xl mx-auto h-full min-h-[calc(100vh-3.5rem)] md:min-h-screen flex flex-col">
      <PageHeader
        eyebrow="AI Assistant"
        title="Engine Domain Expert"
        description="Powered by OpenAI · grounded on your latest simulation."
        actions={
          simContext ? (
            <Badge variant="outline" className="border-brand/40 text-brand">
              Context: {(simContext.FuelType as string) ?? "—"} · {String(simContext.RPM ?? "—")} RPM
            </Badge>
          ) : (
            <Badge variant="outline" className="border-border text-muted-foreground">No active simulation</Badge>
          )
        }
      />

      <Panel className="flex-1 flex flex-col min-h-[400px] sm:min-h-[500px]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="size-10 mx-auto text-brand mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Start a conversation</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {SAMPLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="panel p-3 text-left text-xs hover:bg-secondary/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const text = m.parts?.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={"flex gap-3 " + (isUser ? "justify-end" : "")}>
                  {!isUser && (
                    <div className="size-7 rounded bg-brand/10 grid place-items-center shrink-0">
                      <Bot className="size-3.5 text-brand" />
                    </div>
                  )}
                  <div className="max-w-[78%] group">
                    <div
                      className={
                        isUser
                          ? "bg-brand text-brand-foreground px-3 py-2 rounded-lg text-sm"
                          : "text-sm text-foreground prose prose-invert prose-sm max-w-none prose-table:text-xs prose-pre:bg-secondary"
                      }
                    >
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                    {!isUser && text && (
                      <button
                        onClick={() => copy(m.id, text)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-brand opacity-0 group-hover:opacity-100 transition"
                      >
                        {copiedId === m.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                        {copiedId === m.id ? "Copied" : "Copy response"}
                      </button>
                    )}
                  </div>
                  {isUser && (
                    <div className="size-7 rounded bg-secondary grid place-items-center shrink-0">
                      <User className="size-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {busy && (
            <div className="flex gap-3 pl-0">
              <div className="size-7 rounded bg-brand/10 grid place-items-center shrink-0">
                <Bot className="size-3.5 text-brand" />
              </div>
              <div className="flex items-center gap-1 text-xs text-brand">
                <span className="size-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="size-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="size-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                <span className="ml-2">Analyzing…</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 panel p-3 text-xs text-destructive border-destructive/40">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Request failed</div>
                <div className="opacity-80">{error.message || "The AI service is unavailable. Please try again."}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={submit} className="flex gap-2 pt-4 border-t border-border mt-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about engines, emissions, fuels…"
            disabled={busy}
            className="bg-panel border-border"
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </Panel>
    </div>
  );
}
