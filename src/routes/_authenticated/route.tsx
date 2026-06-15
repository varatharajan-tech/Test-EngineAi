import { createFileRoute, Outlet, redirect, useHydrated } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <AuthenticatedShell />
  ),
});

function AuthenticatedShell() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
