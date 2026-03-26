import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolDefinition, DispatchEntry } from "./schema.js";

export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
  tools: ToolDefinition[];
  dispatch: Map<string, DispatchEntry>;
}

interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

export function createServer({
  apiKey,
  baseUrl = "https://api.twenty.com",
  tools,
  dispatch,
}: ServerConfig): Server {
  if (!apiKey) throw new Error("apiKey is required");

  const server = new Server(
    { name: "twenty-crm", version: "2.0.0" },
    { capabilities: { tools: {} } }
  );

  // --- HTTP helper ---

  async function makeRequest(
    endpoint: string,
    method = "GET",
    data: unknown = null
  ): Promise<unknown> {
    const url = `${baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  // --- Generic CRUD operations ---

  async function createRecord(
    endpoint: string,
    label: string,
    data: Record<string, unknown>
  ): Promise<ToolResponse> {
    const result = await makeRequest(endpoint, "POST", data);
    return {
      content: [{ type: "text", text: `Created ${label}: ${JSON.stringify(result, null, 2)}` }],
    };
  }

  async function getRecord(
    endpoint: string,
    label: string,
    id: string
  ): Promise<ToolResponse> {
    const result = await makeRequest(`${endpoint}/${id}`);
    return {
      content: [{ type: "text", text: `${label} details: ${JSON.stringify(result, null, 2)}` }],
    };
  }

  async function updateRecord(
    endpoint: string,
    label: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<ToolResponse> {
    const result = await makeRequest(`${endpoint}/${id}`, "PATCH", data);
    return {
      content: [{ type: "text", text: `Updated ${label}: ${JSON.stringify(result, null, 2)}` }],
    };
  }

  async function listRecords(
    endpoint: string,
    label: string,
    params: Record<string, unknown>
  ): Promise<ToolResponse> {
    const { limit = 20, offset = 0, search, filter, order_by, order_direction } = params;
    let url = `${endpoint}?limit=${limit}&offset=${offset}`;
    if (search) url += `&search=${encodeURIComponent(search as string)}`;
    if (order_by) url += `&order_by=${encodeURIComponent(order_by as string)}`;
    if (order_direction) url += `&order_direction=${encodeURIComponent(order_direction as string)}`;
    if (filter && typeof filter === "object") {
      for (const [key, value] of Object.entries(filter as Record<string, unknown>)) {
        url += `&filter[${encodeURIComponent(key)}]=${encodeURIComponent(String(value))}`;
      }
    }
    const result = await makeRequest(url);
    return {
      content: [{ type: "text", text: `${label} list: ${JSON.stringify(result, null, 2)}` }],
    };
  }

  async function deleteRecord(
    endpoint: string,
    label: string,
    id: string
  ): Promise<ToolResponse> {
    await makeRequest(`${endpoint}/${id}`, "DELETE");
    return {
      content: [{ type: "text", text: `Deleted ${label} with ID: ${id}` }],
    };
  }

  async function searchRecords(params: Record<string, unknown>): Promise<ToolResponse> {
    const { query, object_types, limit = 10 } = params;
    const types = (object_types as string[] | undefined) ?? ["people", "companies"];
    const results: Record<string, unknown> = {};

    for (const objectType of types) {
      try {
        const url = `/rest/${objectType}?search=${encodeURIComponent(query as string)}&limit=${limit}`;
        results[objectType] = await makeRequest(url);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        results[objectType] = { error: msg };
      }
    }

    return {
      content: [{ type: "text", text: `Search results for "${query}": ${JSON.stringify(results, null, 2)}` }],
    };
  }

  // --- Tool handler registration ---

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const entry = dispatch.get(name);

    if (!entry) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const a = (args ?? {}) as Record<string, unknown>;

      switch (entry.action) {
        case "create":
          return await createRecord(entry.endpoint, entry.labelSingular, a);
        case "get":
          return await getRecord(entry.endpoint, entry.labelSingular, a.id as string);
        case "update": {
          const { id, ...data } = a;
          return await updateRecord(entry.endpoint, entry.labelSingular, id as string, data);
        }
        case "list":
          return await listRecords(entry.endpoint, entry.labelPlural, a);
        case "delete":
          return await deleteRecord(entry.endpoint, entry.labelSingular, a.id as string);
        case "search":
          return await searchRecords(a);
        default:
          throw new Error(`Unknown action: ${entry.action}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
    }
  });

  return server;
}
