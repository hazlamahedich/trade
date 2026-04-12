"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDebateResult } from "../api";
import { queryKeys } from "./queryKeys";
import { getStoredChoice, type VoteChoice } from "./storedVote";

export const VOTE_POLL_INTERVAL_MS = 5000;

export interface UseVotingStatusOptions {
  wsConnected?: boolean;
}

export function useVotingStatus(debateId: string, options?: UseVotingStatusOptions) {
  const [localChoice, setLocalChoice] = useState<VoteChoice | null>(null);

  useEffect(() => {
    setLocalChoice(getStoredChoice(debateId));
  }, [debateId]);

  const hasVoted = localChoice !== null;
  const wsConnected = options?.wsConnected ?? false;
  const shouldPoll = hasVoted && !wsConnected;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.debateResult(debateId),
    queryFn: () => fetchDebateResult(debateId),
    enabled: !!debateId,
    refetchInterval: shouldPoll ? VOTE_POLL_INTERVAL_MS : false,
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
