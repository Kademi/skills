---
name: kademi-ai
description: Use when adding AI capability to a Kademi app - prompt functions that Kademi's AI agents and MCP clients can call, agent definitions with their instructions, timers, event handlers and workflows, and MCP servers. Use when registering promptFunctionsProviders or agentDefProviders, writing tool descriptions and argument schemas, returning the result or err envelope from a tool, choosing which surfaces a function is offered on, connecting an external assistant such as Claude to Kademi over MCP, or exposing an app's capability to an LLM.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: ai

Three things an app can contribute, and they build on each other:

| What | You write | Who calls it |
|---|---|---|
| **Prompt functions** | A `promptFunctionsProviders` implementation in your app's server-side JS | Kademi's AI agents, and MCP clients, depending on the `supportedUsage` you declare |
| **Agent definitions** | An `agentDefProviders` implementation, or an agent XML file | The platform, on a timer, on a platform event, or when a user chats to the agent |
| **MCP servers** | An `adminMcpController()` / `websiteMcpController()` registration | External AI assistants such as Claude Code, Claude Desktop and claude.ai |

The usual path is only the first one. Register prompt functions with `supportedUsage: ['Agents', 'mcp_admin']`
and they are immediately callable by Kademi's built-in agents *and* by any MCP client connected to the
account. You only write your own MCP server when you need a surface the shared one does not give you.

## Prompt functions

A provider is a plain object with `name()` and `functions(type, excludeConsent)`, registered at load time
from a JS file listed in your app's `controllers.xml`:

```js
/* global formatter, services, controllerMappings */

const myProvider = {
    name: () => 'MyApp',
    functions: (type, excludeConsent) => {
        if (formatter.isEmpty(type)) {
            return [];
        }
        return [listWidgetsFunction()].filter((f) => {
            if (excludeConsent && f.requiresConsent) {
                return false;
            }
            return formatter.gt(f.supportedUsage.indexOf(type), -1);
        });
    }
};

controllerMappings.newImplementationBuilder('promptFunctionsProviders').implementationObject(myProvider).build();
```

`type` is the calling surface. A function is offered only if that surface appears in its `supportedUsage`:

| `supportedUsage` value | Surface |
|---|---|
| `Agents` | Kademi's agent framework - agents running timers, events and tasks, and the admin assistant chat |
| `mcp_admin` | The admin MCP server |
| `mcp_website` | The website MCP server |
| `ai-search` | The admin menu AI search |

Tools are namespaced `providerName_functionName` wherever they are offered, so the provider above exposes
`MyApp_listWidgets`. Keep `name()` stable: agent definitions and stored tool allow-lists refer to it.

### The result envelope

Every function's `func` returns one of exactly two shapes, or throws:

```js
return { result: someStructuredValue };  // success
return { err: 'a message the model can act on' };  // handled failure
throw new Error('...');  // system failure - rolls the request transaction back
```

- **Return the object.** Never `JSON.stringify` it yourself. The caller serialises it once, and the MCP
  transport puts the same envelope in `structuredContent` and sets `isError` when `err` is present.
- **An empty result is a success**, not an error: `{ result: [] }`.
- **`result` is the value itself.** For a list, `{ result: records }`, not `{ result: { widgets: records } }`.
  Use an object only when there really are several distinct fields, e.g. `{ result: { updatedCount, jobId } }`.
- **Do not wrap `func` in a blanket try/catch.** Returning `{ err }` after a partial write commits that
  partial state; throwing rolls it back. Catch only a specific, expected failure you can turn into an
  actionable message, and re-throw if a mutation already ran.

**Read [references/prompt-functions.md](references/prompt-functions.md) before you write a provider** - it
has the full field reference, argument schemas, validators, consent, error handling, and two worked
examples, and it is the only place the whole function definition is spelled out.

## Writing tool descriptions the model can use

The description and the schemas are the entire interface. The model cannot read your code, and a bad
description costs a wrong call plus a retry.

- **Say what it does and when to use it.** "Returns active auctions visible to the current user. Use this
  before quoting a bid, to confirm the auction is still open." A description that only names the operation
  leaves the model guessing which of five similar tools to reach for.
- **Plain ASCII everywhere.** Hyphen `-` not an em dash, straight `'` and `"` not curly quotes, `...` not an
  ellipsis glyph. This applies to `name`, `title`, `description`, every schema `description`, `startMessage`
  and `consentMessage`. Non-ASCII punctuation costs extra tokens and reads identically to the model. The
  same rule applies to any instructions text you write for an agent.
- **Describe every property**, in both `parameters` and `outputSchema`: what it is, its format (JSON string,
  ISO-8601, an enum of allowed values), and where the value comes from. A bare `{ type: 'string' }` forces a
  probe call, which is the round trip the schema exists to remove.
- **Scope the result to what was asked.** Return the fields the caller needs, not the whole record. A tool
  that dumps 60 columns for a question about two of them burns the context the model needs to answer.
- **Never return raw entities.** Build a plain object with the fields you mean to expose. Handing back a
  platform object serialises whatever it happens to hold, including relations the caller may not be allowed
  to see, and its shape changes under you.
- **Keep responses small and cap them.** Page or limit large queries, and where a match set is too big to
  return, hand back a count and a handle or a job reference rather than thousands of rows.
- **Give every tool a `startMessage`.** Without one the user watches a spinner with nothing against it while
  your tool runs.

## Agent definitions

An agent is a definition plus a running instance per user. The definition supplies the system prompt, the
tools the agent may call, the groups whose members get it, and any timers, event handlers and workflows.
See [AgentDef](https://docs.kademi.co/ref/templating/md/AgentDef.md).

An app supplies definitions in code through an `agentDefProviders` implementation, using
[AgentDefBuilder](https://docs.kademi.co/ref/templating/md/AgentDefBuilder.md) from
[AgentManager](https://docs.kademi.co/ref/templating/md/AgentManager.md):

```js
/* global services, formatter, controllerMappings */

controllerMappings
    .newImplementationBuilder('agentDefProviders')
    .implementationObject({
        getAgentDefs: function () {
            var def = services.agentManager
                .newAgentDefBuilder()
                .name('WidgetWatcher.xml')
                .title('Widget Watcher')
                .instructions('You look after widget stock levels. Only use information your functions return.')
                .functions(formatter.toList(['MyApp_listWidgets', 'MyApp_reorderWidget']))
                .groups(formatter.toList(['administrators']))
                .build();
            return formatter.toList([def]);
        }
    })
    .build();
```

The same definition can be written as an XML file, which is also the form an administrator sees and edits
in the account's agent manager. A stored definition of the same name replaces the app's version outright.

```xml
<agent>
    <title>Widget Watcher</title>
    <instructions>You look after widget stock levels.</instructions>
    <groups>
        <string>administrators</string>
    </groups>
    <functions>
        <string>MyApp_listWidgets</string>
    </functions>
    <timers>
        <timer>
            <name>dailyCheck</name>
            <instructions>List widgets below their reorder level and report them.</instructions>
            <timerUnit>d</timerUnit>
            <timerMultiple>1</timerMultiple>
            <timerTime>09:00</timerTime>
        </timer>
    </timers>
</agent>
```

- [AgentDefTimer](https://docs.kademi.co/ref/templating/md/AgentDefTimer.md) - run instructions on a schedule.
- [AgentDefEventHandler](https://docs.kademi.co/ref/templating/md/AgentDefEventHandler.md) - run instructions
  when a platform event fires, optionally buffering events by time or count first.
- [AgentWorkflowDef](https://docs.kademi.co/ref/templating/md/AgentWorkflowDef.md) and
  [AgentWorkflowStep](https://docs.kademi.co/ref/templating/md/AgentWorkflowStep.md) - a named series of steps,
  each with a completion type deciding when it is done and what follows.

Read [references/agent-defs.md](references/agent-defs.md) when you are writing an agent definition, or when
a timer, event handler or workflow step is not firing the way you expected - it has the completion types,
the full XML shape and worked timer, event and workflow examples.

## MCP tools

Kademi ships an MCP server for the admin console and one for websites. Any prompt function that lists
`mcp_admin` or `mcp_website` in its `supportedUsage` appears there automatically, with its `parameters` as
the tool's `inputSchema`, its `outputSchema` as declared, and `readOnly` / `destructive` / `openWorldHint`
mapped to the standard MCP annotations. There is nothing else to register.

For an app that needs its own server, register one with
[McpMappingBuilder](https://docs.kademi.co/ref/templating/md/McpMappingBuilder.md) via
`controllerMappings.adminMcpController()` or `controllerMappings.websiteMcpController()` - see
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md).

Setup, roles and client configuration for account users are covered in the knowledge base article
[Connecting to Kademi over MCP](https://docs.kademi.co/blogs/docs-kb/connecting-to-kademi-over-mcp/).

Read [references/kmcp.md](references/kmcp.md) when the shared servers do not give you the surface you need
and you are registering your own - it has the tool spec shape and the call handler.

## Safety

Anything you expose is reachable by a model acting for a user, and a model will call it with arguments no
form would ever produce. Three rules cover most of it.

**Scope every query to what the caller may see.** Filter by the caller's organisation, team or website the
same way your admin pages do. A tool that takes an id and looks it up with no ownership check turns any AI
surface into an enumeration oracle. Where the tool takes a query, apply your scoping on top of whatever the
model supplied rather than trusting it.

**Honour the caller's privileges, not the app's.** Resolve the acting user from
`services.userManager.currentProfile` and check against that. Declare the roles your tool needs in its
`roles` array - the platform filters the tool out of the offer for users who lack them, and re-checks before
running it:

```js
roles: ['WidgetAdmin'],
```

An **empty or missing `roles` means the function is offered to nobody**, so it is not a shortcut for "public".
Holders of the account `Administrator` role pass every role check.

Prefer explicit parameters over ambient context for the entities a tool acts on. A tool that reads the
current agent's context works under an agent and silently misbehaves when the same tool is called over MCP.

**Require confirmation for destructive actions.** Set `requiresConsent: true` and `destructive: true` on
anything that deletes, disables, removes or irreversibly changes data, and supply a `consentMessage(params)`
that says exactly what is about to happen and to how many records. Set the annotation fields honestly from
what the code actually does, not from the tool's name:

| Tool does | `readOnly` | `destructive` | `openWorldHint` |
|---|---|---|---|
| query / list / search / get | `true` | `false` | `false` |
| create / update / send / award | `false` | `false` | `false` |
| delete / disable / remove / unpublish | `false` | `true` | `false` |
| anything leaving Kademi (email, chat, third-party API) | as above | as above | `true` |

A `destructive` tool prompts the user in MCP clients even when `requiresConsent` was left false, so there is
no need to set both for the prompt alone - but `requiresConsent` is what gates the call inside Kademi's own
agents, so set it there.

## References

- [references/prompt-functions.md](references/prompt-functions.md) - read before writing a provider: the
  whole function definition, fields, argument schemas, validators, the result envelope, error handling,
  worked read and write examples.
- [references/agent-defs.md](references/agent-defs.md) - read when writing an agent definition: agent XML
  and builders, timers, event handlers, workflows, steps and every completion type.
- [references/kmcp.md](references/kmcp.md) - read when registering your own MCP server: what the shared
  servers already expose, the tool spec shape and the call handler.

## Related skills

- **`kademi-server-js`** - a prompt functions provider is server-side JavaScript under `APP-INF/`, and
  `controllers.xml` has to load the file or the provider never registers at all. It also covers roles and
  privileges, which decide who a function is offered to.
- **`kademi-api-reference`** - confirm any manager or entity method your tool calls exists, and its
  signature, before you call it.
- **`kademi-integrations`** - the right answer when a tool would read or write more data than fits in one
  request: hand the work to an integration and have the tool report on it.
- **`kademi-journeys`** - when the agent-driven step belongs inside a journey rather than in an agent of
  its own.
- **`kademi-app-development`** - project layout, app versions and publishing.
