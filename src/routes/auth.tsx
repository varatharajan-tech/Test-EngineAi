import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Gauge, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — EngineAI" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const mapError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("incorrect"))
      return "Incorrect password.";
    if (m.includes("already registered") || m.includes("already exists") || m.includes("user already"))
      return "An account already exists with this email.";
    if (m.includes("password") && (m.includes("short") || m.includes("characters") || m.includes("weak")))
      return "Password must contain at least 8 characters.";
    if (m.includes("valid email") || m.includes("invalid email") || m.includes("email address"))
      return "Please enter a valid email address.";
    if (m.includes("network") || m.includes("fetch") || m.includes("connect"))
      return "Unable to connect. Please try again.";
    return msg;
  };

  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 8) {
        toast.error("Password must contain at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          // Fallback: auto sign-in if confirmation was required server-side
          const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signErr) throw signErr;
        }
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Authentication failed";
      toast.error(mapError(raw));
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        toast.error(mapError(result.error.message ?? "Google sign-in failed"));
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(mapError(err instanceof Error ? err.message : "Unable to connect. Please try again."));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 border-r border-border bg-panel/40 relative overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded bg-brand grid place-items-center">
            <Gauge className="size-4 text-surface" strokeWidth={2.5} />
          </div>
          <span className="text-foreground font-semibold tracking-tight uppercase text-xs">EngineAI v1.0</span>
        </div>
        <div className="space-y-6 max-w-md">
          <p className="label-eng text-brand">Instrumented Precision</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground leading-tight">
            Predict engine performance and emissions without firing a test cell.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Multi-fuel simulation, optimization, and analysis for mechanical engineers, fuel
            researchers, and automotive R&amp;D teams.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-6">
            {[
              { l: "Fuels", v: "10+" },
              { l: "Metrics", v: "16" },
              { l: "Charts", v: "8" },
            ].map((s) => (
              <div key={s.l} className="panel p-3">
                <p className="label-eng">{s.l}</p>
                <p className="num text-xl text-foreground mt-1">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">© EngineAI Research Platform</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <p className="label-eng">{mode === "signin" ? "Authenticate" : "Provision Account"}</p>
            <h2 className="text-2xl font-semibold mt-1">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Resume your simulation workspace." : "Spin up a fresh research workspace."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="label-eng">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password" className="label-eng">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="confirmPassword" className="label-eng">Confirm Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
              {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-surface px-2 text-muted-foreground">Or</span></div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={signInWithGoogle}
            disabled={googleLoading}
            className="w-full"
          >
            <svg className="size-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.5 2.4 12 2.4 6.7 2.4 2.5 6.7 2.5 12s4.2 9.6 9.5 9.6c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"/>
            </svg>
            {googleLoading ? "Connecting…" : "Continue with Google"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
          >
            {mode === "signin" ? "No account? Create one →" : "← Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
