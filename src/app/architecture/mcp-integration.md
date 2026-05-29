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
      "type": "sse",
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

- **Type**: SSE
- **URL**: `https://your-instance.com/v1/mcp`
- **Headers**: `{ "X-API-Key": "hkp_..." }`

### 4. Configure OpenCode (optional)

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

The MCP server uses **SSE transport** with JSON-RPC 2.0 messages.

1. **GET `/v1/mcp`** — SSE stream. Receives an `endpoint` event with the POST URL containing a `session_id`.
2. **POST `/v1/mcp?session_id=xxx`** — Send JSON-RPC requests. Responses arrive as SSE `message` events.

Authentication: `X-API-Key` header with a valid API token.

## Examples

### List projects

```bash
# 1. Connect SSE stream (in another terminal)
curl -N https://your-instance.com/v1/mcp \
  -H "X-API-Key: hkp_..."

# 2. Send JSON-RPC request
curl -X POST "https://your-instance.com/v1/mcp?session_id=mcp_xxx_yyy" \
  -H "X-API-Key: hkp_..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_projects",
      "arguments": {}
    }
  }'
```

### Trigger a scan

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "trigger_scan",
    "arguments": {
      "project_id": "<project-uuid>",
      "scanners": "sast,sca,secrets"
    }
  }
}
```

### Query critical findings

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "query_findings",
    "arguments": {
      "severity": "critical,high",
      "status": "open",
      "limit": 10
    }
  }
}
```

## Security

- All requests require a valid API token via `X-API-Key` header
- Token scoping applies: project-scoped tokens can only access their assigned project
- Tokens are hashed (bcrypt) at rest
- No JWT or user session required — designed for CI/CD and agent use

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Missing or invalid token | Check `X-API-Key` header |
| `session not found` | Session expired or invalid `session_id` | Reconnect SSE stream first |
| Tool returns error | Wrong project_id or scanner name | Verify UUID format and scanner names |

For custom LLM integration, point your agent to the SSE endpoint and it will auto-discover all available tools via the `tools/list` method.
