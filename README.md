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

**Claude Code**

```
/plugin marketplace add Kademi/skills
/plugin install kademi@kademi
```

**Cursor**

Individual: clone the repo and copy the plugin into Cursor's local plugin directory.

```
git clone https://github.com/Kademi/skills.git
cp -r skills/plugins/kademi ~/.cursor/plugins/local/kademi
```

Whole team: a Teams or Enterprise admin imports `https://github.com/Kademi/skills` under
Dashboard → Settings → Plugins → Team Marketplaces → Import, and everyone installs it from there.

**Codex / ChatGPT**

Workspace admins import the repo as a team marketplace through Codex plugin management. Otherwise
add it to your personal marketplace at `~/.agents/plugins/marketplace.json`, or clone the repo into
the workspace you are working in - Codex reads `.agents/plugins/marketplace.json` from the
repository root.

**Gemini CLI**

Skills are discovered from `~/.gemini/skills/` (alias `~/.agents/skills/`), or per workspace from
`.gemini/skills/`.

```
git clone https://github.com/Kademi/skills.git
cp -r skills/plugins/kademi/skills/* ~/.gemini/skills/
```

**Anything else**

`plugins/kademi/` is a conformant [Agent Plugins 1.0](https://agent-plugins.org/specification)
directory, so a client that supports the standard can install it directly - the repo root is a
marketplace, not a plugin, so point at `plugins/kademi`, not at the root. Failing that, every skill
is a self-contained folder: copy the ones you want to wherever your agent loads skills from.

```
git clone https://github.com/Kademi/skills.git
```

Which skills an agent loads, and when, is decided by each `SKILL.md`'s `description` - see
[Contributing](CONTRIBUTING.md) for how they are structured.

## API reference

These skills deliberately do not duplicate the platform API. They resolve class and method
lookups against the public reference:

- HTML: <https://docs.kademi.co/ref/templating/>
- Markdown, one file per class: <https://docs.kademi.co/ref/templating/md/index.md>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repository layout, how to add a plugin or an
MCP server, how skills and rules differ, and how to validate a change.

## Licence

Apache-2.0. See [LICENSE](LICENSE).
