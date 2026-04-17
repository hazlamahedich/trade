import { StaticAgentIcon } from "./StaticAgentIcon";
import { truncateUnicode } from "../utils/truncate";

interface BrandMarkProps {
  className?: string;
}

function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white font-bold text-xs">
        T
      </span>
      <span className="text-white font-semibold text-sm tracking-tight">
        AI Trading Debate Lab
      </span>
    </div>
  );
}

interface QuoteCardTemplateProps {
  agent: "bull" | "bear";
  content: string;
  assetName: string;
  debateUrl?: string;
}

const MAX_CONTENT_LENGTH = 280;
const MAX_ASSET_LENGTH = 15;

export function QuoteCardTemplate({
  agent,
  content,
  assetName,
  debateUrl,
}: QuoteCardTemplateProps) {
  const isBull = agent === "bull";

  const truncatedContent = truncateUnicode(content, MAX_CONTENT_LENGTH);
  const truncatedAsset = truncateUnicode(assetName, MAX_ASSET_LENGTH);

  return (
    <div
      data-testid="quote-card-template"
      style={{ width: 600 }}
      className="bg-slate-900 text-slate-200 p-6 font-sans"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/15">
        <BrandMark />
        <span className="text-sm text-slate-400 font-medium">
          {truncatedAsset}
        </span>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isBull ? "bg-emerald-500/20" : "bg-rose-500/20"
          }`}
        >
          <StaticAgentIcon agent={agent} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`font-semibold text-sm ${
              isBull ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isBull ? "Bull" : "Bear"}
          </span>
        </div>
      </div>

      <p className="text-slate-200 text-base leading-relaxed break-words mb-4">
        {truncatedContent}
      </p>

      <div className="pt-3 border-t border-white/15">
        {debateUrl ? (
          <p className="text-[10px] text-slate-400 text-center break-all">
            {debateUrl} #AITradingDebate
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 text-center">
            #AITradingDebate
          </p>
        )}
      </div>
    </div>
  );
}
