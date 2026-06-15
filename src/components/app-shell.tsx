import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FlaskConical, Cpu, Database, GitCompareArrows,
  FileText, Bot, Settings, LogOut, Gauge, PlayCircle, Target, Menu, Bell, UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const nav = [
  { section: "Operations", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/simulation/new", label: "New Simulation", icon: PlayCircle },
    { to: "/fuels", label: "Fuel Library", icon: FlaskConical },
    { to: "/engines", label: "Engine Library", icon: Cpu },
    { to: "/datasets", label: "Dataset Manager", icon: Database },
  ]},
  { section: "Analysis", items: [
    { to: "/compare", label: "Fuel Comparison", icon: GitCompareArrows },
    { to: "/optimize", label: "Optimization", icon: Target },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/assistant", label: "AI Assistant", icon: Bot },
  ]},
];

function SidebarBody({ pathname, onSignOut, onNavigate }: { pathname: string; onSignOut: () => void; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-5 border-b border-border/60">
        <Link to={"/dashboard" as any} onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="size-6 rounded bg-brand grid place-items-center">
            <Gauge className="size-3.5 text-surface" strokeWidth={2.5} />
          </div>
          <span className="font-semibold tracking-tight uppercase text-xs">EngineAI v1.0</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {nav.map((sec) => (
          <div key={sec.section} className="space-y-0.5">
            <p className="label-eng px-3 mb-2">{sec.section}</p>
            {sec.items.map((it) => {
              const active = pathname === it.to || pathname.startsWith(it.to + "/");
              return (
                <Link
                  key={it.to}
                  to={it.to as any}
                  onClick={onNavigate}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors " +
                    (active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40")
                  }
                >
                  <it.icon className="size-4 shrink-0" />
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-border/60 space-y-0.5">
        <Link
          to={"/settings" as any}
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40"
        >
          <Settings className="size-4" /> Settings
        </Link>
        <button
          onClick={() => { onNavigate?.(); onSignOut(); }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string | null }>({
    name: "", email: "", avatar: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u || !active) return;
      const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>;
      setProfile({
        name: meta.full_name || meta.name || meta.display_name || (u.email?.split("@")[0] ?? "User"),
        email: u.email ?? "",
        avatar: meta.avatar_url || meta.picture || null,
      });
    };
    load();
    return () => { active = false; };
  }, [pathname]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" as any, replace: true });
  };

  const initials = (profile.name || profile.email || "U")
    .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const ProfileMenu = ({ size = "default" }: { size?: "default" | "sm" }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Open profile menu"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary/40 transition-colors"
        >
          <Avatar className={size === "sm" ? "size-7" : "size-8"}>
            {profile.avatar ? <AvatarImage src={profile.avatar} alt={profile.name} /> : null}
            <AvatarFallback className="text-xs bg-brand text-brand-foreground">{initials}</AvatarFallback>
          </Avatar>
          {size === "default" && (
            <span className="hidden sm:inline text-sm text-foreground max-w-[8rem] truncate">{profile.name}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium truncate">{profile.name}</span>
          <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" as any })}>
          <UserCircle className="size-4 mr-2" /> My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" as any })}>
          <Settings className="size-4 mr-2" /> Account Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4 mr-2" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen flex bg-surface text-foreground">
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex w-56 lg:w-60 shrink-0 border-r border-border bg-panel/30 flex-col">
        <SidebarBody pathname={pathname} onSignOut={signOut} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Desktop header — profile menu */}
        <header className="hidden md:flex items-center justify-end gap-2 px-6 py-3 border-b border-border bg-panel/30">
          <Button variant="ghost" size="icon" className="size-9" aria-label="Notifications">
            <Bell className="size-4" />
          </Button>
          <ProfileMenu />
        </header>
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-panel/40 sticky top-0 z-30 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-panel/95 border-border">
                <SidebarBody pathname={pathname} onSignOut={signOut} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <Link to={"/dashboard" as any} className="flex items-center gap-2 min-w-0">
              <div className="size-6 rounded bg-brand grid place-items-center shrink-0">
                <Gauge className="size-3.5 text-surface" strokeWidth={2.5} />
              </div>
              <span className="font-semibold tracking-tight uppercase text-xs truncate">EngineAI</span>
            </Link>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="size-9" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <ProfileMenu size="sm" />
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
