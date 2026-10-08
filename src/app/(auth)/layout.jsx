import { FolderKanban } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
export default function AuthLayout({ children }) {
    return (<div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 font-semibold text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FolderKanban className="h-5 w-5"/>
          </span>
          Project Management System
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">Keep every project and task in one place.</h2>
          <p className="mt-4 text-sm leading-relaxed">
            Organise work into projects, break it into tasks, filter by status and priority, and watch progress update on your dashboard.
          </p>
        </div>
        <p className="text-xs">Your data is private to your account.</p>
      </section>
      <main className="relative flex items-center justify-center px-5 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>);
}
