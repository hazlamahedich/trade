"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export function useFirstVoter(totalVotes: number, debateId: string, hasVoted: boolean): boolean {
  const storageKey = useMemo(() => `first-voter-${debateId}`, [debateId]);

  const [isFirstVoter, setIsFirstVoter] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(storageKey) === "true";
  });

  const prevTotalRef = useRef(totalVotes);

  useEffect(() => {
    if (
      hasVoted &&
      prevTotalRef.current === 0 &&
      totalVotes === 1 &&
      !isFirstVoter
    ) {
      setIsFirstVoter(true);
      sessionStorage.setItem(storageKey, "true");
    }
    prevTotalRef.current = totalVotes;
  }, [totalVotes, hasVoted, isFirstVoter, storageKey]);

  useEffect(() => {
    setIsFirstVoter(sessionStorage.getItem(storageKey) === "true");
    prevTotalRef.current = 0;
  }, [debateId, storageKey]);

  return isFirstVoter;
}
