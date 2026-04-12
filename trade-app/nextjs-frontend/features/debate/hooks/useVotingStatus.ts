"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDebateResult } from "../api";
import { queryKeys } from "./queryKeys";
import { getStoredChoice, type VoteChoice } from "./storedVote";

export const VOTE_POLL_INTERVAL_MS = 5000;

export function useVotingStatus(debateId: string) {
  const [localChoice, setLocalChoice] = useState<VoteChoice | null>(null);

  useEffect(() => {
    setLocalChoice(getStoredChoice(debateId));
  }, [debateId]);

  const hasVoted = localChoice !== null;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.debateResult(debateId),
    queryFn: () => fetchDebateResult(debateId),
    enabled: !!debateId,
    refetchInterval: hasVoted ? VOTE_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const result = data?.data;
  const serverStatus = result?.status ?? null;
  const serverTotalVotes = result?.totalVotes ?? 0;
  const serverVoteCounts = result?.voteBreakdown ?? null;

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
