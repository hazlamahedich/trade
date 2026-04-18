export interface TranscriptMessage {
  role: string;
  content: string;
}

export interface TradingAnalysis {
  bullScore: number;
  bearScore: number;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  winner: "bull" | "bear" | "tie";
  winnerRationale: string;
  summary: string;
  keySupport: number[];
  keyResistance: number[];
  entryZone: { low: number; high: number; rationale: string } | null;
  stopLoss: { price: number; rationale: string } | null;
  takeProfit: { price: number; rationale: string } | null;
  riskRewardRatio: string;
  watchlist: string[];
  verdict: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DebateDetailData {
  debateId: string;
  asset: string;
  status: string;
  currentTurn: number;
  maxTurns: number;
  guardianVerdict: string | null;
  guardianInterruptsCount: number;
  createdAt: string;
  completedAt: string | null;
  totalVotes: number;
  voteBreakdown: Record<string, number>;
  transcript: TranscriptMessage[] | null;
  tradingAnalysis: TradingAnalysis | null;
}

export interface TechnicalIndicators {
  rsi14: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  sma20: number | null;
  sma50: number | null;
  bollingerBands: { upper: number; middle: number; lower: number } | null;
  atr14: number | null;
  change24h: number | null;
  change7d: number | null;
  volumeRatio: number | null;
  supportLevels: number[] | null;
  resistanceLevels: number[] | null;
}

export interface ForexMeta {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  spread: number | null;
  pipValue: number | null;
  lotSize: number | null;
}
