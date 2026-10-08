"use client";
import { useState } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Delete", }) {
    const [busy, setBusy] = useState(false);
    async function handleConfirm() {
        setBusy(true);
        try {
            await onConfirm();
        }
        finally {
            setBusy(false); // never leave the button stuck in a loading state
        }
    }
    return (<Dialog open={open} onClose={onClose} title={title} description={description} dismissible={!busy}>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>);
}
