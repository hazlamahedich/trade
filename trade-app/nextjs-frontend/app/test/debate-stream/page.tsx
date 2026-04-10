"use client";

import { useState } from "react";
import { DebateStream } from "@/features/debate/components";

export default function TestDebateStreamPage() {
  const [debateId] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("debateId") || "test-debate-guardian-001";
    }
    return "test-debate-guardian-001";
  });

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-white text-xl mb-4" data-testid="test-page-heading">
        Test: DebateStream
      </h1>
      <div className="max-w-3xl mx-auto">
        <DebateStream debateId={debateId} />
      </div>
    </div>
  );
}
