import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";
import { SSETransport, sseSessions } from "./sse.js";

type Env = Record<string, string | undefined>;

function resolveEnv(env: Env, c: { env: unknown }) {
  const workerEnv = (c.env as Env | undefined) ?? {};
  return {
    apiKey: env.TWENTY_API_KEY || workerEnv.TWENTY_API_KEY,
    baseUrl: env.TWENTY_BASE_URL || workerEnv.TWENTY_BASE_URL,
    mcpApiKey: env.MCP_API_KEY || workerEnv.MCP_API_KEY,
  };
}

export function createApp(env: Env = {}) {
  const app = new Hono();

  // CORS
  app.use(
    "/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "mcp-session-id",
        "mcp-protocol-version",
      ],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
      maxAge: 86400,
    })
  );

  // Bearer token auth — applied to all MCP routes
  const authMiddleware = async (
    c: Parameters<Parameters<typeof app.use>[1]>[0],
    next: () => Promise<void>
  ) => {
    const { mcpApiKey } = resolveEnv(env, c);
    if (mcpApiKey) {
      const auth = c.req.header("Authorization");
      if (auth !== `Bearer ${mcpApiKey}`) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }
    await next();
  };

  app.use("/mcp", authMiddleware);
  app.use("/sse", authMiddleware);
  app.use("/messages", authMiddleware);

  // Health check (public)
  app.get("/health", (c) => {
    return c.json({ status: "ok", server: "twenty-crm-mcp", version: "1.1.0" });
  });

  // --- Streamable HTTP (2025-03-26 spec) ---

  app.all("/mcp", async (c) => {
    const { apiKey, baseUrl } = resolveEnv(env, c);
    if (!apiKey) return c.json({ error: "TWENTY_API_KEY not configured" }, 500);

    const server = createServer({ apiKey, baseUrl });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  // --- Legacy SSE (2024-11-05 spec, backwards compat) ---

  app.get("/sse", async (c) => {
    const { apiKey, baseUrl } = resolveEnv(env, c);
    if (!apiKey) return c.json({ error: "TWENTY_API_KEY not configured" }, 500);

    const sessionId = crypto.randomUUID();
    const transport = new SSETransport();
    const session = { transport, closed: false };
    sseSessions.set(sessionId, session);

    return streamSSE(c, async (stream) => {
      transport.setWriter((event, data) => stream.writeSSE({ event, data }));
      await createServer({ apiKey, baseUrl }).connect(transport);
      await stream.writeSSE({ event: "endpoint", data: `/messages?sessionId=${sessionId}` });

      stream.onAbort(() => {
        session.closed = true;
        sseSessions.delete(sessionId);
        transport.close();
      });

      while (!session.closed) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    });
  });

  app.post("/messages", async (c) => {
    const sessionId = c.req.query("sessionId");
    if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

    const session = sseSessions.get(sessionId);
    if (!session) return c.json({ error: "Invalid or expired session" }, 404);

    session.transport.handlePostMessage(await c.req.json());
    return c.text("accepted", 202);
  });

  return app;
}
