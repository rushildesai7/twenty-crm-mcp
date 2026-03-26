import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { fetchSchema, generateTools } from "./schema.js";
import { createServer } from "./server.js";
import type { ToolDefinition, DispatchEntry } from "./schema.js";

type Env = Record<string, string | undefined>;

interface CachedSchema {
  tools: ToolDefinition[];
  dispatch: Map<string, DispatchEntry>;
}

export function createApp(env: Env = {}) {
  const app = new Hono();

  // Schema cache — fetched once per app lifetime
  let cached: CachedSchema | null = null;

  async function getSchema(apiKey: string, baseUrl: string): Promise<CachedSchema> {
    if (cached) return cached;

    async function makeRequest(endpoint: string): Promise<unknown> {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    }

    const objects = await fetchSchema(makeRequest);
    cached = generateTools(objects);
    return cached;
  }

  // CORS — expose MCP protocol headers for remote clients
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

  // Bearer token auth — only enforced if MCP_API_KEY is configured
  app.use("/mcp", async (c, next) => {
    const mcpApiKey =
      env.MCP_API_KEY || (c.env as Env | undefined)?.MCP_API_KEY;

    if (mcpApiKey) {
      const auth = c.req.header("Authorization");
      if (auth !== `Bearer ${mcpApiKey}`) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    await next();
  });

  // Health check (public, no auth)
  app.get("/health", (c) => {
    return c.json({ status: "ok", server: "twenty-crm-mcp", version: "2.0.0" });
  });

  // MCP endpoint — stateless: fresh server + transport per request, cached schema
  app.all("/mcp", async (c) => {
    const workerEnv = (c.env as Env | undefined) ?? {};
    const apiKey = env.TWENTY_API_KEY || workerEnv.TWENTY_API_KEY;
    const baseUrl = env.TWENTY_BASE_URL || workerEnv.TWENTY_BASE_URL || "https://api.twenty.com";

    if (!apiKey) {
      return c.json({ error: "TWENTY_API_KEY not configured" }, 500);
    }

    const { tools, dispatch } = await getSchema(apiKey, baseUrl);
    const server = createServer({ apiKey, baseUrl, tools, dispatch });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}
