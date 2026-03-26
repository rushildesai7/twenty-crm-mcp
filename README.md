# Twenty CRM MCP Server

An MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server for [Twenty CRM](https://twenty.com) that **dynamically generates tools from your workspace schema**. Every object and field in your Twenty instance, including custom ones, automatically becomes available to AI agents.

## How It Works

On startup, the server fetches your workspace metadata via Twenty's `/rest/metadata/objects` API. It then generates MCP tools for every active object. Standard (People, Companies, Tasks, Notes, Opportunities, ...) and custom.

For each object, 5 tools are generated:

| Tool | Example | Description |
|---|---|---|
| `create_{object}` | `create_person` | Create a new record |
| `get_{object}` | `get_person` | Get a record by ID |
| `update_{object}` | `update_person` | Update a record by ID |
| `list_{objects}` | `list_people` | List/search/filter records |
| `delete_{object}` | `delete_person` | Delete a record by ID |

Plus `search_records` for cross-object search.

Field types are mapped to proper JSON Schema — composite types like `CURRENCY`, `ADDRESS`, `LINKS`, `FULL_NAME`, `PHONES`, `EMAILS` are represented as nested objects with their sub-properties so agents can discover and use them correctly.

## Deployment

### 1. Local (stdio) — Claude Desktop / Claude Code

Clone and run directly. The pre-built `dist/index.js` is included in the repo. 
Add the following to your `claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "twenty-crm": {
      "command": "node",
      "args": ["/path/to/twenty-crm-mcp/dist/index.js"],
      "env": {
        "TWENTY_API_KEY": "your-api-key",
        "TWENTY_BASE_URL": "https://api.twenty.com"
      }
    }
  }
}
```

### 2. Docker — Self-Hosted HTTP

```bash
docker build -t twenty-crm-mcp .
docker run -e TWENTY_API_KEY=your-key -e TWENTY_BASE_URL=https://api.twenty.com -e MCP_API_KEY=your-secret -p 3000:3000 twenty-crm-mcp
```

The MCP endpoint is at `http://localhost:3000/mcp` (Streamable HTTP transport).

Set `MCP_API_KEY` to require a Bearer token for requests. If unset, the endpoint is open.

### 3. Cloudflare Workers

```bash
npm run deploy
```

Set secrets via `wrangler secret put TWENTY_API_KEY`, etc.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TWENTY_API_KEY` | Yes | Your Twenty CRM API key |
| `TWENTY_BASE_URL` | No | API base URL (default: `https://api.twenty.com`) |
| `PORT` | No | HTTP server port (default: `3000`, HTTP mode only) |
| `MCP_API_KEY` | No | Bearer token to protect the MCP endpoint (HTTP mode only) |

## Development

```bash
npm install
npm run dev       # starts HTTP server with hot reload
npm run build     # builds dist/index.js and dist/serve.js via tsup
npm run serve     # runs the built HTTP server
```

## License

MIT
