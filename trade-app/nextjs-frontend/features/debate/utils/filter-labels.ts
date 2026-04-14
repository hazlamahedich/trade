export function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case "bull":
      return "Bull Wins";
    case "bear":
      return "Bear Wins";
    case "undecided":
      return "Undecided";
    default:
      return outcome;
  }
}
