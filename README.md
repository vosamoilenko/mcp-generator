# MCP Generator

Interactive terminal UI to scan your system for MCP (Model Context Protocol) configurations and generate `.mcp.json` files for your projects.

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open standard for connecting AI assistants to external tools and data sources. MCP servers provide capabilities like file access, database queries, API integrations, and more.

## Features

- **23 Pre-configured MCPs** - Popular integrations ready to use (Playwright, Supabase, GitHub, Slack, etc.)
- **System Scanner** - Finds your local `.mcp.json` files and adds them to the collection
- **Interactive TUI** - Terminal-based UI for browsing and selecting MCPs
- **Secret Sanitization** - Automatically removes real API keys from collected configs
- **Global Installation** - Install once, use from any project directory

## Installation

```bash
git clone https://github.com/vosamoilenko/mcp-generator.git
cd mcp-generator
npm install
npm link
```

## Usage

```bash
cd ~/my-project
mcpmaker
```

Select MCPs with `Space`, press `Enter` to generate `.mcp.json`.

## Controls

| Key | Action |
|-----|--------|
| `↑` `↓` / `j` `k` | Navigate |
| `Space` | Toggle selection |
| `Enter` | Generate `.mcp.json` and exit |
| `r` | Rescan system |
| `q` / `Esc` | Quit |

## Included MCPs

| MCP | Description |
|-----|-------------|
| playwright | Browser automation and testing |
| supabase | Supabase database access |
| notion | Notion workspace integration |
| figma | Figma design files access |
| github | GitHub repositories and issues |
| gitlab | GitLab repositories and issues |
| linear | Linear issue tracking |
| slack | Slack messaging |
| firebase | Firebase services |
| stripe | Stripe payments API |
| atlassian | Jira and Confluence |
| grafana | Grafana dashboards |
| azure | Azure cloud services |
| jetbrains | JetBrains IDE integration |
| memory | Persistent memory storage |
| firecrawl | Web scraping |
| blender | Blender 3D integration |
| apple | Apple services (macOS) |
| context7 | Documentation lookup |
| pipedream | Workflow automation |
| nx | Nx monorepo tools |
| peekaboo | Screenshot capture |
| chrome-devtools | Chrome DevTools |

## Extending the Collection

### Option 1: Pull Request (recommended)

Add your MCP to `default-mcps.json` and submit a PR:

```json
{
  "mcpServers": {
    "your-mcp": {
      "command": "npx",
      "args": ["-y", "@your/mcp-package"],
      "env": {
        "API_KEY": "<YOUR_API_KEY>"
      },
      "description": "What it does"
    }
  }
}
```

### Option 2: Local Override

Create or edit `.mcp.json` files anywhere in your home directory. Run `mcpmaker` and press `r` to rescan. Your local MCPs will be merged with the defaults.

### Option 3: Edit Collection Directly

Edit `~/.mcp-collection.json` directly. Your changes will persist until the next rescan.

## Rescan

Press `r` in the TUI or run:

```bash
mcp-scan
```

This merges default MCPs with any `.mcp.json` files found in your home directory.

## Requirements

- Node.js >= 18.0.0
- macOS, Linux, or Windows

## License

MIT
