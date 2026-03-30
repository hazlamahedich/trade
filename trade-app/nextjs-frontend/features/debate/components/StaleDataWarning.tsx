"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface StaleDataWarningProps {
  lastUpdate: string | null;
  ageSeconds: number;
  onAcknowledge: () => void;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "Unknown";
  try {
    return new Date(isoString).toLocaleTimeString();
  } catch {
    return "Unknown";
  }
}

export function StaleDataWarning({
  lastUpdate,
  ageSeconds,
  onAcknowledge,
}: StaleDataWarningProps) {
  const shouldReduceMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);
  const acknowledgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    acknowledgeRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stale-data-title"
        aria-describedby="stale-data-description"
      >
        <div className="flex items-center justify-center min-h-screen p-4">
          <div
            ref={modalRef}
            data-testid="stale-data-warning"
          >
            <motion.div
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { scale: 0.9, opacity: 0 }
              }
              animate={{ scale: 1, opacity: 1 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { scale: 0.9, opacity: 0 }
              }
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
              className="bg-slate-800 border border-violet-500/50 rounded-lg p-6 max-w-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <svg
                  className="w-8 h-8 text-violet-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <h2
                  id="stale-data-title"
                  className="text-xl font-bold text-slate-100"
                >
                  Data Stale
                </h2>
              </div>
              <p
                id="stale-data-description"
                className="text-slate-300 mb-2"
                aria-live="assertive"
              >
                Market data is {ageSeconds} seconds old.
              </p>
              <p className="text-slate-400 text-sm mb-4">
                Last update: {formatTime(lastUpdate)}
              </p>
              <p className="text-slate-300 mb-6">
                Debate paused for your protection. Please wait for fresh data.
              </p>
              <button
                ref={acknowledgeRef}
                onClick={onAcknowledge}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                data-testid="stale-acknowledge-btn"
              >
                I Understand
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
