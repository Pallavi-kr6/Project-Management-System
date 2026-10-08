"use client";
import { Button } from "@/components/ui/button";
export default function GlobalError({ reset }) {
    return (<main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">An unexpected error occurred. You can try again, or reload the page.</p>
      <Button onClick={reset}>Try again</Button>
    </main>);
}
