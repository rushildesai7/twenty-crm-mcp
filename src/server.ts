import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
}

interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

export function createServer({ apiKey, baseUrl = "https://api.twenty.com" }: ServerConfig): Server {
  if (!apiKey) {
    throw new Error("apiKey is required");
  }

  const server = new Server(
    { name: "twenty-crm", version: "1.1.0" },
    { capabilities: { tools: {} } }
  );

  // --- HTTP helper ---

  async function makeRequest(endpoint: string, method = "GET", data: unknown = null): Promise<unknown> {
    const url = `${baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`API request failed: ${msg}`);
    }
  }

  // --- Field mapping helpers ---

  function mapPersonData(data: Record<string, unknown>): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const name: Record<string, unknown> = {};
      if (data.firstName !== undefined) name.firstName = data.firstName;
      if (data.lastName !== undefined) name.lastName = data.lastName;
      mapped.name = name;
    }
    if (data.email !== undefined) mapped.emails = { primaryEmail: data.email };
    if (data.phone !== undefined) mapped.phones = { primaryPhoneNumber: data.phone };
    if (data.linkedinUrl !== undefined) mapped.linkedinLink = { primaryLinkUrl: data.linkedinUrl };
    if (data.jobTitle !== undefined) mapped.jobTitle = data.jobTitle;
    if (data.city !== undefined) mapped.city = data.city;
    if (data.companyId !== undefined) mapped.companyId = data.companyId;
    if (data.avatarUrl !== undefined) mapped.avatarUrl = data.avatarUrl;
    return mapped;
  }

  function mapCompanyData(data: Record<string, unknown>): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    // Pass-through fields
    if (data.name !== undefined) mapped.name = data.name;
    if (data.employees !== undefined) mapped.employees = data.employees;
    if (data.idealCustomerProfile !== undefined) mapped.idealCustomerProfile = data.idealCustomerProfile;
    if (data.position !== undefined) mapped.position = data.position;
    if (data.accountOwnerId !== undefined) mapped.accountOwnerId = data.accountOwnerId;
    if (data.stageFocus !== undefined) mapped.stageFocus = data.stageFocus;
    if (data.fundType !== undefined) mapped.fundType = data.fundType;
    if (data.hasFellowshipAccelerator !== undefined) mapped.hasFellowshipAccelerator = data.hasFellowshipAccelerator;

    // LINKS composite fields
    if (data.domainName !== undefined) {
      mapped.domainName = { primaryLinkLabel: "", primaryLinkUrl: data.domainName, secondaryLinks: [] };
    }
    if (data.linkedinUrl !== undefined) {
      mapped.linkedinLink = { primaryLinkLabel: "", primaryLinkUrl: data.linkedinUrl, secondaryLinks: [] };
    }
    if (data.xUrl !== undefined) {
      mapped.xLink = { primaryLinkLabel: "", primaryLinkUrl: data.xUrl, secondaryLinks: [] };
    }

    // ADDRESS composite field
    if (data.address !== undefined) {
      mapped.address = {
        addressStreet1: data.address,
        addressStreet2: "",
        addressCity: "",
        addressPostcode: "",
        addressState: "",
        addressCountry: "",
        addressLat: null,
        addressLng: null,
      };
    }

    // CURRENCY composite field (ARR in whole dollars → amountMicros)
    if (data.annualRecurringRevenue !== undefined) {
      mapped.annualRecurringRevenue = {
        amountMicros: String(Math.round((data.annualRecurringRevenue as number) * 1_000_000)),
        currencyCode: (data.currencyCode as string) || "USD",
      };
    }

    return mapped;
  }

  function mapNoteData(data: Record<string, unknown>): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    if (data.title !== undefined) mapped.title = data.title;
    if (data.body !== undefined) mapped.bodyV2 = data.body;
    if (data.position !== undefined) mapped.position = data.position;
    return mapped;
  }

  function mapTaskData(data: Record<string, unknown>): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    if (data.title !== undefined) mapped.title = data.title;
    if (data.body !== undefined) mapped.bodyV2 = data.body;
    if (data.dueAt !== undefined) mapped.dueAt = data.dueAt;
    if (data.status !== undefined) mapped.status = data.status;
    if (data.assigneeId !== undefined) mapped.assigneeId = data.assigneeId;
    if (data.position !== undefined) mapped.position = data.position;
    return mapped;
  }

  // --- CRUD methods ---

  // People
  async function createPerson(data: Record<string, unknown>): Promise<ToolResponse> {
    const mapped = mapPersonData(data);
    const result = await makeRequest("/rest/people", "POST", mapped);
    return { content: [{ type: "text", text: `Created person: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function getPerson(id: string): Promise<ToolResponse> {
    const result = await makeRequest(`/rest/people/${id}`);
    return { content: [{ type: "text", text: `Person details: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function updatePerson(data: Record<string, unknown>): Promise<ToolResponse> {
    const { id, ...updateData } = data;
    const mapped = mapPersonData(updateData);
    const result = await makeRequest(`/rest/people/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated person: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function listPeople(params: Record<string, unknown> = {}): Promise<ToolResponse> {
    const { limit = 20, offset = 0, search, companyId } = params;
    let endpoint = `/rest/people?limit=${limit}&offset=${offset}`;
    if (search) endpoint += `&search=${encodeURIComponent(search as string)}`;
    if (companyId) endpoint += `&companyId=${companyId}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `People list: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function deletePerson(id: string): Promise<ToolResponse> {
    await makeRequest(`/rest/people/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted person with ID: ${id}` }] };
  }

  // Companies
  async function createCompany(data: Record<string, unknown>): Promise<ToolResponse> {
    const mapped = mapCompanyData(data);
    const result = await makeRequest("/rest/companies", "POST", mapped);
    return { content: [{ type: "text", text: `Created company: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function getCompany(id: string): Promise<ToolResponse> {
    const result = await makeRequest(`/rest/companies/${id}`);
    return { content: [{ type: "text", text: `Company details: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function updateCompany(data: Record<string, unknown>): Promise<ToolResponse> {
    const { id, ...updateData } = data;
    const mapped = mapCompanyData(updateData);
    const result = await makeRequest(`/rest/companies/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated company: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function listCompanies(params: Record<string, unknown> = {}): Promise<ToolResponse> {
    const { limit = 20, offset = 0, search } = params;
    let endpoint = `/rest/companies?limit=${limit}&offset=${offset}`;
    if (search) endpoint += `&search=${encodeURIComponent(search as string)}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `Companies list: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function deleteCompany(id: string): Promise<ToolResponse> {
    await makeRequest(`/rest/companies/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted company with ID: ${id}` }] };
  }

  // Notes
  async function createNote(data: Record<string, unknown>): Promise<ToolResponse> {
    const mapped = mapNoteData(data);
    const result = await makeRequest("/rest/notes", "POST", mapped);
    return { content: [{ type: "text", text: `Created note: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function getNote(id: string): Promise<ToolResponse> {
    const result = await makeRequest(`/rest/notes/${id}`);
    return { content: [{ type: "text", text: `Note details: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function listNotes(params: Record<string, unknown> = {}): Promise<ToolResponse> {
    const { limit = 20, offset = 0, search } = params;
    let endpoint = `/rest/notes?limit=${limit}&offset=${offset}`;
    if (search) endpoint += `&search=${encodeURIComponent(search as string)}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `Notes list: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function updateNote(data: Record<string, unknown>): Promise<ToolResponse> {
    const { id, ...updateData } = data;
    const mapped = mapNoteData(updateData);
    const result = await makeRequest(`/rest/notes/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated note: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function deleteNote(id: string): Promise<ToolResponse> {
    await makeRequest(`/rest/notes/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted note with ID: ${id}` }] };
  }

  // Tasks
  async function createTask(data: Record<string, unknown>): Promise<ToolResponse> {
    const mapped = mapTaskData(data);
    const result = await makeRequest("/rest/tasks", "POST", mapped);
    return { content: [{ type: "text", text: `Created task: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function getTask(id: string): Promise<ToolResponse> {
    const result = await makeRequest(`/rest/tasks/${id}`);
    return { content: [{ type: "text", text: `Task details: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function listTasks(params: Record<string, unknown> = {}): Promise<ToolResponse> {
    const { limit = 20, offset = 0, status, assigneeId } = params;
    let endpoint = `/rest/tasks?limit=${limit}&offset=${offset}`;
    if (status) endpoint += `&status=${status}`;
    if (assigneeId) endpoint += `&assigneeId=${assigneeId}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `Tasks list: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function updateTask(data: Record<string, unknown>): Promise<ToolResponse> {
    const { id, ...updateData } = data;
    const mapped = mapTaskData(updateData);
    const result = await makeRequest(`/rest/tasks/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated task: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function deleteTask(id: string): Promise<ToolResponse> {
    await makeRequest(`/rest/tasks/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted task with ID: ${id}` }] };
  }

  // Metadata
  async function getMetadataObjects(): Promise<ToolResponse> {
    const result = await makeRequest("/rest/metadata/objects");
    return { content: [{ type: "text", text: `Metadata objects: ${JSON.stringify(result, null, 2)}` }] };
  }

  async function getObjectMetadata(objectName: string): Promise<ToolResponse> {
    const result = await makeRequest(`/rest/metadata/objects/${objectName}`);
    return { content: [{ type: "text", text: `Metadata for ${objectName}: ${JSON.stringify(result, null, 2)}` }] };
  }

  // Search
  async function searchRecords(params: Record<string, unknown>): Promise<ToolResponse> {
    const { query, objectTypes = ["people", "companies"], limit = 10 } = params;
    const results: Record<string, unknown> = {};

    for (const objectType of objectTypes as string[]) {
      try {
        const endpoint = `/rest/${objectType}?search=${encodeURIComponent(query as string)}&limit=${limit}`;
        results[objectType] = await makeRequest(endpoint);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        results[objectType] = { error: msg };
      }
    }

    return { content: [{ type: "text", text: `Search results for "${query}": ${JSON.stringify(results, null, 2)}` }] };
  }

  // --- Tool handler registration ---

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // People Management
        {
          name: "create_person",
          description: "Create a new person in Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              firstName: { type: "string", description: "First name" },
              lastName: { type: "string", description: "Last name" },
              email: { type: "string", description: "Email address" },
              phone: { type: "string", description: "Phone number" },
              jobTitle: { type: "string", description: "Job title" },
              companyId: { type: "string", description: "Company ID to associate with" },
              linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
              city: { type: "string", description: "City" },
              avatarUrl: { type: "string", description: "Avatar image URL" },
            },
            required: ["firstName", "lastName"],
          },
        },
        {
          name: "get_person",
          description: "Get details of a specific person by ID",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Person ID" },
            },
            required: ["id"],
          },
        },
        {
          name: "update_person",
          description: "Update an existing person's information",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Person ID" },
              firstName: { type: "string", description: "First name" },
              lastName: { type: "string", description: "Last name" },
              email: { type: "string", description: "Email address" },
              phone: { type: "string", description: "Phone number" },
              jobTitle: { type: "string", description: "Job title" },
              companyId: { type: "string", description: "Company ID" },
              linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
              city: { type: "string", description: "City" },
            },
            required: ["id"],
          },
        },
        {
          name: "list_people",
          description: "List people with optional filtering and pagination",
          inputSchema: {
            type: "object" as const,
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              search: { type: "string", description: "Search term for name or email" },
              companyId: { type: "string", description: "Filter by company ID" },
            },
          },
        },
        {
          name: "delete_person",
          description: "Delete a person from Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Person ID to delete" },
            },
            required: ["id"],
          },
        },

        // Company Management
        {
          name: "create_company",
          description: "Create a new company in Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: { type: "string", description: "Company name" },
              domainName: { type: "string", description: "Company website URL (used to fetch company icon)" },
              address: { type: "string", description: "Company address (street)" },
              employees: { type: "integer", description: "Number of employees" },
              linkedinUrl: { type: "string", description: "LinkedIn company URL" },
              xUrl: { type: "string", description: "X (Twitter) URL" },
              annualRecurringRevenue: { type: "number", description: "Annual recurring revenue in whole dollars/euros" },
              currencyCode: { type: "string", description: "Currency code for ARR (e.g. USD, EUR). Default: USD" },
              idealCustomerProfile: { type: "boolean", description: "Ideal Customer Profile: whether the company is the most suitable and valuable customer" },
              position: { type: "number", description: "Company record position" },
              accountOwnerId: { type: "string", description: "Account owner workspace member ID (UUID)" },
              stageFocus: { type: "array", items: { type: "string", enum: ["PRE_SEED", "SEED", "SERIES_A"] }, description: "Investment stage focus" },
              hasFellowshipAccelerator: { type: "boolean", description: "Has fellowship/accelerator program" },
              fundType: { type: "string", enum: ["VC", "ANGEL", "FAMILY_OFFICE", "ACCELERATOR", "OTHER"], description: "Type of fund" },
            },
            required: ["name"],
          },
        },
        {
          name: "get_company",
          description: "Get details of a specific company by ID",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Company ID" },
            },
            required: ["id"],
          },
        },
        {
          name: "update_company",
          description: "Update an existing company's information",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Company ID" },
              name: { type: "string", description: "Company name" },
              domainName: { type: "string", description: "Company website URL (used to fetch company icon)" },
              address: { type: "string", description: "Company address (street)" },
              employees: { type: "integer", description: "Number of employees" },
              linkedinUrl: { type: "string", description: "LinkedIn company URL" },
              xUrl: { type: "string", description: "X (Twitter) URL" },
              annualRecurringRevenue: { type: "number", description: "Annual recurring revenue in whole dollars/euros" },
              currencyCode: { type: "string", description: "Currency code for ARR (e.g. USD, EUR). Default: USD" },
              idealCustomerProfile: { type: "boolean", description: "Ideal Customer Profile: whether the company is the most suitable and valuable customer" },
              position: { type: "number", description: "Company record position" },
              accountOwnerId: { type: "string", description: "Account owner workspace member ID (UUID)" },
              stageFocus: { type: "array", items: { type: "string", enum: ["PRE_SEED", "SEED", "SERIES_A"] }, description: "Investment stage focus" },
              hasFellowshipAccelerator: { type: "boolean", description: "Has fellowship/accelerator program" },
              fundType: { type: "string", enum: ["VC", "ANGEL", "FAMILY_OFFICE", "ACCELERATOR", "OTHER"], description: "Type of fund" },
            },
            required: ["id"],
          },
        },
        {
          name: "list_companies",
          description: "List companies with optional filtering and pagination",
          inputSchema: {
            type: "object" as const,
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              search: { type: "string", description: "Search term for company name" },
            },
          },
        },
        {
          name: "delete_company",
          description: "Delete a company from Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Company ID to delete" },
            },
            required: ["id"],
          },
        },

        // Notes Management
        {
          name: "create_note",
          description: "Create a new note in Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              title: { type: "string", description: "Note title" },
              body: { type: "string", description: "Note content" },
              position: { type: "number", description: "Position for ordering" },
            },
            required: ["title", "body"],
          },
        },
        {
          name: "get_note",
          description: "Get details of a specific note by ID",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Note ID" },
            },
            required: ["id"],
          },
        },
        {
          name: "list_notes",
          description: "List notes with optional filtering and pagination",
          inputSchema: {
            type: "object" as const,
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              search: { type: "string", description: "Search term for note title or content" },
            },
          },
        },
        {
          name: "update_note",
          description: "Update an existing note",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Note ID" },
              title: { type: "string", description: "Note title" },
              body: { type: "string", description: "Note content" },
              position: { type: "number", description: "Position for ordering" },
            },
            required: ["id"],
          },
        },
        {
          name: "delete_note",
          description: "Delete a note from Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Note ID to delete" },
            },
            required: ["id"],
          },
        },

        // Tasks Management
        {
          name: "create_task",
          description: "Create a new task in Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              title: { type: "string", description: "Task title" },
              body: { type: "string", description: "Task description" },
              dueAt: { type: "string", description: "Due date (ISO 8601 format)" },
              status: { type: "string", description: "Task status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
              assigneeId: { type: "string", description: "ID of person assigned to task" },
              position: { type: "number", description: "Position for ordering" },
            },
            required: ["title"],
          },
        },
        {
          name: "get_task",
          description: "Get details of a specific task by ID",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Task ID" },
            },
            required: ["id"],
          },
        },
        {
          name: "list_tasks",
          description: "List tasks with optional filtering and pagination",
          inputSchema: {
            type: "object" as const,
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              status: { type: "string", description: "Filter by status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
              assigneeId: { type: "string", description: "Filter by assignee ID" },
            },
          },
        },
        {
          name: "update_task",
          description: "Update an existing task",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Task ID" },
              title: { type: "string", description: "Task title" },
              body: { type: "string", description: "Task description" },
              dueAt: { type: "string", description: "Due date (ISO 8601 format)" },
              status: { type: "string", description: "Task status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
              assigneeId: { type: "string", description: "ID of person assigned to task" },
            },
            required: ["id"],
          },
        },
        {
          name: "delete_task",
          description: "Delete a task from Twenty CRM",
          inputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Task ID to delete" },
            },
            required: ["id"],
          },
        },

        // Metadata Operations
        {
          name: "get_metadata_objects",
          description: "Get all object types and their metadata",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "get_object_metadata",
          description: "Get metadata for a specific object type",
          inputSchema: {
            type: "object" as const,
            properties: {
              objectName: { type: "string", description: "Object name (e.g., 'people', 'companies')" },
            },
            required: ["objectName"],
          },
        },

        // Search
        {
          name: "search_records",
          description: "Search across multiple object types",
          inputSchema: {
            type: "object" as const,
            properties: {
              query: { type: "string", description: "Search query" },
              objectTypes: {
                type: "array",
                items: { type: "string" },
                description: "Object types to search (e.g., ['people', 'companies'])",
              },
              limit: { type: "number", description: "Number of results per object type" },
            },
            required: ["query"],
          },
        },
      ],
    };
  });

  // --- Tool call dispatch ---

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        // People
        case "create_person": return await createPerson(args as Record<string, unknown>);
        case "get_person": return await getPerson((args as Record<string, unknown>).id as string);
        case "update_person": return await updatePerson(args as Record<string, unknown>);
        case "list_people": return await listPeople(args as Record<string, unknown>);
        case "delete_person": return await deletePerson((args as Record<string, unknown>).id as string);

        // Companies
        case "create_company": return await createCompany(args as Record<string, unknown>);
        case "get_company": return await getCompany((args as Record<string, unknown>).id as string);
        case "update_company": return await updateCompany(args as Record<string, unknown>);
        case "list_companies": return await listCompanies(args as Record<string, unknown>);
        case "delete_company": return await deleteCompany((args as Record<string, unknown>).id as string);

        // Notes
        case "create_note": return await createNote(args as Record<string, unknown>);
        case "get_note": return await getNote((args as Record<string, unknown>).id as string);
        case "list_notes": return await listNotes(args as Record<string, unknown>);
        case "update_note": return await updateNote(args as Record<string, unknown>);
        case "delete_note": return await deleteNote((args as Record<string, unknown>).id as string);

        // Tasks
        case "create_task": return await createTask(args as Record<string, unknown>);
        case "get_task": return await getTask((args as Record<string, unknown>).id as string);
        case "list_tasks": return await listTasks(args as Record<string, unknown>);
        case "update_task": return await updateTask(args as Record<string, unknown>);
        case "delete_task": return await deleteTask((args as Record<string, unknown>).id as string);

        // Metadata
        case "get_metadata_objects": return await getMetadataObjects();
        case "get_object_metadata": return await getObjectMetadata((args as Record<string, unknown>).objectName as string);

        // Search
        case "search_records": return await searchRecords(args as Record<string, unknown>);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
    }
  });

  return server;
}
