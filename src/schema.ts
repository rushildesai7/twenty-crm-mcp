/**
 * Dynamic schema generation from Twenty CRM metadata API.
 *
 * Fetches object metadata, maps field types to JSON Schema,
 * and generates MCP tool definitions for every active object.
 */

// ---------------------------------------------------------------------------
// Types for Twenty metadata API responses
// ---------------------------------------------------------------------------

interface FieldOption {
  label: string;
  value: string;
  color?: string;
  position?: number;
}

interface FieldMetadata {
  id: string;
  name: string;
  label: string;
  type: string;
  description?: string;
  isNullable: boolean;
  isSystem: boolean;
  isActive: boolean;
  isCustom: boolean;
  defaultValue?: unknown;
  options?: FieldOption[] | null;
}

interface ObjectMetadata {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description?: string;
  isActive: boolean;
  isSystem: boolean;
  isCustom: boolean;
  fields: FieldMetadata[];
}

interface MetadataResponse {
  data: {
    objects: ObjectMetadata[];
  };
}

// ---------------------------------------------------------------------------
// Tool / dispatch types exported for server.ts
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface DispatchEntry {
  action: "create" | "get" | "update" | "list" | "delete" | "search";
  endpoint: string; // e.g. "/rest/people"
  labelSingular: string;
  labelPlural: string;
}

export interface GeneratedSchema {
  tools: ToolDefinition[];
  dispatch: Map<string, DispatchEntry>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert camelCase to snake_case */
function toSnakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

// Field types to skip in write (create/update) schemas
const SKIP_FIELD_TYPES = new Set([
  "RELATION",
  "ACTOR",
  "TS_VECTOR",
  "MORPH_RELATION",
  "FILES",
]);

// ---------------------------------------------------------------------------
// Metadata fetching
// ---------------------------------------------------------------------------

type RequestFn = (endpoint: string, method?: string, data?: unknown) => Promise<unknown>;

export async function fetchSchema(makeRequest: RequestFn): Promise<ObjectMetadata[]> {
  const res = (await makeRequest("/rest/metadata/objects")) as MetadataResponse;
  const objects = res?.data?.objects ?? (res as unknown as { objects: ObjectMetadata[] })?.objects ?? [];

  return objects.filter((obj) => obj.isActive && !obj.isSystem);
}

// ---------------------------------------------------------------------------
// Field → JSON Schema
// ---------------------------------------------------------------------------

function fieldToJsonSchema(field: FieldMetadata): Record<string, unknown> | null {
  const desc = field.description
    ? `${field.label} — ${field.description}`
    : field.label;

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
          markdown: { type: "string", description: "Markdown content" },
        },
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
      return values.length > 0
        ? { type: "string", enum: values, description: desc }
        : { type: "string", description: desc };
    }

    case "MULTI_SELECT": {
      const values = (field.options ?? []).map((o) => o.value);
      return values.length > 0
        ? { type: "array", items: { type: "string", enum: values }, description: desc }
        : { type: "array", items: { type: "string" }, description: desc };
    }

    case "RATING":
      return {
        type: "string",
        enum: ["RATING_1", "RATING_2", "RATING_3", "RATING_4", "RATING_5"],
        description: desc,
      };

    case "CURRENCY":
      return {
        type: "object",
        description: desc,
        properties: {
          amountMicros: { type: "number", description: "Amount in micros (1 dollar = 1000000)" },
          currencyCode: { type: "string", description: "ISO currency code (e.g. USD, EUR)" },
        },
      };

    case "LINKS":
      return {
        type: "object",
        description: desc,
        properties: {
          primaryLinkUrl: { type: "string", description: "Primary URL" },
          primaryLinkLabel: { type: "string", description: "Primary link label" },
        },
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
          addressLng: { type: "number", description: "Longitude" },
        },
      };

    case "PHONES":
      return {
        type: "object",
        description: desc,
        properties: {
          primaryPhoneNumber: { type: "string", description: "Primary phone number" },
          primaryPhoneCountryCode: { type: "string", description: "Country code (e.g. +1)" },
          additionalPhones: { type: "array", items: { type: "string" }, description: "Additional phone numbers" },
        },
      };

    case "EMAILS":
      return {
        type: "object",
        description: desc,
        properties: {
          primaryEmail: { type: "string", description: "Primary email address" },
          additionalEmails: { type: "array", items: { type: "string" }, description: "Additional email addresses" },
        },
      };

    case "FULL_NAME":
      return {
        type: "object",
        description: desc,
        properties: {
          firstName: { type: "string", description: "First name" },
          lastName: { type: "string", description: "Last name" },
        },
      };

    case "ARRAY":
      return { type: "array", items: { type: "string" }, description: desc };

    case "RAW_JSON":
      return { type: "object", description: desc };

    default:
      // Unknown type — skip
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tool generation
// ---------------------------------------------------------------------------

function getWritableFields(fields: FieldMetadata[]): FieldMetadata[] {
  return fields.filter(
    (f) => f.isActive && !f.isSystem && !SKIP_FIELD_TYPES.has(f.type)
  );
}

function buildPropertiesSchema(
  fields: FieldMetadata[]
): { properties: Record<string, unknown>; required: string[] } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of fields) {
    const schema = fieldToJsonSchema(field);
    if (!schema) continue;

    properties[field.name] = schema;

    if (!field.isNullable && field.defaultValue === undefined) {
      required.push(field.name);
    }
  }

  return { properties, required };
}

export function generateTools(objects: ObjectMetadata[]): GeneratedSchema {
  const tools: ToolDefinition[] = [];
  const dispatch = new Map<string, DispatchEntry>();

  for (const obj of objects) {
    const singular = toSnakeCase(obj.nameSingular);
    const plural = toSnakeCase(obj.namePlural);
    const endpoint = `/rest/${obj.namePlural}`;
    const writableFields = getWritableFields(obj.fields);
    const { properties, required } = buildPropertiesSchema(writableFields);

    const base = {
      endpoint,
      labelSingular: obj.labelSingular,
      labelPlural: obj.labelPlural,
    };

    // --- create ---
    const createName = `create_${singular}`;
    tools.push({
      name: createName,
      description: `Create a new ${obj.labelSingular} in Twenty CRM`,
      inputSchema: {
        type: "object" as const,
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    });
    dispatch.set(createName, { action: "create", ...base });

    // --- get ---
    const getName = `get_${singular}`;
    tools.push({
      name: getName,
      description: `Get a ${obj.labelSingular} by ID`,
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: `${obj.labelSingular} ID` },
        },
        required: ["id"],
      },
    });
    dispatch.set(getName, { action: "get", ...base });

    // --- update ---
    const updateName = `update_${singular}`;
    tools.push({
      name: updateName,
      description: `Update an existing ${obj.labelSingular}`,
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: `${obj.labelSingular} ID` },
          ...properties,
        },
        required: ["id"],
      },
    });
    dispatch.set(updateName, { action: "update", ...base });

    // --- list ---
    const listName = `list_${plural}`;
    tools.push({
      name: listName,
      description: `List ${obj.labelPlural} with optional filtering and pagination`,
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Max results to return (default: 20)" },
          offset: { type: "number", description: "Number of results to skip (default: 0)" },
          search: { type: "string", description: "Search term" },
          filter: { type: "object", description: "Field-level filters as { fieldName: value } pairs" },
          order_by: { type: "string", description: "Field name to order by" },
          order_direction: { type: "string", enum: ["AscNullsFirst", "AscNullsLast", "DescNullsFirst", "DescNullsLast"], description: "Sort direction" },
        },
      },
    });
    dispatch.set(listName, { action: "list", ...base });

    // --- delete ---
    const deleteName = `delete_${singular}`;
    tools.push({
      name: deleteName,
      description: `Delete a ${obj.labelSingular} from Twenty CRM`,
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: `${obj.labelSingular} ID to delete` },
        },
        required: ["id"],
      },
    });
    dispatch.set(deleteName, { action: "delete", ...base });
  }

  // --- search_records (cross-object) ---
  const searchName = "search_records";
  tools.push({
    name: searchName,
    description: "Search across multiple object types in Twenty CRM",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        object_types: {
          type: "array",
          items: { type: "string" },
          description: `Object types to search (available: ${objects.map((o) => o.namePlural).join(", ")})`,
        },
        limit: { type: "number", description: "Results per object type (default: 10)" },
      },
      required: ["query"],
    },
  });
  dispatch.set(searchName, {
    action: "search",
    endpoint: "/rest",
    labelSingular: "Record",
    labelPlural: "Records",
  });

  return { tools, dispatch };
}
