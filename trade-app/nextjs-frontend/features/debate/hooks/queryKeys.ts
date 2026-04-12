export const queryKeys = {
  debateResult: (debateId: string) => ["debate", debateId, "result"] as const,
} as const;
