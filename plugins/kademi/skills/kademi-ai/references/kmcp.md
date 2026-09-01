# MCP tools

Kademi speaks the Model Context Protocol, so an external AI assistant such as Claude Code, Claude Desktop
or claude.ai can call an account's tools on a user's behalf. There are two servers: one on the admin
address and one on the website address.

Setup, addresses, roles and client configuration are covered for account users in the knowledge base
article [Connecting to Kademi over MCP](https://docs.kademi.co/blogs/docs-kb/connecting-to-kademi-over-mcp/).
This page is the app developer's side of it.

## Your prompt functions are already MCP tools

Nothing extra to register. Any prompt function whose `supportedUsage` includes `mcp_admin` or
`mcp_website` is published on that server automatically:

```js
supportedUsage: ['Agents', 'mcp_admin'],
```

The published tool is assembled from the function definition:

| Function field | MCP tool field |
|---|---|
| `providerName_functionName` | `name` |
| `title` | `title` |
| `description` | `description` |
| `parameters` | `inputSchema` |
| `outputSchema` | `outputSchema` |
| `readOnly` | `annotations.readOnlyHint` |
| `destructive` | `annotations.destructiveHint` |
| `openWorldHint` | `annotations.openWorldHint` |
| `requiresConsent` or `destructive` | marks the tool as requiring user interaction, so clients prompt every call |

The result envelope carries across as-is: `{ result }` becomes the tool's `structuredContent`, and
`{ err }` becomes an error result, so a client never reads a handled failure as success. A `validator`
still runs before the call, and its messages come back as the error.

Two consequences worth designing for:

- **`parameters` must be a valid object schema.** A client rejects the whole tool listing if any one tool's
  `inputSchema` is not `type: "object"`, so `parameters: {}` in one app can break tool discovery for
  everything in the account. Always write `type: 'object'` with at least an empty `properties`.
- **Annotations are how a client decides whether to prompt.** Set `readOnly: true` on genuine reads so
  clients stop interrupting the user for them, and `destructive: true` on the dangerous ones so they always
  prompt. Set them from what the code does, not from the tool's name.

## Access

What a connected assistant can do is exactly what the signed-in user's Kademi roles allow - the connection
grants nothing extra. Each tool's own `roles` array is filtered against the user, on top of the base roles
needed to reach the server at all. A user missing a tool's role does not see that tool; the rest still
work.

That makes `roles` the real access boundary for anything you publish over MCP. An empty or missing `roles`
means the function is offered to nobody, so it is not a way to make a tool public.

## Code Mode

An account can connect with `?codemode=true` on the MCP address. Instead of the individual tools, the
client gets two meta-tools and writes a short sandboxed script that chains calls, which is much cheaper for
multi-step and bulk work.

Your tools need no changes for this, but two habits matter more under Code Mode:

- **Return structured data, not prose.** A script filters, sorts and totals your `result` before returning
  it. A tool that hands back a formatted sentence cannot be composed with anything.
- **Make each tool independently usable.** Scripts chain calls, so a tool that only works when called
  immediately after another one, or that depends on ambient conversation state, breaks in a script.

Code Mode grants no extra access: a script can only call the tools the user's roles already allow.

## Registering your own MCP server

Only worth doing when your app needs a surface the shared servers do not give it - its own instructions, a
different role gate, or tools assembled from something other than prompt functions. Register with
[McpMappingBuilder](https://docs.kademi.co/ref/templating/md/McpMappingBuilder.md), reached from
`controllerMappings.adminMcpController()` or `controllerMappings.websiteMcpController()` on
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md). The result is a
[RepoAppMcpMapping](https://docs.kademi.co/ref/templating/md/RepoAppMcpMapping.md).

```js
/* global controllerMappings, formatter, services */

controllerMappings
    .adminMcpController()
    .type('widgets')
    .serverName('Widget Tools')
    .serverVersion('1.0.0')
    .instructions(
        'Tools for inspecting and maintaining widget stock. Read-only tools can be used freely to explore. ' +
        'Confirm with the user before calling anything that changes or removes data.'
    )
    .toolFunction('widgets_loadTools')
    .isPublic(false)
    .addRole('Administrator', 'WidgetAdmin')
    .build();
```

`type` becomes the URL segment for the server, so this one is reached at `/mcp/widgets` on the admin
address. `isPublic(false)` requires authentication; `addRole` restricts it to holders of at least one of
the named roles.

### Declaring the tools

`toolFunction` names a global JS function called during tool discovery. It receives a callback, and you
call that callback once per tool with a spec mirroring the MCP tool wire format plus `functionName`, the
global JS function that handles calls to it:

```js
globalThis.widgets_loadTools = (addTool) => {
    addTool({
        functionName: 'widgets_handleToolCall',
        name: 'listWidgets',
        title: 'List Widgets',
        description: 'Lists widgets for this account, newest first. Use this to find a widget id.',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    description: 'Filter to widgets in this state. One of: active, retired, draft. Omit for all states.'
                }
            }
        },
        outputSchema: {
            type: 'object',
            properties: {
                widgets: {
                    type: 'array',
                    description: 'Matching widgets',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Widget id' },
                            title: { type: 'string', description: 'Widget display name' }
                        }
                    }
                }
            }
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false
        }
    });
};
```

`functionName` and `name` are both required, and `inputSchema` must be present and be an object schema. A
tool whose spec cannot be built is skipped and logged rather than breaking discovery of the others, so a
tool that silently fails to appear is usually a bad schema.

### Handling a call

The handler is invoked with the transport exchange, the tool name, the arguments the client sent, and a
result builder:

```js
globalThis.widgets_handleToolCall = (exchange, toolName, params, builder) => {
    if (formatter.isNotEqual(toolName, 'listWidgets')) {
        builder.isError(true);
        builder.addTextContent('Unknown tool: ' + toolName);
        return;
    }

    var currentProfile = services.userManager.currentProfile;
    if (formatter.isNull(currentProfile)) {
        builder.isError(true);
        builder.addTextContent('Not signed in');
        return;
    }

    // SECURITY: scoped to the caller, never to whatever the client asked for.
    var widgets = services.widgetServices.findWidgetsForOwner(currentProfile, params.status, 20);

    var records = [];
    formatter.foreach(widgets, function (widget) {
        records.push({ id: formatter.toString(widget.id), title: widget.title });
    });

    var payload = { widgets: records };

    // structuredContent for clients that read the outputSchema, plus text for those that do not.
    builder.structuredContent(payload);
    builder.addTextContent(JSON.stringify(payload));
};
```

Builder methods you will use: `structuredContent(obj)`, `addTextContent(text)`, `isError(bool)` and
`meta(map)`. Set `isError(true)` whenever the call failed, so a client does not read a failure as a
successful empty result.

Build the payload as plain objects before handing it over. Passing a platform entity leaks whatever it
happens to hold and changes shape underneath you.

## Checklist

- [ ] Every tool's `inputSchema` / `parameters` is an object schema with `type: 'object'`
- [ ] Descriptions and schema descriptions are plain ASCII and say when to use the tool
- [ ] Annotations match what the code does, and destructive tools are marked so clients prompt
- [ ] Roles are declared, and every query is scoped to the signed-in user
- [ ] Results are plain structured objects, small, and errors are flagged rather than returned as text
