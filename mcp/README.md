# colorsbymax MCP server

An [MCP](https://modelcontextprotocol.io) server that teaches AI agents (Claude Code, Cursor, VS Code Copilot, Claude Desktop and others) to use [colorsbymax](https://github.com/MaxMuyalwa/colorsbymax), the live theme switcher for websites.

With it, you can ask your agent things like:

- *"Add colorsbymax to this project."*
- *"Find me a calm ocean theme that works in dark mode."*
- *"Build a theme around our brand colours #e63946 and #1d3557."*
- *"Does white text pass on #f59e0b?"*
- *"I've picked my colours. Make them the default and hide the switcher in production."*

The agent inspects the project, gets the exact install command and edits for its framework, and uses the same theme library, palette builder and contrast checks as the colorsbymax panel.

## Add it to your editor

It runs with `npx`, so there's nothing to install first. Node 18 or later.

**Claude Code**

```bash
claude mcp add colorsbymax -- npx -y colorsbymax-mcp
```

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
