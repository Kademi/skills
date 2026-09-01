# Kademi Skills

[Agent Skills](https://agentskills.io) for building on the [Kademi](https://kademi.co) platform.
Works with any skills-compatible agent - Claude Code, Cursor, Copilot, Codex, Gemini CLI and others.

Kademi is extended by **repository apps**: bundles of server-side JavaScript, admin pages,
Velocity templates and client-side assets, installed into an account from a marketplace. These
skills teach an agent how to build them.

## Skills

| Skill | Covers |
|---|---|
| [`kademi-app-development`](plugins/kademi/skills/kademi-app-development) | Start here. What an app is, how it is laid out, the development loop, and which skill to use next |
| [`kademi-api-reference`](plugins/kademi/skills/kademi-api-reference) | Looking up platform classes, services and methods in the public API reference |
| [`kademi-server-js`](plugins/kademi/skills/kademi-server-js) | Server-side JavaScript under `APP-INF/`, `controllers.xml`, routes, services, queries |
| [`kademi-admin-ui`](plugins/kademi/skills/kademi-admin-ui) | Admin pages, portlets, client-side JS and CSS, UX conventions |
| [`kademi-themes`](plugins/kademi/skills/kademi-themes) | Velocity templates, KEditor components, websites and themes |
| [`kademi-integrations`](plugins/kademi/skills/kademi-integrations) | Pipelines, import/export, SFTP and email endpoints, map-reduce, sync jobs |
| [`kademi-journeys`](plugins/kademi/skills/kademi-journeys) | Custom journey goal and action node types, journey fields, funnel events |
| [`kademi-ai`](plugins/kademi/skills/kademi-ai) | Prompt functions, agent definitions, MCP tools |
| [`kademi-rewards`](plugins/kademi/skills/kademi-rewards) | Points allocation sources, custom points rule types, expiry rules, record matching, vouchers |
| [`kademi-commerce`](plugins/kademi/skills/kademi-commerce) | Stores, catalogue, carts, checkout rules, payment providers, promotion mechanics |
| [`kademi-security`](plugins/kademi/skills/kademi-security) | Credentials and secrets, request input, authorisation, multi-tenancy, IDP rules |
| [`kademi-coding-standards`](plugins/kademi/skills/kademi-coding-standards) | The house coding standards, and the review to run before handing work back |

## Install

The repo is a **plugin marketplace**: it holds one or more plugins under `plugins/`, and declares
them in the manifest each client reads. Today there is one plugin, `kademi`, carrying the skills
above.

**Claude Code**

```
/plugin marketplace add Kademi/skills
/plugin install kademi@kademi
```

**Cursor** — a workspace admin imports the repo under Dashboard → Plugins → Import from Repo; the
plugins then install from your team marketplace.

**Codex / ChatGPT** — the repo carries `.agents/plugins/marketplace.json`, so cloning it into a
workspace makes its plugins available to install.

**VS Code, Copilot and other [Agent Plugins 1.0](https://agent-plugins.org/specification)
clients** — each plugin directory is a standalone Agent Plugin. Install
`plugins/<name>` the way your client installs a plugin directory; the repo root is a marketplace,
not a plugin, so pointing a client at the root will not work.

**Anything else**

Clone the repo and point your agent at `plugins/kademi/skills/`, or copy the skill folders you want
into wherever your agent loads skills from.

```
git clone https://github.com/Kademi/skills.git
```

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

## API reference

These skills deliberately do not duplicate the platform API. They resolve class and method
lookups against the public reference:

- HTML: <https://docs.kademi.co/ref/templating/>
- Markdown, one file per class: <https://docs.kademi.co/ref/templating/md/index.md>

## Contributing

Skills are Markdown only - no scripts, nothing platform-specific. Keep each `SKILL.md` under 500
lines and move depth into `references/`. Validate with
[`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref):

```
skills-ref validate ./plugins/<plugin>/skills/<skill-name>
node scripts/validate-plugins.mjs
```

`scripts/validate-plugins.mjs` is repo tooling, not part of a skill - the no-scripts rule applies to
what ships inside a plugin.

## Licence

Apache-2.0. See [LICENSE](LICENSE).
