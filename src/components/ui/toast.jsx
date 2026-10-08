"use client";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const nextId = useRef(1);
    const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);
    const toast = useCallback(({ variant = "success", ...rest }) => {
        const id = nextId.current++;
        setItems((list) => [...list.slice(-3), { id, variant, ...rest }]);
        setTimeout(() => dismiss(id), variant === "error" ? 6000 : 3500);
    }, [dismiss]);
    const value = useMemo(() => ({ toast }), [toast]);
    return (<ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((t) => (<div key={t.id} role={t.variant === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 shadow-lg", t.variant === "error" ? "border-destructive/40" : "border-primary/30")}>
            {t.variant === "error" ? (<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive"/>) : (<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
            </div>
            <button aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4"/>
            </button>
          </div>))}
      </div>
    </ToastContext.Provider>);
}
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx)
        throw new Error("useToast must be used inside <ToastProvider>");
    return ctx.toast;
}
