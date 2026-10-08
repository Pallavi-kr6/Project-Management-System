"use client";
import { FolderKanban, LayoutDashboard, ListChecks, LogOut, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-api";
import { useLogout } from "@/hooks/use-logout";
import { cn, initials } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
const NAV = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/profile", label: "Profile", icon: UserRound },
];
export function AppShell({ children }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const { data: user } = useCurrentUser();
    const { logout, loading } = useLogout();
    useEffect(() => setOpen(false), [pathname]);
    return (<div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden/>}

      <aside id="sidebar" className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200", "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full max-lg:invisible")}>
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FolderKanban className="h-4 w-4"/>
            </span>
            Project Manager
          </Link>
          <button className="rounded-md p-1 hover:bg-sidebar-accent lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X className="h-5 w-5"/>
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (<Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/60 hover:text-white")}>
                <Icon className="h-4 w-4"/>
                {label}
              </Link>);
        })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {user ? initials(user.fullName || user.email) : "…"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.fullName || "Loading…"}</p>
              <p className="truncate text-xs">{user?.email ?? ""}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation" aria-controls="sidebar" aria-expanded={open}>
            <Menu className="h-5 w-5"/>
          </Button>
          <p className="hidden text-sm text-muted-foreground lg:block">
            {user ? <>Signed in as <span className="font-medium text-foreground">{user.fullName || user.email}</span></> : ""}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout} loading={loading}>
              <LogOut className="h-4 w-4"/>
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>);
}
