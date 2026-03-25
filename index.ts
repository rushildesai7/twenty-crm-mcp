#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./src/server.js";

const server = createServer({
  apiKey: process.env.TWENTY_API_KEY!,
  baseUrl: process.env.TWENTY_BASE_URL,
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Twenty CRM MCP server running on stdio");
