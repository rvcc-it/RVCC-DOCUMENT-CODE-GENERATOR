import { cn } from "@/lib/utils";

const tones = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  grey: "bg-slate-100 text-slate-700",
};

export function Badge({ tone = "grey", className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "active" ? "green" : status === "revised" ? "amber" : status === "cancelled" ? "red" : "grey";
  return <Badge tone={tone} className="capitalize">{status}</Badge>;
}
