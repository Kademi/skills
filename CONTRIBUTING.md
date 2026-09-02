# Contributing

## Repository layout

```
.claude-plugin/marketplace.json     Claude Code marketplace
.cursor-plugin/marketplace.json     Cursor marketplace (metadata.pluginRoot = plugins)
.agents/plugins/marketplace.json    Codex / ChatGPT marketplace
plugins/
  kademi/                           one plugin
    plugin.json                     Agent Plugins 1.0 manifest
    .claude-plugin/plugin.json      Claude Code manifest
    .cursor-plugin/plugin.json      Cursor manifest
    .codex-plugin/plugin.json       Codex manifest
    skills/<skill-name>/SKILL.md    the skills this plugin contributes
    rules/<name>.mdc                glob-scoped rules (Cursor)
    mcp.json / .mcp.json            MCP servers, when a plugin has them
scripts/validate-plugins.mjs        checks the marketplaces against what is on disk
```

Four manifests per plugin because no single format is read by every client yet. They are small and
must agree on `name` and `version`; `scripts/validate-plugins.mjs` enforces that.

## Adding a plugin

1. `mkdir -p plugins/<name>` and put its `skills/` and, if it has MCP servers, its MCP config
   inside.
2. Copy the four manifests from `plugins/kademi/`, setting `name` to the directory name.
3. Add one entry per marketplace file:
   - `.claude-plugin/marketplace.json` — `"source": "./plugins/<name>"`
   - `.cursor-plugin/marketplace.json` — `"source": "<name>"` (resolved under `metadata.pluginRoot`)
   - `.agents/plugins/marketplace.json` — `"source": { "source": "local", "path": "./plugins/<name>" }`
4. Run the validator.

```
node scripts/validate-plugins.mjs
```

### Skills and rules are not the same thing

A **skill** activates when its `description` matches the task the developer described. A **rule**
activates when the agent opens a file matching its `globs`, whatever the task was.

That distinction is why this plugin ships both. "Fix this bug" opens a `.js` file without matching
any skill description, and the agent needs to know *before it types* that the file is sandboxed
Nashorn where `===` against a platform id is always false. Four rules cover the cases where the
file itself is misleading:

| Rule | Fires on | Because |
|---|---|---|
| `kademi-graaljs.mdc` | `**/APP-INF/**/*.mjs` | Looks like Node; is a sandboxed GraalJS engine |
| `kademi-nashorn.mdc` | `**/APP-INF/**/*.js` | Same, plus ES5.1 and Java-value comparison rules |
| `kademi-velocity.mdc` | `**/theme/**/*.html` | Looks like HTML; is a server-rendered Velocity template |
| `kademi-controllers-xml.mdc` | `**/APP-INF/controllers.xml` | Decides the engine and which files load at all |

Keep rules short and make them **point at the skill** rather than restate it. A rule is the "you
are about to get this wrong" note; the skill is the documentation.

**Only Cursor reads them.** Claude Code plugins cannot ship rules - they contribute context through
skills, agents and hooks - and neither Agent Plugins 1.0 nor Codex defines a rules component. The
directory is inert in those clients, which is why nothing that only exists in a rule may be
load-bearing.

### Adding MCP servers

A plugin declares its MCP servers in a file at the plugin root. The clients disagree on the name:
Agent Plugins 1.0 and Cursor read `mcp.json`, Codex reads `.mcp.json`. **Ship both with the same
content** - the validator fails if only one is present - and point the Codex manifest at its copy
with `"mcpServers": "./.mcp.json"`.

## Writing a skill

Skills are Markdown only - no scripts, nothing platform-specific. Keep each `SKILL.md` under 500
lines and move depth into `references/`. Validate with
[`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref):

```
skills-ref validate ./plugins/<plugin>/skills/<skill-name>
node scripts/validate-plugins.mjs
```

`scripts/validate-plugins.mjs` is repo tooling, not part of a skill - the no-scripts rule applies to
what ships inside a plugin.

