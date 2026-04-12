"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDebateResult } from "../api";
import { queryKeys } from "./queryKeys";
import { getStoredChoice, type VoteChoice } from "./storedVote";

export function useVotingStatus(debateId: string) {
  const [localChoice, setLocalChoice] = useState<VoteChoice | null>(null);

  useEffect(() => {
    setLocalChoice(getStoredChoice(debateId));
  }, [debateId]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.debateResult(debateId),
    queryFn: () => fetchDebateResult(debateId),
    enabled: !!debateId,
  });

  const result = data?.data;
  const serverStatus = result?.status ?? null;
  const serverTotalVotes = result?.totalVotes ?? 0;
  const serverVoteCounts = result?.voteBreakdown ?? null;

  const hasVoted = localChoice !== null;
  const userChoice = localChoice;

  return {
    hasVoted,
    userChoice,
    voteCounts: serverVoteCounts,
    totalVotes: serverTotalVotes,
    serverStatus,
    isLoading,
  };
}
