import { Badge } from "@/components/ui/badge";
import { Archive } from "lucide-react";

interface ArchivedBadgeProps {
  winner?: string;
}

export function ArchivedBadge({ winner }: ArchivedBadgeProps) {
  const winnerText = winner
    ? ` — ${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins`
    : "";

  return (
    <Badge
      variant="outline"
      className="bg-slate-500/20 text-slate-400 border-slate-500/30 font-semibold gap-1.5"
      aria-label={`This debate has ended. Final verdict available.${winnerText}`}
    >
      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Completed Debate{winnerText}</span>
    </Badge>
  );
}
