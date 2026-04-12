export type VoteChoice = "bull" | "bear";

export interface StoredVote {
  choice: VoteChoice;
  timestamp: string;
}

export function getStoredVote(debateId: string): StoredVote | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`vote:${debateId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredVote;
  } catch {
    return null;
  }
}

export function getStoredChoice(debateId: string): VoteChoice | null {
  return getStoredVote(debateId)?.choice ?? null;
}

export function setStoredVote(debateId: string, choice: VoteChoice): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    `vote:${debateId}`,
    JSON.stringify({ choice, timestamp: new Date().toISOString() }),
  );
}
