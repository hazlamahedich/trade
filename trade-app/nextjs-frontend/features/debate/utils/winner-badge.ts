export type WinnerBadge = {
  label: string;
  icon: string;
  colorClass: string;
};

export function getWinnerBadge(winner: string): WinnerBadge {
  switch (winner.toLowerCase()) {
    case "bull":
      return {
        label: "Bull",
        icon: "▲",
        colorClass:
          "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      };
    case "bear":
      return {
        label: "Bear",
        icon: "▼",
        colorClass: "bg-rose-500/20 text-rose-400 border-rose-500/30",
      };
    case "undecided":
      return {
        label: "Undecided",
        icon: "?",
        colorClass:
          "bg-slate-500/20 text-slate-400 border-slate-500/30",
      };
    default:
      return {
        label: "Unknown",
        icon: "—",
        colorClass:
          "bg-slate-500/20 text-slate-400 border-slate-500/30",
      };
  }
}
