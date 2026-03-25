import { serve } from "@hono/node-server";
import { createApp } from "./src/app.js";

const app = createApp(process.env as Record<string, string | undefined>);
const port = parseInt(process.env.PORT || "3000", 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Twenty CRM MCP server (HTTP) listening on http://localhost:${info.port}/mcp`);
});
