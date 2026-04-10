"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { GuardianFreezeState } from "../hooks/useGuardianFreeze";

interface GuardianOverlayProps {
  state: GuardianFreezeState;
  onUnderstand: () => void;
  onIgnore: () => void;
  onRetry: () => void;
  onClear: () => void;
  shouldReduceMotion: boolean;
}

const verdictHeadingId = "guardian-verdict-heading";
const reasonDescId = "guardian-reason-desc";

export function GuardianOverlay({
  state,
  onUnderstand,
  onIgnore,
  onRetry,
  onClear,
  shouldReduceMotion,
}: GuardianOverlayProps) {
  const isOpen = state.status !== "active";
  const isCritical =
    (state.status === "frozen" || state.status === "error") && state.data?.riskLevel === "critical";
  const isError = state.status === "error";

  const data = state.status !== "active" ? state.data : null;
  const triggerArg = state.status !== "active" ? state.triggerArg : null;

  const animProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={verdictHeadingId}
          aria-describedby={reasonDescId}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (state.status === "frozen" && state.data.riskLevel === "critical") {
              e.preventDefault();
            }
          }}
          className="bg-slate-900/80 backdrop-blur-md border-violet-600/50 text-white sm:max-w-md max-h-[85vh] overflow-y-auto"
          data-testid="guardian-overlay"
        >
          <AnimatePresence>
            {isOpen && (
              <motion.div key="guardian-content" {...animProps}>
                <DialogHeader>
                  <div className="flex items-center gap-2 bg-violet-600 rounded-t-lg -mt-6 -mx-6 px-6 py-3 mb-2">
                    <ShieldAlert className="h-5 w-5 text-white" />
                    <DialogTitle
                      id={verdictHeadingId}
                      className="text-white font-black text-base tracking-wide"
                    >
                      {data?.summaryVerdict ?? "Guardian Alert"}
                    </DialogTitle>
                  </div>
                </DialogHeader>

                <DialogDescription id={reasonDescId} className="text-slate-300 text-sm mt-2">
                  {data?.reason ?? "A risk has been detected."}
                </DialogDescription>

                {data?.fallacyType && (
                  <div className="mt-2">
                    <span
                      data-testid="guardian-fallacy-badge"
                      className="inline-block px-2 py-0.5 text-xs font-medium bg-violet-600/30 text-violet-300 rounded-full"
                    >
                      {data.fallacyType}
                    </span>
                  </div>
                )}

                {triggerArg && (
                  <blockquote
                    data-testid="guardian-trigger-arg"
                    className="mt-3 pl-3 border-l-2 border-slate-600 bg-slate-800/50 rounded-r p-2"
                  >
                    <p className="text-slate-400 text-xs font-medium mb-1">
                      {triggerArg.agent === "bull" ? "Bull" : "Bear"} said:
                    </p>
                    <p className="text-slate-300 text-sm italic line-clamp-3">
                      {triggerArg.content}
                    </p>
                  </blockquote>
                )}

                {isError && (
                  <p data-testid="guardian-error-message" className="mt-3 text-red-400 text-sm">
                    {state.status === "error" ? state.error : ""}
                  </p>
                )}

                {isCritical && !isError && (
                  <p className="mt-3 text-red-400 text-sm font-semibold">
                    Critical risk detected — debate ended
                  </p>
                )}

                <div
                  className={`
                    mt-4 flex gap-3
                    ${isCritical && !isError ? "justify-center" : "flex-col sm:flex-row"}
                  `}
                  data-testid="guardian-actions"
                >
                  {isError ? (
                    <>
                      <button
                        data-testid="guardian-retry-btn"
                        onClick={onRetry}
                        className="px-4 py-2.75 min-h-[44px] bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        Retry
                      </button>
                      {!isCritical && (
                        <button
                          data-testid="guardian-dismiss-anyway-btn"
                          onClick={onClear}
                          className="px-4 py-2.75 min-h-[44px] text-slate-400 hover:text-white text-sm font-medium rounded-md transition-colors"
                        >
                          Dismiss Anyway
                        </button>
                      )}
                    </>
                  ) : isCritical ? (
                    <button
                      data-testid="guardian-understand-btn"
                      onClick={onUnderstand}
                      autoFocus
                      className="px-4 py-2.75 min-h-[44px] bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      I Understand
                    </button>
                  ) : (
                    <>
                      <button
                        data-testid="guardian-understand-btn"
                        onClick={onUnderstand}
                        autoFocus
                        className="px-4 py-2.75 min-h-[44px] bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        I Understand
                      </button>
                      <button
                        data-testid="guardian-ignore-btn"
                        onClick={onIgnore}
                        className="px-4 py-2.75 min-h-[44px] text-slate-400 hover:text-white text-sm font-medium rounded-md transition-colors"
                      >
                        Proceed Anyway
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
