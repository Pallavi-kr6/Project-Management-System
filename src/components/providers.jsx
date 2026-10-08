"use client";
import { SWRConfig } from "swr";
import { swrConfig } from "@/hooks/use-api";
import { ToastProvider } from "@/components/ui/toast";
export function Providers({ children }) {
    return (<SWRConfig value={swrConfig}>
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>);
}
