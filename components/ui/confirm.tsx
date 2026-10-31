"use client";

import * as React from "react";
import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";

/** Confirmation dialog for sensitive actions. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string;
  confirmLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} className="max-w-md">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(); } finally { setBusy(false); onOpenChange(false); }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
