"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TokenPayload {
  debateId: string;
  agent: "bull" | "bear";
  token: string;
  turn?: number;
}

export interface ArgumentPayload {
  debateId: string;
  agent: "bull" | "bear";
  content: string;
  turn?: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface StatusPayload {
  debateId: string;
  status: string;
}

export interface TurnChangePayload {
  debateId: string;
  currentAgent: "bull" | "bear";
}

export interface WebSocketAction {
  type: string;
  payload: TokenPayload | ArgumentPayload | ErrorPayload | StatusPayload | TurnChangePayload | Record<string, unknown>;
  timestamp: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UseDebateSocketOptions {
  debateId: string;
  onTokenReceived?: (payload: TokenPayload) => void;
  onArgumentComplete?: (payload: ArgumentPayload) => void;
  onStatusUpdate?: (payload: StatusPayload) => void;
  onTurnChange?: (payload: TurnChangePayload) => void;
  onError?: (error: ErrorPayload) => void;
  maxRetries?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

const DEFAULT_MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 60000;

async function getFreshToken(): Promise<string> {
  const token = localStorage.getItem("accessToken");
  const expiry = localStorage.getItem("tokenExpiry");

  if (expiry && Date.now() > parseInt(expiry) - TOKEN_REFRESH_THRESHOLD_MS) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${apiUrl}/auth/jwt/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          localStorage.setItem("accessToken", data.access_token);
          if (data.expires_at) {
            localStorage.setItem("tokenExpiry", String(data.expires_at));
          }
          return data.access_token;
        }
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
    }
  }

  if (token) {
    return Promise.resolve(token);
  }
  return Promise.resolve("");
}

export function useDebateSocket(options: UseDebateSocketOptions) {
  const {
    debateId,
    onTokenReceived,
    onArgumentComplete,
    onStatusUpdate,
    onTurnChange,
    onError,
    maxRetries = DEFAULT_MAX_RETRIES,
    onConnected,
    onDisconnected,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const retryCount = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmounted = useRef(false);

  const connect = useCallback(async () => {
    if (isUnmounted.current) return;

    const token = await getFreshToken();
    if (!token) {
      onError?.({ code: "NO_TOKEN", message: "No authentication token available" });
      return;
    }

    const wsProtocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
    const wsHost = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "";
    const cleanHost = wsHost.replace(/^(https?|wss?):\/\//, "");
    const wsUrl = `${wsProtocol}://${cleanHost}/ws/debate/${debateId}?token=${token}`;

    setStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted.current) {
          ws.close();
          return;
        }
        setStatus("connected");
        retryCount.current = 0;
        onConnected?.();
      };

      ws.onmessage = (event) => {
        if (isUnmounted.current) return;

        try {
          const action: WebSocketAction = JSON.parse(event.data);

          switch (action.type) {
            case "DEBATE/TOKEN_RECEIVED":
              onTokenReceived?.(action.payload as TokenPayload);
              break;
            case "DEBATE/ARGUMENT_COMPLETE":
              onArgumentComplete?.(action.payload as ArgumentPayload);
              break;
            case "DEBATE/STATUS_UPDATE":
              onStatusUpdate?.(action.payload as StatusPayload);
              break;
            case "DEBATE/TURN_CHANGE":
              onTurnChange?.(action.payload as TurnChangePayload);
              break;
            case "DEBATE/ERROR":
              onError?.(action.payload as ErrorPayload);
              break;
            case "DEBATE/PING":
              ws.send(JSON.stringify({ type: "DEBATE/PONG" }));
              break;
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = (event) => {
        if (isUnmounted.current) return;

        setStatus("disconnected");
        onDisconnected?.();

        if (retryCount.current < maxRetries && event.code !== 1000) {
          const delay = Math.pow(2, retryCount.current) * BASE_RETRY_DELAY;
          reconnectTimeoutRef.current = setTimeout(() => {
            retryCount.current++;
            connect();
          }, delay);
        } else if (event.code >= 4000 && event.code < 5000) {
          onError?.({
            code: `WS_${event.code}`,
            message: event.reason || "WebSocket connection closed",
          });
        }
      };

      ws.onerror = () => {
        if (isUnmounted.current) return;
        console.error("WebSocket error");
      };
    } catch (e) {
      console.error("Failed to create WebSocket:", e);
      setStatus("disconnected");
    }
  }, [debateId, maxRetries, onTokenReceived, onArgumentComplete, onStatusUpdate, onTurnChange, onError, onConnected, onDisconnected]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    retryCount.current = 0;
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    isUnmounted.current = false;
    connect();

    return () => {
      isUnmounted.current = true;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    reconnect,
    disconnect,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isDisconnected: status === "disconnected",
  };
}
