"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { cancelDocument } from "./actions";

export function CancelButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}><Ban className="h-4 w-4" /> Cancel document</Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} destructive confirmLabel="Cancel document"
        title="Cancel this document code?"
        description="The code stays on record with status Cancelled and is never reused. This cannot be undone."
        onConfirm={async () => {
          const r = await cancelDocument(id);
          if (r.ok) { toast.success("Document cancelled"); router.refresh(); } else toast.error(r.error);
        }} />
    </>
  );
}
