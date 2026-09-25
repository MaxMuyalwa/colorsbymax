import { Bot, Check, MessageSquare, Play, Plug, RefreshCw, Terminal } from 'lucide-react'
import { CodeBlock, MCP_NPM, Reveal, SectionHeading, Tabs, useCopy } from './ui.jsx'

const SERVER = JSON.stringify({ mcpServers: { colorsbymax: { command: 'npx', args: ['-y', 'colorsbymax-mcp'] } } }, null, 2)
const VSCODE = JSON.stringify({ servers: { colorsbymax: { command: 'npx', args: ['-y', 'colorsbymax-mcp'] } } }, null, 2)
const ZED = JSON.stringify({ context_servers: { colorsbymax: { command: 'npx', args: ['-y', 'colorsbymax-mcp'] } } }, null, 2)
const OPENCODE = JSON.stringify({ mcp: { colorsbymax: { type: 'local', command: ['npx', '-y', 'colorsbymax-mcp'] } } }, null, 2)

const STEPS = [
  { Icon: Plug, title: 'Add the server', text: 'Once, with the setup for your editor below.' },
  { Icon: RefreshCw, title: 'Start a new session', text: 'Agents load servers when a session starts.' },
  { Icon: MessageSquare, title: 'Ask', text: '“Add colorsbymax to this project.”' },
  { Icon: Play, title: 'Run your site', text: 'The colour button appears. Start picking.' },
]

// Every agent that runs local MCP servers: most take the same mcpServers JSON; the rest have a
// command or their own file format. Popular ones first.
const EDITORS = [
  { label: 'Claude Code', content: <CodeBlock title="terminal" code="claude mcp add colorsbymax -- npx -y colorsbymax-mcp" />, note: 'Add --scope user to have it in every project. If claude isn’t found, ask Claude Code to add the server itself.' },
  { label: 'Cursor', content: <CodeBlock title=".cursor/mcp.json" code={SERVER} />, note: 'In your project, or ~/.cursor/mcp.json for every project. It then shows under Settings → MCP.' },
  { label: 'VS Code Copilot', content: <CodeBlock title=".vscode/mcp.json" code={VSCODE} />, note: 'Then use it from Copilot Chat in Agent mode.' },
  { label: 'Copilot CLI', content: <CodeBlock title="terminal" code="copilot mcp add colorsbymax -- npx -y colorsbymax-mcp" />, note: 'GitHub Copilot in the terminal. Or type /mcp add inside copilot. It’s saved to ~/.copilot/mcp-config.json.' },
  { label: 'Codex', content: <CodeBlock title="terminal" code="codex mcp add colorsbymax -- npx -y colorsbymax-mcp" />, note: 'OpenAI’s Codex CLI saves it to ~/.codex/config.toml, which the Codex IDE extension shares.' },
  { label: 'Antigravity', content: <CodeBlock title="~/.gemini/config/mcp_config.json" code={SERVER} />, note: 'Google Antigravity: in the agent panel, open … → MCP Servers → Manage MCP Servers → View raw config, add the entry and save. It reloads by itself. For one project, use .agents/mcp_config.json.' },
  { label: 'Gemini CLI', content: <CodeBlock title="~/.gemini/settings.json" code={SERVER} />, note: 'Or .gemini/settings.json in your project. Restart Gemini CLI and check it with /mcp.' },
  {
    label: 'Grok Build',
    content: <CodeBlock title="terminal" code="grok mcp add colorsbymax -- npx -y colorsbymax-mcp" />,
    note: 'xAI’s coding agent saves it to ~/.grok/config.toml (add --scope project for .grok/config.toml). The first start downloads the server, so give it a moment, or raise startup_timeout_sec.',
  },
  { label: 'Claude Desktop', content: <CodeBlock title="claude_desktop_config.json" code={SERVER} />, note: 'Settings → Developer → Edit Config, then restart Claude Desktop.' },
  { label: 'Windsurf', content: <CodeBlock title="~/.codeium/windsurf/mcp_config.json" code={SERVER} />, note: 'Then refresh the MCP servers in Windsurf’s Cascade panel.' },
  { label: 'Kiro', content: <CodeBlock title=".kiro/settings/mcp.json" code={SERVER} />, note: 'In your project, or ~/.kiro/settings/mcp.json for every project. Kiro doesn’t read your shell’s PATH, so use the full path to npx if it can’t start.' },
  { label: 'Zed', content: <CodeBlock title="settings.json" code={ZED} />, note: 'Or Settings → AI → MCP Servers → Add Server → Add Local Server.' },
  { label: 'JetBrains', content: <CodeBlock title="mcp.json" code={SERVER} />, note: 'AI Assistant: Settings → Tools → AI Assistant → Model Context Protocol (MCP). Junie: Settings → Tools → Junie → MCP Settings.' },
  { label: 'Cline · Roo', content: <CodeBlock title="MCP settings" code={SERVER} />, note: 'In the extension’s MCP Servers view, choose Configure (or Edit MCP Settings) and add the entry.' },
  { label: 'opencode', content: <CodeBlock title="opencode.json" code={OPENCODE} />, note: 'In your project, or ~/.config/opencode/opencode.json for every project.' },
  { label: 'Others', content: <CodeBlock title="mcp.json" code={SERVER} />, note: 'Most other MCP clients take this same mcpServers entry: the command is npx, with -y colorsbymax-mcp as its arguments.' },
].map((e) => ({
  label: e.label,
  content: (
    <div className="space-y-3">
      {e.content}
      <p className="text-sm text-ink-secondary">{e.note}</p>
    </div>
  ),
}))

const ASKS = [
  'Add colorsbymax to this project.',
  'Find me a calm ocean theme that also works in dark mode.',
  'Build a theme around our brand colours #e63946 and #1d3557, and check its contrast.',
  'Does white text pass on #f59e0b?',
  'I’ve picked my colours. Make them the default and hide the switcher in production.',
]

const PROMPT =
  "Install the colorsbymax npm package in this project and add import 'colorsbymax/auto' to the app's entry file, so the colorsbymax colour button appears on every page. For Next.js, Remix or other server-rendered apps, load it in the browser only, with import('colorsbymax/auto') inside a useEffect. Don't change anything else."

export function Agents() {
  const [copied, copy] = useCopy()
  return (
    <section aria-labelledby="agents-title" id="agents" className="relative overflow-hidden px-6 py-24">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="dot-grid absolute inset-0 opacity-70" />
        <div className="blob top-10 right-[-6%] h-80 w-80 bg-primary opacity-25" />
      </div>
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="agents-title" eyebrow="Coding agents" title="Let your AI agent do the setup">
          The colorsbymax MCP server gives Claude Code, Cursor, Copilot, Codex, Antigravity, Gemini, Grok and other agents colorsbymax’s own tools. They set it up the
          right way for your framework, find themes, build one from your brand colours, check contrast and finish. It reads your project but
          never changes it: your agent makes the edits, so you review them as usual.
        </SectionHeading>

        <Reveal as="ol" className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="group rounded-3xl border border-border bg-surface p-5 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-shadow/10">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-on-secondary transition-transform duration-300 group-hover:rotate-6">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-ink-muted">Step {i + 1}</span>
              </div>
              <p className="font-display text-lg font-bold text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink-secondary">{text}</p>
            </li>
          ))}
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Reveal className="self-start rounded-[2rem] border border-border bg-surface p-5 shadow-sm md:p-7">
            <h3 className="mb-5 flex items-center gap-2 font-display text-xl font-bold text-ink">
              <Terminal className="h-5 w-5 text-primary" aria-hidden="true" /> Add the server to your editor
            </h3>
            <Tabs label="Editors" tabs={EDITORS} />
            <p className="mt-5 text-xs text-ink-muted">
              Runs with npx, so there’s nothing to install first (Node 18 or later).{' '}
              <a href={MCP_NPM} className="font-semibold text-primary underline underline-offset-2">
                colorsbymax-mcp on npm
              </a>
            </p>
          </Reveal>

          <div className="space-y-6">
            <Reveal delay={100} className="rounded-[2rem] border border-border bg-surface p-5 shadow-sm md:p-7">
              <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-ink">
                <Bot className="h-5 w-5 text-primary" aria-hidden="true" /> Then just ask
              </h3>
              <ul className="space-y-2">
                {ASKS.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      onClick={() => copy(a)}
                      className="group flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm text-ink transition hover:-translate-y-px hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    >
                      <span>“{a}”</span>
                      <span className="shrink-0 text-xs font-semibold text-ink-muted group-hover:text-primary" aria-live="polite">
                        {copied === a ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Copied
                          </span>
                        ) : (
                          'Copy'
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={180} className="rounded-[2rem] bg-secondary p-5 md:p-7">
              <h3 className="font-display text-xl font-bold text-on-secondary">No MCP? Paste this</h3>
              <p className="mt-2 text-sm text-on-secondary">Any coding agent can set it up from a prompt:</p>
              <div className="mt-4">
                <CodeBlock title="prompt" code={PROMPT} wrap />
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
