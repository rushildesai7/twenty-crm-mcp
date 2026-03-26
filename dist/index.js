#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/schema.ts
function toSnakeCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}
var SKIP_FIELD_TYPES = /* @__PURE__ */ new Set([
  "RELATION",
  "ACTOR",
  "TS_VECTOR",
  "MORPH_RELATION",
  "FILES"
]);
async function fetchSchema(makeRequest2) {
  const res = await makeRequest2("/rest/metadata/objects");
  const objects2 = res?.data?.objects ?? res?.objects ?? [];
  return objects2.filter((obj) => obj.isActive && !obj.isSystem);
}
function fieldToJsonSchema(field) {
  const desc = field.description ? `${field.label} \u2014 ${field.description}` : field.label;
  switch (field.type) {
    case "TEXT":
    case "RICH_TEXT":
      return { type: "string", description: desc };
    case "RICH_TEXT_V2":
      return {
        type: "object",
        description: desc,
        properties: {
          blocknote: { type: "string", description: "BlockNote JSON content" },
          markdown: { type: "string", description: "Markdown content" }
        }
      };
    case "NUMBER":
    case "POSITION":
      return { type: "number", description: desc };
    case "NUMERIC":
      return { type: "string", description: `${desc} (numeric string for precision)` };
    case "BOOLEAN":
      return { type: "boolean", description: desc };
    case "DATE":
      return { type: "string", description: `${desc} (ISO 8601 date, e.g. 2024-01-15)` };
    case "DATE_TIME":
      return { type: "string", description: `${desc} (ISO 8601 datetime, e.g. 2024-01-15T09:00:00Z)` };
    case "UUID":
      return { type: "string", description: `${desc} (UUID)` };
    case "SELECT": {
      const values = (field.options ?? []).map((o) => o.value);
      return values.length > 0 ? { type: "string", enum: values, description: desc } : { type: "string", description: desc };
    }
    case "MULTI_SELECT": {
      const values = (field.options ?? []).map((o) => o.value);
      return values.length > 0 ? { type: "array", items: { type: "string", enum: values }, description: desc } : { type: "array", items: { type: "string" }, description: desc };
    }
    case "RATING":
      return {
        type: "string",
        enum: ["RATING_1", "RATING_2", "RATING_3", "RATING_4", "RATING_5"],
        description: desc
      };
    case "CURRENCY":
      return {
        type: "object",
        description: desc,
        properties: {
          amountMicros: { type: "number", description: "Amount in micros (1 dollar = 1000000)" },
          currencyCode: { type: "string", description: "ISO currency code (e.g. USD, EUR)" }
        }
      };
    case "LINKS":
      return {
        type: "object",
        description: desc,
        properties: {
          primaryLinkUrl: { type: "string", description: "Primary URL" },
          primaryLinkLabel: { type: "string", description: "Primary link label" }
        }
      };
    case "ADDRESS":
      return {
        type: "object",
        description: desc,
        properties: {
          addressStreet1: { type: "string", description: "Street line 1" },
          addressStreet2: { type: "string", description: "Street line 2" },
          addressCity: { type: "string", description: "City" },
          addressState: { type: "string", description: "State/Province" },
          addressCountry: { type: "string", description: "Country" },
          addressPostcode: { type: "string", description: "Postal code" },
          addressLat: { type: "number", description: "Latitude" },
          addressLng: { type: "number", description: "Longitude" }
        }
      };
    case "PHONES":
      return {
        type: "object",
        description: desc,
        properties: {
          primaryPhoneNumber: { type: "string", description: "Primary phone number" },
          primaryPhoneCountryCode: { type: "string", description: "Country code (e.g. +1)" },
          additionalPhones: { type: "array", items: { type: "string" }, description: "Additional phone numbers" }
        }
      };
    case "EMAILS":
      return {
        type: "object",
        description: desc,
        properties: {
          primaryEmail: { type: "string", description: "Primary email address" },
          additionalEmails: { type: "array", items: { type: "string" }, description: "Additional email addresses" }
        }
      };
    case "FULL_NAME":
      return {
        type: "object",
        description: desc,
        properties: {
          firstName: { type: "string", description: "First name" },
          lastName: { type: "string", description: "Last name" }
        }
      };
    case "ARRAY":
      return { type: "array", items: { type: "string" }, description: desc };
    case "RAW_JSON":
      return { type: "object", description: desc };
    default:
      return null;
  }
}
function getWritableFields(fields) {
  return fields.filter(
    (f) => f.isActive && !f.isSystem && !SKIP_FIELD_TYPES.has(f.type)
  );
}
function buildPropertiesSchema(fields) {
  const properties = {};
  const required = [];
  for (const field of fields) {
    const schema = fieldToJsonSchema(field);
    if (!schema) continue;
    properties[field.name] = schema;
    if (!field.isNullable && field.defaultValue === void 0) {
      required.push(field.name);
    }
  }
  return { properties, required };
}
function generateTools(objects2) {
  const tools2 = [];
  const dispatch2 = /* @__PURE__ */ new Map();
  for (const obj of objects2) {
    const singular = toSnakeCase(obj.nameSingular);
    const plural = toSnakeCase(obj.namePlural);
    const endpoint = `/rest/${obj.namePlural}`;
    const writableFields = getWritableFields(obj.fields);
    const { properties, required } = buildPropertiesSchema(writableFields);
    const base = {
      endpoint,
      labelSingular: obj.labelSingular,
      labelPlural: obj.labelPlural
    };
    const createName = `create_${singular}`;
    tools2.push({
      name: createName,
      description: `Create a new ${obj.labelSingular} in Twenty CRM`,
      inputSchema: {
        type: "object",
        properties,
        ...required.length > 0 ? { required } : {}
      }
    });
    dispatch2.set(createName, { action: "create", ...base });
    const getName = `get_${singular}`;
    tools2.push({
      name: getName,
      description: `Get a ${obj.labelSingular} by ID`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: `${obj.labelSingular} ID` }
        },
        required: ["id"]
      }
    });
    dispatch2.set(getName, { action: "get", ...base });
    const updateName = `update_${singular}`;
    tools2.push({
      name: updateName,
      description: `Update an existing ${obj.labelSingular}`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: `${obj.labelSingular} ID` },
          ...properties
        },
        required: ["id"]
      }
    });
    dispatch2.set(updateName, { action: "update", ...base });
    const listName = `list_${plural}`;
    tools2.push({
      name: listName,
      description: `List ${obj.labelPlural} with optional filtering and pagination`,
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results to return (default: 20)" },
          offset: { type: "number", description: "Number of results to skip (default: 0)" },
          search: { type: "string", description: "Search term" },
          filter: { type: "object", description: "Field-level filters as { fieldName: value } pairs" },
          order_by: { type: "string", description: "Field name to order by" },
          order_direction: { type: "string", enum: ["AscNullsFirst", "AscNullsLast", "DescNullsFirst", "DescNullsLast"], description: "Sort direction" }
        }
      }
    });
    dispatch2.set(listName, { action: "list", ...base });
    const deleteName = `delete_${singular}`;
    tools2.push({
      name: deleteName,
      description: `Delete a ${obj.labelSingular} from Twenty CRM`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: `${obj.labelSingular} ID to delete` }
        },
        required: ["id"]
      }
    });
    dispatch2.set(deleteName, { action: "delete", ...base });
  }
  const searchName = "search_records";
  tools2.push({
    name: searchName,
    description: "Search across multiple object types in Twenty CRM",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        object_types: {
          type: "array",
          items: { type: "string" },
          description: `Object types to search (available: ${objects2.map((o) => o.namePlural).join(", ")})`
        },
        limit: { type: "number", description: "Results per object type (default: 10)" }
      },
      required: ["query"]
    }
  });
  dispatch2.set(searchName, {
    action: "search",
    endpoint: "/rest",
    labelSingular: "Record",
    labelPlural: "Records"
  });
  return { tools: tools2, dispatch: dispatch2 };
}

// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
function createServer({
  apiKey: apiKey2,
  baseUrl: baseUrl2 = "https://api.twenty.com",
  tools: tools2,
  dispatch: dispatch2
}) {
  if (!apiKey2) throw new Error("apiKey is required");
  const server2 = new Server(
    { name: "twenty-crm", version: "2.0.0" },
    { capabilities: { tools: {} } }
  );
  async function makeRequest2(endpoint, method = "GET", data = null) {
    const url = `${baseUrl2}${endpoint}`;
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${apiKey2}`,
        "Content-Type": "application/json"
      }
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
  async function createRecord(endpoint, label, data) {
    const result = await makeRequest2(endpoint, "POST", data);
    return {
      content: [{ type: "text", text: `Created ${label}: ${JSON.stringify(result, null, 2)}` }]
    };
  }
  async function getRecord(endpoint, label, id) {
    const result = await makeRequest2(`${endpoint}/${id}`);
    return {
      content: [{ type: "text", text: `${label} details: ${JSON.stringify(result, null, 2)}` }]
    };
  }
  async function updateRecord(endpoint, label, id, data) {
    const result = await makeRequest2(`${endpoint}/${id}`, "PATCH", data);
    return {
      content: [{ type: "text", text: `Updated ${label}: ${JSON.stringify(result, null, 2)}` }]
    };
  }
  async function listRecords(endpoint, label, params) {
    const { limit = 20, offset = 0, search, filter, order_by, order_direction } = params;
    let url = `${endpoint}?limit=${limit}&offset=${offset}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (order_by) url += `&order_by=${encodeURIComponent(order_by)}`;
    if (order_direction) url += `&order_direction=${encodeURIComponent(order_direction)}`;
    if (filter && typeof filter === "object") {
      for (const [key, value] of Object.entries(filter)) {
        url += `&filter[${encodeURIComponent(key)}]=${encodeURIComponent(String(value))}`;
      }
    }
    const result = await makeRequest2(url);
    return {
      content: [{ type: "text", text: `${label} list: ${JSON.stringify(result, null, 2)}` }]
    };
  }
  async function deleteRecord(endpoint, label, id) {
    await makeRequest2(`${endpoint}/${id}`, "DELETE");
    return {
      content: [{ type: "text", text: `Deleted ${label} with ID: ${id}` }]
    };
  }
  async function searchRecords(params) {
    const { query, object_types, limit = 10 } = params;
    const types = object_types ?? ["people", "companies"];
    const results = {};
    for (const objectType of types) {
      try {
        const url = `/rest/${objectType}?search=${encodeURIComponent(query)}&limit=${limit}`;
        results[objectType] = await makeRequest2(url);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results[objectType] = { error: msg };
      }
    }
    return {
      content: [{ type: "text", text: `Search results for "${query}": ${JSON.stringify(results, null, 2)}` }]
    };
  }
  server2.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools2 }));
  server2.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const entry = dispatch2.get(name);
    if (!entry) {
      throw new Error(`Unknown tool: ${name}`);
    }
    try {
      const a = args ?? {};
      switch (entry.action) {
        case "create":
          return await createRecord(entry.endpoint, entry.labelSingular, a);
        case "get":
          return await getRecord(entry.endpoint, entry.labelSingular, a.id);
        case "update": {
          const { id, ...data } = a;
          return await updateRecord(entry.endpoint, entry.labelSingular, id, data);
        }
        case "list":
          return await listRecords(entry.endpoint, entry.labelPlural, a);
        case "delete":
          return await deleteRecord(entry.endpoint, entry.labelSingular, a.id);
        case "search":
          return await searchRecords(a);
        default:
          throw new Error(`Unknown action: ${entry.action}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${msg}` }] };
    }
  });
  return server2;
}

// index.ts
var apiKey = process.env.TWENTY_API_KEY;
var baseUrl = process.env.TWENTY_BASE_URL || "https://api.twenty.com";
async function makeRequest(endpoint) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}
console.error("Fetching Twenty CRM schema...");
var objects = await fetchSchema(makeRequest);
var { tools, dispatch } = generateTools(objects);
console.error(`Discovered ${objects.length} objects, generated ${tools.length} tools`);
var server = createServer({ apiKey, baseUrl, tools, dispatch });
var transport = new StdioServerTransport();
await server.connect(transport);
console.error("Twenty CRM MCP server running on stdio");
