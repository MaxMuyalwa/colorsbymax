# colorsbymax MCP server

An [MCP](https://modelcontextprotocol.io) server that teaches AI agents (Claude Code, Cursor, GitHub Copilot, Codex, Google Antigravity, Gemini CLI, Grok Build, Claude Desktop, Windsurf, Kiro, Zed and others) to use [colorsbymax](https://github.com/MaxMuyalwa/colorsbymax), the live theme switcher for websites.

With it, you can ask your agent things like:

- *"Add colorsbymax to this project."*
- *"Find me a calm ocean theme that works in dark mode."*
- *"Build a theme around our brand colours #e63946 and #1d3557."*
- *"Does white text pass on #f59e0b?"*
- *"I've picked my colours. Make them the default and hide the switcher in production."*

The agent inspects the project, gets the exact install command and edits for its framework, and uses the same theme library, palette builder and contrast checks as the colorsbymax panel.

## Add it to your editor

It runs with `npx`, so there's nothing to install first. Node 18 or later.

**Adding the server doesn't change your site by itself.** It gives your agent the tools. After adding it:

1. **Start a new chat or session** in your project. Agents load MCP servers when a session starts.
2. **Ask:** *"Add colorsbymax to this project."* The agent installs colorsbymax and adds the one line it needs.
3. **Run your site.** The colour button appears in the bottom-right corner.

**Claude Code**

```bash
claude mcp add colorsbymax -- npx -y colorsbymax-mcp
```

Add `--scope user` to have it in every project. If your terminal says `claude` isn't found, ask Claude Code itself to add the server `npx -y colorsbymax-mcp`.

**Cursor**: `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` for every project:

```json
{
  "mcpServers": {
    "colorsbymax": { "command": "npx", "args": ["-y", "colorsbymax-mcp"] }
  }
}
```

**VS Code** (Copilot agent mode): `.vscode/mcp.json`:

```json
{
  "servers": {
    "colorsbymax": { "command": "npx", "args": ["-y", "colorsbymax-mcp"] }
  }
}
```

**Claude Desktop**: add the same `mcpServers` entry as Cursor to `claude_desktop_config.json` (Settings → Developer → Edit Config), then restart it.

**GitHub Copilot CLI** (saved to `~/.copilot/mcp-config.json`)

```bash
copilot mcp add colorsbymax -- npx -y colorsbymax-mcp
```

**Codex** (OpenAI; the CLI and IDE extension share `~/.codex/config.toml`)

```bash
codex mcp add colorsbymax -- npx -y colorsbymax-mcp
```

**Google Antigravity**: in the agent panel, open **… → MCP Servers → Manage MCP Servers → View raw config**, add the same `mcpServers` entry as Cursor to `~/.gemini/config/mcp_config.json` (or `.agents/mcp_config.json` for one project), and save. It reloads by itself.

**Gemini CLI**: the same `mcpServers` entry in `~/.gemini/settings.json` (or `.gemini/settings.json` in your project), then restart Gemini CLI.

**Grok Build** (xAI; saved to `~/.grok/config.toml`, or `.grok/config.toml` with `--scope project`)

```bash
grok mcp add colorsbymax -- npx -y colorsbymax-mcp
```

**Windsurf, Kiro, JetBrains, Cline and Roo** take the same `mcpServers` entry as Cursor: Windsurf in `~/.codeium/windsurf/mcp_config.json`, Kiro in `.kiro/settings/mcp.json` (use the full path to `npx` there if it can't start), JetBrains under Settings → Tools → AI Assistant → Model Context Protocol (or Junie → MCP Settings), and Cline and Roo in their MCP Servers view.

**Zed**, in `settings.json`:

```json
{ "context_servers": { "colorsbymax": { "command": "npx", "args": ["-y", "colorsbymax-mcp"] } } }
```

**opencode**, in `opencode.json`:

```json
{ "mcp": { "colorsbymax": { "type": "local", "command": ["npx", "-y", "colorsbymax-mcp"] } } }
```

**Any other MCP client**: the command is `npx`, with `-y colorsbymax-mcp` as its arguments. Most take the same `mcpServers` entry as Cursor.

On Windows, if your editor can't start `npx`, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "colorsbymax-mcp"]`.

## Tools

| Tool | What it does |
| --- | --- |
| `setup_plan` | Inspects a project folder and returns the install command and the exact edits to add the colour button. It covers Vite, Create React App, Next.js (app and pages routers), Remix and React Router, Gatsby, Astro, Nuxt, SvelteKit, Vue and Svelte apps, and plain HTML sites with no bundler. It says whether the site paints with colorsbymax's `--color-*` tokens or will be re-coloured automatically, and reports an existing setup and any available update. |
| `find_themes` | Searches the 720 built-in themes (Max's picks and the library) by name or mood, by category (pastel, earthy, ocean, moody…), or by how close they are to a brand colour, in light or dark. |
| `get_theme` | Returns every token of a theme, with its contrast report. Formats: theme JSON (the panel's Import/export format), CSS variables, Tailwind v4 `@theme`, or a `defaultTheme` config. |
| `theme_from_colours` | Builds a complete, contrast-checked 35-token theme around 1–8 colours, as the panel does for an uploaded image. It can return the dark version too. |
| `check_contrast` | Checks a theme the way the panel does (text on the page and on cards, button text, icons and more) and returns the smallest fixes. It can also check plain pairs of foreground and background colours. |
| `finish` | Once the colours are chosen: **keep** makes them every visitor's default and hides the button in production; **bring-back** shows it again; **hide-locally** hides it on one device; **remove** uninstalls colorsbymax and keeps the colours in your CSS. |
| `docs` | colorsbymax's documentation by topic: overview, quick start, full setup, tokens, finishing, updating, and the full TypeScript API. |

It also has two prompts, `add-colorsbymax` and `finish-colorsbymax`, which some editors show as slash commands.

## What it can and can't do

- **It reads your project but never changes it.** `setup_plan` scans source files to detect the framework and how colours are painted. The agent makes the edits it describes, so you review them as usual.
- **Network:** one request to the npm registry, to check for the newest colorsbymax version. It works offline too.
- **Picking colours happens on the page.** The agent can suggest and build themes, but the best way to choose is in the colorsbymax panel on your running site. You can paste theme JSON from the agent into the panel's Import/export, or copy the panel's theme to the agent for `finish`.

## Development

The server bundles colorsbymax's colour engine from `../src`, so the MCP server and the panel always agree.

```bash
# from the repo root
npm run build:mcp

# from mcp/
node test/smoke.mjs          # starts the server over stdio and calls every tool
node test/smoke.mjs --show   # the same, printing each result
```

To try a local build in an editor, point it at the file: `"command": "node", "args": ["/path/to/colorsbymax/mcp/dist/server.js"]`.

## Licence

MIT © Max Muyalwa (mrmaxdesigns)
