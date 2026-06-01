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

The MCP server uses **Streamable HTTP transport** (MCP protocol version 2025-03-26) with JSON-RPC 2.0 messages.

All requests are `POST` to `/v1/mcp`. Session state is maintained via the `MCP-Session-Id` response header returned after `initialize`.

### Connection flow

1. **POST `/v1/mcp`** with `initialize` JSON-RPC request
2. Server responds with `MCP-Session-Id: mcp_<tokenID>_<timestamp>` header + capabilities
3. **All subsequent POSTs** to `/v1/mcp` must include the `MCP-Session-Id` header
4. Sessions are bound to the token that created them — the same `X-API-Key` must be used

### Session limits

- Max 5 concurrent sessions per API token
- Sessions are in-memory (survive until server restart or inactivity)

## Authentication

All requests require a valid API token via the `X-API-Key` header:

```
X-API-Key: hkp_<64-hex-chars>
```

- Token scoping applies: project-scoped tokens can only access their assigned project
- Tokens are hashed (bcrypt) at rest
- No JWT or user session required — designed for CI/CD and agent use

## Examples

### Initialize session

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "clientInfo": { "name": "test-client", "version": "1.0.0" },
      "capabilities": {}
    }
  }'
```

The response includes the `MCP-Session-Id` header — save this for subsequent requests.

### List projects

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "MCP-Session-Id: mcp_xxx_yyy" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_projects",
      "arguments": {}
    }
  }'
```

### Trigger a scan

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "MCP-Session-Id: mcp_xxx_yyy" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "trigger_scan",
      "arguments": {
        "project_id": "<project-uuid>",
        "scanners": "sast,sca,secrets"
      }
    }
  }'
```

### Query critical findings

```bash
curl -X POST https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..." \
  -H "MCP-Session-Id: mcp_xxx_yyy" \
  -H "Content-Type: application/json" \
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
      }
    }
  }'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Missing or invalid token | Check `X-API-Key` header — must be `hkp_<token>` |
| `400 MCP-Session-Id header required` | Request after `initialize` without session header | Include `MCP-Session-Id` header from initialize response |
| `session not found or expired` | Session expired or wrong session ID | Re-initialize (POST `initialize` again) |
| `405 Method Not Allowed` | Using GET instead of POST | All MCP requests must use POST |
| `429 Too Many Requests` | Max 5 sessions per token exceeded | Close unused sessions or wait for timeout |
| Tool returns error | Wrong project_id or scanner name | Verify UUID format and scanner names |

## Security

- All requests require a valid API token via `X-API-Key` header
- Sessions are bound to the creating token — cross-token session hijacking is prevented
- Token scoping applies: project-scoped tokens can only access their assigned project
- Tokens are hashed (bcrypt) at rest
- No JWT or user session required — designed for CI/CD and agent use

For custom LLM integration, point your agent to the MCP endpoint and it will auto-discover all available tools via the `tools/list` method.
