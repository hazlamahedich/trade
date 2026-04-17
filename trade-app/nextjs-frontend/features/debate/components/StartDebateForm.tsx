"use client";

import { useTransition, useState, useEffect, useRef, useCallback } from "react";
import { startDebate } from "@/features/debate/actions/start-debate-action";
import { TrendingUp, DollarSign, BarChart3, Search, Loader2 } from "lucide-react";

interface AssetOption {
  symbol: string;
  name: string;
  category: "crypto" | "stocks" | "forex";
}

const CATEGORIES = [
  { key: "crypto" as const, label: "Crypto", icon: TrendingUp },
  { key: "stocks" as const, label: "Stocks", icon: BarChart3 },
  { key: "forex" as const, label: "Forex", icon: DollarSign },
];

export function StartDebateForm({ compact = false }: { compact?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [category, setCategory] = useState<"crypto" | "stocks" | "forex">("crypto");
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchAssets = useCallback(async (cat: string, q: string) => {
    setSearchLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/market/assets/search?q=${encodeURIComponent(q)}&category=${cat}`);
      const data = await res.json();
      if (data?.data && Array.isArray(data.data)) {
        const filtered = cat === "all" ? data.data : data.data.filter((a: AssetOption) => a.category === cat);
        setAssets(filtered);
      }
    } catch {
      setAssets([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAssets(category, query);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [category, query, fetchAssets]);

  useEffect(() => {
    fetchAssets(category, "");
  }, [category, fetchAssets]);

  function handleSubmit() {
    if (!selectedAsset) return;
    setError(null);
    const formData = new FormData();
    formData.set("asset", selectedAsset);
    startTransition(async () => {
      try {
        await startDebate(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start debate");
      }
    });
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-lg border border-white/15 bg-slate-900/80 overflow-hidden">
        {/* Category tabs */}
        <div className="flex border-b border-white/15">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setCategory(key); setQuery(""); setSelectedAsset(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]
                ${category === key ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/15">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedAsset(null); }}
              placeholder={`Search ${category}...`}
              className="w-full rounded-md border border-white/15 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Asset list */}
        <div className="max-h-56 overflow-y-auto p-2" role="listbox" aria-label="Asset list">
          {searchLoading && assets.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : assets.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-6">No assets found</p>
          ) : (
            assets.map((asset) => (
              <button
                key={`${asset.category}-${asset.symbol}`}
                type="button"
                role="option"
                aria-selected={selectedAsset === asset.symbol}
                onClick={() => setSelectedAsset(asset.symbol)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors min-h-[44px]
                  ${selectedAsset === asset.symbol
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:bg-white/5 border border-transparent"}`}
              >
                <span className="font-semibold">{asset.symbol}</span>
                <span className="text-slate-500 text-xs">{asset.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Start button */}
        <div className="p-3 border-t border-white/15">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedAsset || isPending}
            className="w-full inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Debate...
              </span>
            ) : selectedAsset ? (
              `Start Debate: ${selectedAsset}`
            ) : (
              "Select an asset"
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-400 mt-3 text-center" role="alert">
          {error}
        </p>
      )}
      {!compact && (
        <p className="text-xs text-slate-500 mt-3 text-center">
          Choose an asset class, pick an instrument, and start an AI-powered debate
        </p>
      )}
    </div>
  );
}
