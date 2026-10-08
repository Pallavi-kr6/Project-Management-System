"use client";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
/**
 * Accessible modal built on the native <dialog> element: the browser provides
 * focus trapping, Esc-to-close, inert background and the backdrop. Content is
 * only rendered while open, so forms always start fresh.
 */
export function Dialog({ open, onClose, title, description, children, className, dismissible = true, }) {
    const ref = useRef(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog)
            return;
        if (open && !dialog.open)
            dialog.showModal();
        if (!open && dialog.open)
            dialog.close();
    }, [open]);
    return (<dialog ref={ref} aria-labelledby="dialog-title" onCancel={(e) => {
            e.preventDefault();
            if (dismissible)
                onClose();
        }} onMouseDown={(e) => {
            if (dismissible && e.target === ref.current)
                onClose();
        }} className={cn("w-[calc(100%-2rem)] max-w-lg rounded-lg border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50", className)}>
      {open && (<div className="max-h-[85vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 id="dialog-title" className="text-base font-semibold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            <button type="button" aria-label="Close dialog" onClick={onClose} disabled={!dismissible} className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50">
              <X className="h-4 w-4"/>
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>)}
    </dialog>);
}
