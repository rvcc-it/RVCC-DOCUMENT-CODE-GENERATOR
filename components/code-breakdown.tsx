import type { CodePart } from "@/lib/numbering";

export function CodeBreakdown({ parts }: { parts: CodePart[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {parts.map((p) => (
        <div key={p.label} className="min-w-[72px] rounded-lg border bg-white px-3 py-2 text-center">
          <p className="font-mono text-base font-bold text-primary">[{p.value}]</p>
          <p className="text-[11px] text-muted-foreground">({p.label})</p>
        </div>
      ))}
    </div>
  );
}
