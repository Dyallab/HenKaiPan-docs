# MCP Server — LLM Integration

HenKaiPan exposes an MCP (Model Context Protocol) server so LLMs and AI agents can interact with the platform programmatically. This enables natural-language security workflows:

- *"Show me all critical vulnerabilities"*
- *"Run a SCA scan on project X"*
- *"What's our security posture?"*

## Quick Start

### 1. Create an API Token

In the HenKaiPan UI: **Settings → Tokens → Create Token**. Save the token — it's shown only once.

### 2. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "henkaipan": {
      "type": "streamableHttp",
      "url": "https://your-instance.com/v1/mcp",
      "headers": {
        "X-API-Key": "hkp_..."
      }
    }
  }
}
```

Replace `https://your-instance.com/v1/mcp` with your HenKaiPan URL and `hkp_...` with your token.

### 3. Configure Cursor

In Cursor Settings → Features → MCP Servers:

- **Type**: Streamable HTTP
- **URL**: `https://your-instance.com/v1/mcp`
- **Headers**: `{ "X-API-Key": "hkp_..." }`

### 4. Configure OpenCode

Add to the `"mcp"` section of your `opencode.json`:

```json
{
  "mcp": {
    "henkaipan": {
      "type": "remote",
      "url": "https://your-instance.com/v1/mcp",
      "headers": {
        "X-API-Key": "hkp_..."
      },
      "enabled": true
    }
  }
}
```

OpenCode auto-detects the transport from the endpoint — no type change needed.

### 5. Verify

Ask your LLM: *"List my projects in HenKaiPan"* or *"Show me the dashboard summary"*

## Available Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects with optional filter or glob pattern |
| `create_project` | Create a new security project |
| `trigger_scan` | Start a security scan (SAST, SCA, Secrets, IaC, Containers, DAST) |
| `get_scan_status` | Check scan progress and view findings |
| `query_findings` | Search and filter security findings by severity, status, scanner, CVE |
| `get_vulnerabilities` | List correlated vulnerabilities across scanners |
| `get_dashboard_summary` | Get high-level security metrics |

## Protocol

The MCP server uses **Streamable HTTP transport** (MCP protocol version 2026-07-28) with JSON-RPC 2.0 messages.

The server is **stateless** (modern era): there is no `initialize` handshake and no server-side session state. Every request is self-contained and carries its protocol version as the `MCP-Protocol-Version` HTTP header plus the `_meta['io.modelcontextprotocol/protocolVersion']` body field. Each request is authenticated solely by the `X-API-Key` token.

### Connection flow

1. **POST `/v1/mcp`** — each JSON-RPC request is its own HTTP POST.
2. Include the required transport headers on every request: `MCP-Protocol-Version`, `Mcp-Method`, and (for `tools/call`) `Mcp-Name`.
3. The protocol version in the header must match the `_meta` value in the body; mismatches return `400 HeaderMismatch` (`-32020`).
4. No `MCP-Session-Id` header is involved — there are no sessions.

### Discovery and tools

- `server/discover` returns the supported protocol versions, server identity, and capabilities. Clients MAY call it first, or invoke any RPC inline and handle `UnsupportedProtocolVersionError` (`-32022`) if their version is unsupported.
- `tools/list` returns the 7 tools below; `tools/call` invokes one by name.

## Authentication

All requests require a valid API token via the `X-API-Key` header:

```
X-API-Key: hkp_<64-hex-chars>
```

- Token scoping applies: project-scoped tokens can only access their assigned project
- Tokens are hashed (bcrypt) at rest
- No JWT or user session required — designed for CI/CD and agent use

## Examples

### Discover the server

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2026-07-28" \
  -H "Mcp-Method: server/discover" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "server/discover",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { "name": "test-client", "version": "1.0.0" }
      }
    }
  }'
```

The response advertises the supported protocol versions, server identity, and the `tools` capability. No session is created — each subsequent request is independent.

### List projects

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2026-07-28" \
  -H "Mcp-Method: tools/call" \
  -H "Mcp-Name: list_projects" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_projects",
      "arguments": {},
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { "name": "test-client", "version": "1.0.0" }
      }
    }
  }'
```

### Trigger a scan

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2026-07-28" \
  -H "Mcp-Method: tools/call" \
  -H "Mcp-Name: trigger_scan" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "trigger_scan",
      "arguments": {
        "project_id": "<project-uuid>",
        "scanners": "sast,sca,secrets"
      },
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { "name": "test-client", "version": "1.0.0" }
      }
    }
  }'
```

### Query critical findings

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2026-07-28" \
  -H "Mcp-Method: tools/call" \
  -H "Mcp-Name: query_findings" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "query_findings",
      "arguments": {
        "severity": "critical,high",
        "status": "open",
        "limit": 10
      },
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { "name": "test-client", "version": "1.0.0" }
      }
    }
  }'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Missing or invalid token | Check `X-API-Key` header — must be `hkp_<token>` |
| `400 HeaderMismatch (-32020)` | `MCP-Protocol-Version`, `Mcp-Method`, or `Mcp-Name` header missing or not matching the body | Send the required headers on every request; ensure the header value equals the body `method`/`params.name` |
| `400 UnsupportedProtocolVersionError (-32022)` | Requested protocol version not supported, or legacy `initialize` sent | Retry with a version from `data.supported` (currently `2026-07-28`); the server is modern-only and has no `initialize` handshake |
| `403 Forbidden` | Invalid `Origin` header (DNS-rebinding guard) | The `Origin` must be in the server's allowed list; browser clients use an allowed origin, desktop clients omit it |
| `404 Method not found (-32601)` | Unknown JSON-RPC method | Use `server/discover`, `tools/list`, or `tools/call` |
| `405 Method Not Allowed` | Using GET instead of POST | All MCP requests must use POST |
| Tool returns error | Wrong project_id or scanner name | Verify UUID format and scanner names |

## Security

- All requests require a valid API token via `X-API-Key` header
- The server is stateless — every request is authenticated independently; there are no sessions to hijack
- The `Origin` header is validated when present to prevent DNS-rebinding attacks
- Token scoping applies: project-scoped tokens can only access their assigned project
- Tokens are hashed (bcrypt) at rest
- No JWT or user session required — designed for CI/CD and agent use

For custom LLM integration, point your agent to the MCP endpoint and it will auto-discover all available tools via the `tools/list` method.
