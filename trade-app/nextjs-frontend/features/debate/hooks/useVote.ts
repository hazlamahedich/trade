"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  submitVote,
  getOrCreateVoterFingerprint,
  type VoteApiError,
  type DebateResultEnvelope,
} from "../api";
import { queryKeys } from "./queryKeys";
import { getStoredVote, setStoredVote, type VoteChoice } from "./storedVote";

export type { VoteChoice } from "./storedVote";
export type VoteStatus = "idle" | "voting" | "voted" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_VOTE: "Your vote is already counted!",
  RATE_LIMITED: "Slow down! Please wait a moment before voting again.",
  VOTING_DISABLED: "Voting is temporarily unavailable. Please try again shortly.",
  DEBATE_NOT_ACTIVE: "This debate is no longer accepting votes.",
  DEBATE_NOT_FOUND: "This debate could not be found.",
};

export function useVote(debateId: string) {
  const queryClient = useQueryClient();
  const voteStatusRef = useRef<VoteStatus>("idle");

  const [userVote, setUserVote] = useState<VoteChoice | null>(null);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredVote(debateId);
    if (stored) {
      setUserVote(stored.choice);
      setVoteStatus("voted");
    }
  }, [debateId]);

  voteStatusRef.current = voteStatus;

  const mutation = useMutation({
    mutationFn: (choice: VoteChoice) => {
      const fingerprint = getOrCreateVoterFingerprint();
      return submitVote({
        debateId,
        choice,
        voterFingerprint: fingerprint,
      });
    },

    onMutate: (choice: VoteChoice) => {
      setUserVote(choice);
      setVoteStatus("voting");
      setError(null);
    },

    onSuccess: (_data, choice) => {
      setStoredVote(debateId, choice);
      setVoteStatus("voted");

      queryClient.setQueryData<DebateResultEnvelope>(
        queryKeys.debateResult(debateId),
        (old) => {
          if (!old?.data) {
            return {
              data: {
                debateId,
                asset: "",
                status: "running",
                currentTurn: 0,
                maxTurns: 6,
                guardianVerdict: null,
                guardianInterruptsCount: 0,
                createdAt: new Date().toISOString(),
                completedAt: null,
                totalVotes: 1,
                voteBreakdown: { [choice]: 1 },
              },
              error: null,
              meta: {},
            };
          }
          return {
            ...old,
            data: {
              ...old.data,
              totalVotes: old.data.totalVotes + 1,
              voteBreakdown: {
                ...old.data.voteBreakdown,
                [choice]: (old.data.voteBreakdown[choice] ?? 0) + 1,
              },
            },
          };
        },
      );
    },

    onError: (err: unknown, choice: VoteChoice) => {
      const apiError = err as VoteApiError;
      const code = apiError?.code;

      if (code === "DUPLICATE_VOTE") {
        const existing = getStoredVote(debateId);
        const resolvedChoice = existing?.choice ?? choice;
        setStoredVote(debateId, resolvedChoice);
        setVoteStatus("voted");
        setUserVote(resolvedChoice);
        toast.info(ERROR_MESSAGES.DUPLICATE_VOTE);
        return;
      }

      if (code && code in ERROR_MESSAGES) {
        toast.error(ERROR_MESSAGES[code]);
      } else {
        toast.error("Connection lost. Your vote wasn't recorded. Please try again.");
      }

      setUserVote(null);
      setVoteStatus("error");
      setError(apiError?.message ?? "Vote failed");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debateResult(debateId) });
    },
  });

  const vote = useCallback(
    (choice: VoteChoice) => {
      const current = voteStatusRef.current;
      if (current === "voting" || current === "voted") return;
      mutation.mutate(choice);
    },
    [mutation],
  );

  return {
    vote,
    userVote,
    voteStatus,
    error,
  };
}
