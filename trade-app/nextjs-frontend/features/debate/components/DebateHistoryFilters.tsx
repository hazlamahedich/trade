"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  SUPPORTED_ASSETS,
  VALID_OUTCOMES,
} from "@/features/debate/types/debate-history";

interface DebateHistoryFiltersProps {
  initialAsset?: string;
  initialOutcome?: string;
}

export function DebateHistoryFilters({
  initialAsset = "",
  initialOutcome = "",
}: DebateHistoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentAsset = (searchParams.get("asset") ?? initialAsset).toLowerCase();
  const currentOutcome = (searchParams.get("outcome") ?? initialOutcome).toLowerCase();
  const currentSize = searchParams.get("size") ?? "20";

  function buildUrl(
    updates: Record<string, string>,
  ) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("size", currentSize);

    const asset = updates.asset ?? currentAsset;
    const outcome = updates.outcome ?? currentOutcome;

    if (asset) params.set("asset", asset);
    if (outcome) params.set("outcome", outcome);

    return `/dashboard/debates?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto flex-nowrap sm:flex-wrap">
      <Select
        value={currentAsset || "__all__"}
        onValueChange={(value) =>
          router.push(
            buildUrl({
              asset: value === "__all__" ? "" : value,
            }),
          )
        }
      >
        <SelectTrigger
          className="min-h-[44px] min-w-[44px] w-[140px]"
          aria-label="Filter by asset"
        >
          <SelectValue placeholder="All Assets" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Assets</SelectItem>
          {SUPPORTED_ASSETS.map((asset) => (
            <SelectItem key={asset} value={asset}>
              {asset.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentOutcome || "__all__"}
        onValueChange={(value) =>
          router.push(
            buildUrl({
              outcome: value === "__all__" ? "" : value,
            }),
          )
        }
      >
        <SelectTrigger
          className="min-h-[44px] min-w-[44px] w-[160px]"
          aria-label="Filter by outcome"
        >
          <SelectValue placeholder="All Outcomes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Outcomes</SelectItem>
          {VALID_OUTCOMES.map((outcome) => (
            <SelectItem key={outcome} value={outcome}>
              {outcome === "bull"
                ? "Bull Wins"
                : outcome === "bear"
                  ? "Bear Wins"
                  : "Undecided"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(currentAsset || currentOutcome) && (
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => router.push(buildUrl({ asset: "", outcome: "" }))}
          aria-label="Clear all filters"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
