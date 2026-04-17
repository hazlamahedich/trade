"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/config";

const SUPPORTED_ASSETS = ["bitcoin", "btc", "ethereum", "eth", "solana", "sol"] as const;

const startDebateInputSchema = z.object({
  asset: z.enum(SUPPORTED_ASSETS),
});

const debateMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const startDebateResponseSchema = z.object({
  data: z.object({
    debateId: z.string(),
    asset: z.string(),
    status: z.string(),
    messages: z.array(debateMessageSchema),
    currentTurn: z.number(),
    maxTurns: z.number(),
    createdAt: z.string(),
  }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  meta: z.record(z.unknown()).optional(),
});

export async function startDebate(formData: FormData): Promise<never> {
  const raw = formData.get("asset");
  const parsed = startDebateInputSchema.safeParse({ asset: raw });

  if (!parsed.success) {
    throw new Error(`Invalid asset: ${raw}`);
  }

  const asset = parsed.data.asset;
  const url = `${getApiBaseUrl()}/api/debate/start`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      `Network failure starting debate: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        detail = `: ${errorBody.error.message}`;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`Failed to start debate: HTTP ${response.status}${detail}`);
  }

  const json: unknown = await response.json();
  const validated = startDebateResponseSchema.safeParse(json);

  if (!validated.success || !validated.data.data) {
    throw new Error("Invalid response from debate start API");
  }

  redirect(`/debates/${validated.data.data.debateId}`);
}
