import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_PROVIDER,
  ENGINE_SYSTEM_PROMPT,
  formatSimulationContext,
  getModel,
  type ProviderId,
} from "@/lib/ai/providers.server";

type ChatBody = {
  messages: UIMessage[];
  simulation?: Record<string, unknown> | null;
  provider?: ProviderId;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require an authenticated Supabase user before invoking paid AI models.
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const { messages, simulation, provider } = body;
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

        try {
          const model = getModel(provider ?? DEFAULT_PROVIDER);
          const system = `${ENGINE_SYSTEM_PROMPT}\n\n${formatSimulationContext(simulation)}`;

          const result = streamText({
            model,
            system,
            messages: await convertToModelMessages(messages),
          });

          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (err) {
          console.error("[/api/chat]", err);
          return new Response("AI request failed. Please try again.", { status: 500 });
        }
      },
    },
  },
});
