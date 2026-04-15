export interface GracefulError {
  ok: false;
  error: string;
}

export interface GracefulSuccess {
  ok: true;
  response: Response;
}

export type GracefulResult = GracefulError | GracefulSuccess;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10_000,
): Promise<GracefulResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return { ok: true, response };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isValidEnvelope(json: unknown): json is {
  data: unknown;
  error: unknown;
  meta: unknown;
} {
  return (
    typeof json === "object" &&
    json !== null &&
    "data" in json
  );
}
