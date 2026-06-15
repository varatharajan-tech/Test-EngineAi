// Server-only AI provider abstraction.
// Default: Lovable AI Gateway (no user key required). Swappable to other providers later.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type ProviderId = "lovable" | "openai";

export function getModel(providerId: ProviderId = "lovable"): LanguageModel {
  if (providerId === "lovable") {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });
    return gateway("google/gemini-3-flash-preview");
  }
  if (providerId === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Missing OPENAI_API_KEY");
    const gateway = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${key}` },
    });
    return gateway("gpt-4o-mini");
  }
  throw new Error(`Unknown provider: ${providerId}`);
}

export const DEFAULT_PROVIDER: ProviderId = "lovable";

export const ENGINE_SYSTEM_PROMPT = `You are an expert engine performance engineer. Analyze the provided engine simulation data and provide exact, technical engineering explanations regarding performance, fuel behavior, emissions (e.g., NOx, CO), efficiency, and specific optimization recommendations. Avoid generic chatbot fluff. Use markdown formatting with bold, lists, and tables where appropriate. Always include units (Nm, kW, g/kWh, ppm, %).`;

export function formatSimulationContext(ctx: Record<string, unknown> | null | undefined): string {
  if (!ctx) return "No active simulation selected. Answer the user's general engineering question.";
  const lines = Object.entries(ctx)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `- ${k}: ${typeof v === "number" ? v : String(v)}`);
  return `ACTIVE SIMULATION CONTEXT:\n${lines.join("\n")}`;
}
