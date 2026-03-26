import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * Minimal Transport implementation for legacy SSE compat (2024-11-05 spec).
 *
 * Protocol:
 *   GET /sse        → opens SSE stream, first event is `endpoint` with POST URL
 *   POST /messages  → client sends JSON-RPC here, responses flow back via SSE
 */
export class SSETransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: unknown) => void;

  private _writeFn: ((event: string, data: string) => Promise<void>) | null =
    null;

  setWriter(writeFn: (event: string, data: string) => Promise<void>) {
    this._writeFn = writeFn;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._writeFn) throw new Error("SSE stream not connected");
    await this._writeFn("message", JSON.stringify(message));
  }

  handlePostMessage(body: unknown): void {
    this.onmessage?.(body as JSONRPCMessage);
  }
}

export interface SSESession {
  transport: SSETransport;
  closed: boolean;
}

export const sseSessions = new Map<string, SSESession>();
