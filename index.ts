#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fetchSchema, generateTools } from "./src/schema.js";
import { createServer } from "./src/server.js";

const apiKey = process.env.TWENTY_API_KEY!;
const baseUrl = process.env.TWENTY_BASE_URL || "https://api.twenty.com";

// Fetch metadata and generate tools before starting the server
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

console.error("Fetching Twenty CRM schema...");
const objects = await fetchSchema(makeRequest);
const { tools, dispatch } = generateTools(objects);
console.error(`Discovered ${objects.length} objects, generated ${tools.length} tools`);

const server = createServer({ apiKey, baseUrl, tools, dispatch });
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Twenty CRM MCP server running on stdio");
