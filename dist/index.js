#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
function createServer({ apiKey, baseUrl = "https://api.twenty.com" }) {
  if (!apiKey) {
    throw new Error("apiKey is required");
  }
  const server2 = new Server(
    { name: "twenty-crm", version: "1.1.0" },
    { capabilities: { tools: {} } }
  );
  async function makeRequest(endpoint, method = "GET", data = null) {
    const url = `${baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`API request failed: ${msg}`);
    }
  }
  function mapPersonData(data) {
    const mapped = {};
    if (data.firstName !== void 0 || data.lastName !== void 0) {
      const name = {};
      if (data.firstName !== void 0) name.firstName = data.firstName;
      if (data.lastName !== void 0) name.lastName = data.lastName;
      mapped.name = name;
    }
    if (data.email !== void 0) mapped.emails = { primaryEmail: data.email };
    if (data.phone !== void 0) mapped.phones = { primaryPhoneNumber: data.phone };
    if (data.linkedinUrl !== void 0) mapped.linkedinLink = { primaryLinkUrl: data.linkedinUrl };
    if (data.jobTitle !== void 0) mapped.jobTitle = data.jobTitle;
    if (data.city !== void 0) mapped.city = data.city;
    if (data.companyId !== void 0) mapped.companyId = data.companyId;
    if (data.avatarUrl !== void 0) mapped.avatarUrl = data.avatarUrl;
    return mapped;
  }
  function mapCompanyData(data) {
    const mapped = {};
    if (data.name !== void 0) mapped.name = data.name;
    if (data.employees !== void 0) mapped.employees = data.employees;
    if (data.idealCustomerProfile !== void 0) mapped.idealCustomerProfile = data.idealCustomerProfile;
    if (data.position !== void 0) mapped.position = data.position;
    if (data.accountOwnerId !== void 0) mapped.accountOwnerId = data.accountOwnerId;
    if (data.stageFocus !== void 0) mapped.stageFocus = data.stageFocus;
    if (data.fundType !== void 0) mapped.fundType = data.fundType;
    if (data.hasFellowshipAccelerator !== void 0) mapped.hasFellowshipAccelerator = data.hasFellowshipAccelerator;
    if (data.domainName !== void 0) {
      mapped.domainName = { primaryLinkLabel: "", primaryLinkUrl: data.domainName, secondaryLinks: [] };
    }
    if (data.linkedinUrl !== void 0) {
      mapped.linkedinLink = { primaryLinkLabel: "", primaryLinkUrl: data.linkedinUrl, secondaryLinks: [] };
    }
    if (data.xUrl !== void 0) {
      mapped.xLink = { primaryLinkLabel: "", primaryLinkUrl: data.xUrl, secondaryLinks: [] };
    }
    if (data.address !== void 0) {
      mapped.address = {
        addressStreet1: data.address,
        addressStreet2: "",
        addressCity: "",
        addressPostcode: "",
        addressState: "",
        addressCountry: "",
        addressLat: null,
        addressLng: null
      };
    }
    if (data.annualRecurringRevenue !== void 0) {
      mapped.annualRecurringRevenue = {
        amountMicros: String(Math.round(data.annualRecurringRevenue * 1e6)),
        currencyCode: data.currencyCode || "USD"
      };
    }
    return mapped;
  }
  function mapNoteData(data) {
    const mapped = {};
    if (data.title !== void 0) mapped.title = data.title;
    if (data.body !== void 0) mapped.bodyV2 = data.body;
    if (data.position !== void 0) mapped.position = data.position;
    return mapped;
  }
  function mapTaskData(data) {
    const mapped = {};
    if (data.title !== void 0) mapped.title = data.title;
    if (data.body !== void 0) mapped.bodyV2 = data.body;
    if (data.dueAt !== void 0) mapped.dueAt = data.dueAt;
    if (data.status !== void 0) mapped.status = data.status;
    if (data.assigneeId !== void 0) mapped.assigneeId = data.assigneeId;
    if (data.position !== void 0) mapped.position = data.position;
    return mapped;
  }
  async function createPerson(data) {
    const mapped = mapPersonData(data);
    const result = await makeRequest("/rest/people", "POST", mapped);
    return { content: [{ type: "text", text: `Created person: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function getPerson(id) {
    const result = await makeRequest(`/rest/people/${id}`);
    return { content: [{ type: "text", text: `Person details: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function updatePerson(data) {
    const { id, ...updateData } = data;
    const mapped = mapPersonData(updateData);
    const result = await makeRequest(`/rest/people/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated person: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function listPeople(params = {}) {
    const { limit = 20, offset = 0, search, companyId } = params;
    let endpoint = `/rest/people?limit=${limit}&offset=${offset}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (companyId) endpoint += `&companyId=${companyId}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `People list: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function deletePerson(id) {
    await makeRequest(`/rest/people/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted person with ID: ${id}` }] };
  }
  async function createCompany(data) {
    const mapped = mapCompanyData(data);
    const result = await makeRequest("/rest/companies", "POST", mapped);
    return { content: [{ type: "text", text: `Created company: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function getCompany(id) {
    const result = await makeRequest(`/rest/companies/${id}`);
    return { content: [{ type: "text", text: `Company details: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function updateCompany(data) {
    const { id, ...updateData } = data;
    const mapped = mapCompanyData(updateData);
    const result = await makeRequest(`/rest/companies/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated company: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function listCompanies(params = {}) {
    const { limit = 20, offset = 0, search } = params;
    let endpoint = `/rest/companies?limit=${limit}&offset=${offset}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `Companies list: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function deleteCompany(id) {
    await makeRequest(`/rest/companies/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted company with ID: ${id}` }] };
  }
  async function createNote(data) {
    const mapped = mapNoteData(data);
    const result = await makeRequest("/rest/notes", "POST", mapped);
    return { content: [{ type: "text", text: `Created note: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function getNote(id) {
    const result = await makeRequest(`/rest/notes/${id}`);
    return { content: [{ type: "text", text: `Note details: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function listNotes(params = {}) {
    const { limit = 20, offset = 0, search } = params;
    let endpoint = `/rest/notes?limit=${limit}&offset=${offset}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `Notes list: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function updateNote(data) {
    const { id, ...updateData } = data;
    const mapped = mapNoteData(updateData);
    const result = await makeRequest(`/rest/notes/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated note: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function deleteNote(id) {
    await makeRequest(`/rest/notes/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted note with ID: ${id}` }] };
  }
  async function createTask(data) {
    const mapped = mapTaskData(data);
    const result = await makeRequest("/rest/tasks", "POST", mapped);
    return { content: [{ type: "text", text: `Created task: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function getTask(id) {
    const result = await makeRequest(`/rest/tasks/${id}`);
    return { content: [{ type: "text", text: `Task details: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function listTasks(params = {}) {
    const { limit = 20, offset = 0, status, assigneeId } = params;
    let endpoint = `/rest/tasks?limit=${limit}&offset=${offset}`;
    if (status) endpoint += `&status=${status}`;
    if (assigneeId) endpoint += `&assigneeId=${assigneeId}`;
    const result = await makeRequest(endpoint);
    return { content: [{ type: "text", text: `Tasks list: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function updateTask(data) {
    const { id, ...updateData } = data;
    const mapped = mapTaskData(updateData);
    const result = await makeRequest(`/rest/tasks/${id}`, "PUT", mapped);
    return { content: [{ type: "text", text: `Updated task: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function deleteTask(id) {
    await makeRequest(`/rest/tasks/${id}`, "DELETE");
    return { content: [{ type: "text", text: `Successfully deleted task with ID: ${id}` }] };
  }
  async function getMetadataObjects() {
    const result = await makeRequest("/rest/metadata/objects");
    return { content: [{ type: "text", text: `Metadata objects: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function getObjectMetadata(objectName) {
    const result = await makeRequest(`/rest/metadata/objects/${objectName}`);
    return { content: [{ type: "text", text: `Metadata for ${objectName}: ${JSON.stringify(result, null, 2)}` }] };
  }
  async function searchRecords(params) {
    const { query, objectTypes = ["people", "companies"], limit = 10 } = params;
    const results = {};
    for (const objectType of objectTypes) {
      try {
        const endpoint = `/rest/${objectType}?search=${encodeURIComponent(query)}&limit=${limit}`;
        results[objectType] = await makeRequest(endpoint);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results[objectType] = { error: msg };
      }
    }
    return { content: [{ type: "text", text: `Search results for "${query}": ${JSON.stringify(results, null, 2)}` }] };
  }
  server2.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // People Management
        {
          name: "create_person",
          description: "Create a new person in Twenty CRM",
          inputSchema: {
            type: "object",
            properties: {
              firstName: { type: "string", description: "First name" },
              lastName: { type: "string", description: "Last name" },
              email: { type: "string", description: "Email address" },
              phone: { type: "string", description: "Phone number" },
              jobTitle: { type: "string", description: "Job title" },
              companyId: { type: "string", description: "Company ID to associate with" },
              linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
              city: { type: "string", description: "City" },
              avatarUrl: { type: "string", description: "Avatar image URL" }
            },
            required: ["firstName", "lastName"]
          }
        },
        {
          name: "get_person",
          description: "Get details of a specific person by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Person ID" }
            },
            required: ["id"]
          }
        },
        {
          name: "update_person",
          description: "Update an existing person's information",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Person ID" },
              firstName: { type: "string", description: "First name" },
              lastName: { type: "string", description: "Last name" },
              email: { type: "string", description: "Email address" },
              phone: { type: "string", description: "Phone number" },
              jobTitle: { type: "string", description: "Job title" },
              companyId: { type: "string", description: "Company ID" },
              linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
              city: { type: "string", description: "City" }
            },
            required: ["id"]
          }
        },
        {
          name: "list_people",
          description: "List people with optional filtering and pagination",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              search: { type: "string", description: "Search term for name or email" },
              companyId: { type: "string", description: "Filter by company ID" }
            }
          }
        },
        {
          name: "delete_person",
          description: "Delete a person from Twenty CRM",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Person ID to delete" }
            },
            required: ["id"]
          }
        },
        // Company Management
        {
          name: "create_company",
          description: "Create a new company in Twenty CRM",
          inputSchema: {
            type: "object",
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
              fundType: { type: "string", enum: ["VC", "ANGEL", "FAMILY_OFFICE", "ACCELERATOR", "OTHER"], description: "Type of fund" }
            },
            required: ["name"]
          }
        },
        {
          name: "get_company",
          description: "Get details of a specific company by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Company ID" }
            },
            required: ["id"]
          }
        },
        {
          name: "update_company",
          description: "Update an existing company's information",
          inputSchema: {
            type: "object",
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
              fundType: { type: "string", enum: ["VC", "ANGEL", "FAMILY_OFFICE", "ACCELERATOR", "OTHER"], description: "Type of fund" }
            },
            required: ["id"]
          }
        },
        {
          name: "list_companies",
          description: "List companies with optional filtering and pagination",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              search: { type: "string", description: "Search term for company name" }
            }
          }
        },
        {
          name: "delete_company",
          description: "Delete a company from Twenty CRM",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Company ID to delete" }
            },
            required: ["id"]
          }
        },
        // Notes Management
        {
          name: "create_note",
          description: "Create a new note in Twenty CRM",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Note title" },
              body: { type: "string", description: "Note content" },
              position: { type: "number", description: "Position for ordering" }
            },
            required: ["title", "body"]
          }
        },
        {
          name: "get_note",
          description: "Get details of a specific note by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Note ID" }
            },
            required: ["id"]
          }
        },
        {
          name: "list_notes",
          description: "List notes with optional filtering and pagination",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              search: { type: "string", description: "Search term for note title or content" }
            }
          }
        },
        {
          name: "update_note",
          description: "Update an existing note",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Note ID" },
              title: { type: "string", description: "Note title" },
              body: { type: "string", description: "Note content" },
              position: { type: "number", description: "Position for ordering" }
            },
            required: ["id"]
          }
        },
        {
          name: "delete_note",
          description: "Delete a note from Twenty CRM",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Note ID to delete" }
            },
            required: ["id"]
          }
        },
        // Tasks Management
        {
          name: "create_task",
          description: "Create a new task in Twenty CRM",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              body: { type: "string", description: "Task description" },
              dueAt: { type: "string", description: "Due date (ISO 8601 format)" },
              status: { type: "string", description: "Task status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
              assigneeId: { type: "string", description: "ID of person assigned to task" },
              position: { type: "number", description: "Position for ordering" }
            },
            required: ["title"]
          }
        },
        {
          name: "get_task",
          description: "Get details of a specific task by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Task ID" }
            },
            required: ["id"]
          }
        },
        {
          name: "list_tasks",
          description: "List tasks with optional filtering and pagination",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of results to return (default: 20)" },
              offset: { type: "number", description: "Number of results to skip (default: 0)" },
              status: { type: "string", description: "Filter by status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
              assigneeId: { type: "string", description: "Filter by assignee ID" }
            }
          }
        },
        {
          name: "update_task",
          description: "Update an existing task",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Task ID" },
              title: { type: "string", description: "Task title" },
              body: { type: "string", description: "Task description" },
              dueAt: { type: "string", description: "Due date (ISO 8601 format)" },
              status: { type: "string", description: "Task status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
              assigneeId: { type: "string", description: "ID of person assigned to task" }
            },
            required: ["id"]
          }
        },
        {
          name: "delete_task",
          description: "Delete a task from Twenty CRM",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Task ID to delete" }
            },
            required: ["id"]
          }
        },
        // Metadata Operations
        {
          name: "get_metadata_objects",
          description: "Get all object types and their metadata",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "get_object_metadata",
          description: "Get metadata for a specific object type",
          inputSchema: {
            type: "object",
            properties: {
              objectName: { type: "string", description: "Object name (e.g., 'people', 'companies')" }
            },
            required: ["objectName"]
          }
        },
        // Search
        {
          name: "search_records",
          description: "Search across multiple object types",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              objectTypes: {
                type: "array",
                items: { type: "string" },
                description: "Object types to search (e.g., ['people', 'companies'])"
              },
              limit: { type: "number", description: "Number of results per object type" }
            },
            required: ["query"]
          }
        }
      ]
    };
  });
  server2.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        // People
        case "create_person":
          return await createPerson(args);
        case "get_person":
          return await getPerson(args.id);
        case "update_person":
          return await updatePerson(args);
        case "list_people":
          return await listPeople(args);
        case "delete_person":
          return await deletePerson(args.id);
        // Companies
        case "create_company":
          return await createCompany(args);
        case "get_company":
          return await getCompany(args.id);
        case "update_company":
          return await updateCompany(args);
        case "list_companies":
          return await listCompanies(args);
        case "delete_company":
          return await deleteCompany(args.id);
        // Notes
        case "create_note":
          return await createNote(args);
        case "get_note":
          return await getNote(args.id);
        case "list_notes":
          return await listNotes(args);
        case "update_note":
          return await updateNote(args);
        case "delete_note":
          return await deleteNote(args.id);
        // Tasks
        case "create_task":
          return await createTask(args);
        case "get_task":
          return await getTask(args.id);
        case "list_tasks":
          return await listTasks(args);
        case "update_task":
          return await updateTask(args);
        case "delete_task":
          return await deleteTask(args.id);
        // Metadata
        case "get_metadata_objects":
          return await getMetadataObjects();
        case "get_object_metadata":
          return await getObjectMetadata(args.objectName);
        // Search
        case "search_records":
          return await searchRecords(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${msg}` }] };
    }
  });
  return server2;
}

// index.ts
var server = createServer({
  apiKey: process.env.TWENTY_API_KEY,
  baseUrl: process.env.TWENTY_BASE_URL
});
var transport = new StdioServerTransport();
await server.connect(transport);
console.error("Twenty CRM MCP server running on stdio");
