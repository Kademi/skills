# Prompt functions

An app exposes callable tools to Kademi's AI by registering a **prompt functions provider**. The same
registration serves every AI surface: the agent framework, the admin and website MCP servers, and the admin
AI search. Which surfaces see a given function is decided per function, by its `supportedUsage`.

## 1. Where the code lives

Put the provider in a server-side JS file in your app's `APP-INF` folder and list it as a `<source>` in the
app's `controllers.xml`, the same as any other server-side file:

```xml
<controllers>
    <source>/APP-INF/app.js</source>
    <source>/APP-INF/aiFunctions.js</source>
</controllers>
```

Registration happens at load time, so it runs as a top-level statement in that file.

## 2. The provider

```js
/* global formatter, services, controllerMappings, log */

const myAppFunctionsProvider = {
    // Namespace for every function this provider offers. Tools are exposed as name() + '_' + func.name,
    // so this one produces MyApp_listWidgets. Keep it stable - agent definitions refer to it.
    name: () => 'MyApp',

    /**
     * @param {String} type the calling surface, eg 'Agents' or 'mcp_admin'
     * @param {Boolean} excludeConsent true when the caller cannot show a confirmation prompt, so
     *        functions that need one must be withheld
     * @returns {Array} the function definitions offered to that surface
     */
    functions: (type, excludeConsent) => {
        if (formatter.isEmpty(type)) {
            return [];
        }

        var functions = [listWidgetsFunction(), retireWidgetFunction()];

        return functions.filter((f) => {
            if (excludeConsent && f.requiresConsent) {
                return false;
            }
            return formatter.gt(f.supportedUsage.indexOf(type), -1);
        });
    }
};

controllerMappings
    .newImplementationBuilder('promptFunctionsProviders')
    .implementationObject(myAppFunctionsProvider)
    .build();
```

Both members are required. `functions` is called on every discovery, so keep it cheap - build the
definition objects and return them, do not query anything.

### Surfaces

| `type` value | Surface |
|---|---|
| `Agents` | The agent framework: agents running timers, events and assigned tasks, and the admin assistant chat |
| `mcp_admin` | The admin MCP server |
| `mcp_website` | The website MCP server |
| `ai-search` | The admin menu AI search |

List every surface the tool should reach, e.g. `['Agents', 'mcp_admin']`. A surface not listed never sees
the tool. Individual apps may define their own additional keys for their own AI features.

## 3. The function definition

| Field | Required | Purpose |
|---|---|---|
| `name` | yes | The function name the model calls, unique within the provider |
| `title` | no | Human-friendly display name for MCP clients, in Title Case. Falls back to `name` |
| `description` | yes | What the tool does and when to use it. This is what the model reads to choose it |
| `roles` | yes | Kademi role names permitted to use it. Empty or missing means nobody gets it |
| `supportedUsage` | yes | Array of surface keys, see above |
| `parameters` | yes | JSON Schema for the input, used directly as the MCP `inputSchema` |
| `outputSchema` | recommended | JSON Schema describing the returned envelope |
| `requiresConsent` | no | True if the user must confirm before the call runs |
| `readOnly` | no | True if the tool only reads. Maps to MCP `annotations.readOnlyHint` |
| `destructive` | no | For a non-read-only tool, true if it deletes, disables or irreversibly changes data. Maps to `annotations.destructiveHint` |
| `openWorldHint` | no | True if the tool reaches something outside Kademi. Maps to `annotations.openWorldHint` |
| `actionLabel` | no | Button label on the confirmation prompt, e.g. `Disable profiles` |
| `actionClass` | no | CSS classes for that button, e.g. `btn btn-danger` |
| `consentMessage` | no | `function(params)` returning the HTML shown when asking the user to confirm |
| `validator` | no | `function(params)` that checks arguments before the call runs, see below |
| `startMessage` | yes in practice | `function(params)` returning the status line shown to the user while the tool runs |
| `func` | yes | The implementation. Returns the result envelope, or throws |

Write **every** author-supplied string in plain ASCII: `-` not an em dash, straight quotes, `...` not an
ellipsis glyph. Non-ASCII punctuation costs extra tokens and reads identically to the model.

### `parameters` - the input schema

It must be an object schema with an explicit top-level `type: 'object'`. For a function that takes no
arguments:

```js
parameters: {
    type: 'object',
    properties: {}
}
```

Never write `parameters: {}`. When these functions are published over MCP, `parameters` is passed straight
through as the tool's `inputSchema`, and a schema missing `type: "object"` is rejected.

Describe every property: what it is, its format (a JSON string, an ISO-8601 date, an enum of allowed
values), and where the value comes from if that is not obvious. Declare mandatory arguments in `required` -
that is the schema's job, so do not also write "REQUIRED" into the description text.

```js
parameters: {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            description: 'Filter to widgets in this state. One of: active, retired, draft. Omit for all states.'
        },
        limit: {
            type: 'number',
            description: 'Maximum widgets to return. Defaults to 20, capped at 100.'
        }
    },
    required: formatter.toList([])
}
```

Missing required arguments are caught before `func` runs, and the model is told which ones were missing.

### `outputSchema` - describe the whole envelope

`outputSchema` describes what `func` actually returns, which is the envelope, not just the payload. The
top-level type is therefore always `'object'`, with the success payload under `result` and `err` always
present:

```js
outputSchema: {
    type: 'object',
    properties: {
        result: {
            type: 'array',
            description: 'Widgets visible to the current user; empty array when there are none',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Widget id, pass this as widgetId to other widget tools' },
                    title: { type: 'string', description: 'Widget display name' },
                    status: { type: 'string', description: 'Current state: active, retired or draft' },
                    updated: { type: 'string', description: 'When the widget last changed, ISO-8601' }
                }
            }
        },
        err: { type: 'string', description: 'Error message when the call fails in a handled way' }
    }
}
```

Describe every field. The schema exists to save the model a discovery call: if it can read the shape *and*
the meaning of what comes back, it does not need to probe first. A bare `{ type: 'string' }` with no
description defeats the point.

## 4. What `func` must return

The return value is an object with exactly two possible fields - `result` on success, `err` on a handled
error. Set one, never both:

```js
{ result: <the payload> }   // success
{ err: '<message>' }        // handled failure
```

| Situation | Do this |
|---|---|
| Success | `return { result: data }` where `data` is a structured object or array |
| Valid "no results" | `return { result: [] }` or `{ result: {} }` - an empty result is a success |
| Bad arguments the model can fix, record not found, caller may not see that record | `return { err: 'message' }` |
| Missing configuration, null system state, an exception part-way through a write | `throw new Error('...')` |

Rules that follow from that:

- **Return the object, never a string.** Do not `JSON.stringify` the envelope. The caller serialises it
  once for the model; over MCP the same envelope becomes `structuredContent`, and `isError` is set when
  `err` is present.
- **`result` is the value itself.** For a list, `{ result: records }`. Wrap in an object only when there
  really are several distinct fields, e.g. `{ result: { retiredCount: 3, jobId: '42' } }`.
- **Keep it small.** Return the fields the caller needs, built as plain objects. Never hand back a platform
  entity: it serialises whatever it happens to hold, including relations the caller may not be allowed to
  see, and its shape changes underneath you.

### Throw or return `{ err }` - it decides whether data is rolled back

Throwing propagates out of the tool and **rolls the request transaction back**. Returning `{ err }` sends
the message to the model as an ordinary tool result, so it can retry or explain - and **commits** whatever
the request has already done.

That is a data-integrity boundary, so:

- **Do not wrap the whole `func` body in try/catch.** A blanket `catch (e) { return { err: e.message } }`
  swallows system exceptions; if any write already happened, the partial state commits instead of rolling
  back.
- Catch only a specific, expected failure you can convert into an actionable message, such as parsing an
  argument the model supplied. If a mutation has already run, re-throw rather than returning `{ err }`.

**Throw for:** required configuration unset, no current user profile when one is required, no agent context
when the tool needs one, or any failure after a write began.

**Return `{ err }` for:** empty-but-valid arguments the model can correct, a record the user cannot access,
a not-found lookup - none of which involve a mutation.

Guard nested lookups before reading through them. Use `formatter.isEmpty()` rather than
`formatter.isNull()` for maps and collections, since it covers both null and empty.

## 5. `validator` - checking arguments before the call

`validator(params)` runs after the `required` check and before `func`. It returns:

```js
{
    messages: [],     // non-empty means the call is refused and these are returned to the model
    extraParams: null // anything here is handed to func as params.validatorParams
}
```

Use it for constraints a JSON Schema cannot express - "either a handle, or a source query and its
parameters", "this id must exist", "this date range must be under 90 days" - and to do the parsing once, so
`func` receives values it can use directly.

```js
validator: (params) => {
    var validation = { messages: [], extraParams: null };

    var limit = formatter.toInteger(formatter.ifEmpty(params.limit, 20));
    if (formatter.gt(limit, 100)) {
        validation.messages.push('limit cannot be more than 100. Ask for a smaller page, or refine the filter.');
        return validation;
    }

    validation.extraParams = { limit: limit };
    return validation;
}
```

## 6. Consent

Set `requiresConsent: true` on anything the user should approve before it runs. The user is shown
`consentMessage(params)` if you supply one, with `actionLabel` / `actionClass` on the button; otherwise a
default message naming the tool. Say what will happen and to how many records - a confirmation the user
cannot evaluate is not a confirmation.

Also set `destructive: true` for anything that deletes, disables, removes or irreversibly changes data.
Over MCP, `requiresConsent` **or** `destructive` marks the tool as requiring user interaction, so a
destructive tool prompts even if `requiresConsent` was left false. Inside Kademi's own agents it is
`requiresConsent` that gates the call, so set that one deliberately.

Note the `excludeConsent` argument to `functions()`: a surface that cannot show a prompt asks for the list
with `excludeConsent` true, and the filter in the provider above withholds consent-requiring tools from it.

## 7. Worked example: a read function

```js
/* global formatter, services, controllerMappings, log */

function listWidgetsFunction() {
    return {
        name: 'listWidgets',
        title: 'List Widgets',
        description:
            'Lists widgets belonging to the current user, newest first. Use this to find a widget id before ' +
            'calling any other widget tool, or to answer questions about how many widgets exist and their state.',
        requiresConsent: false,
        readOnly: true,
        destructive: false,
        openWorldHint: false,
        supportedUsage: ['Agents', 'mcp_admin'],
        roles: ['WidgetViewer', 'WidgetAdmin'],
        parameters: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    description: 'Filter to widgets in this state. One of: active, retired, draft. Omit for all states.'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum widgets to return. Defaults to 20, capped at 100.'
                }
            },
            required: formatter.toList([])
        },
        outputSchema: {
            type: 'object',
            properties: {
                result: {
                    type: 'array',
                    description: 'Widgets visible to the current user; empty array when there are none',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Widget id, pass this as widgetId to other widget tools' },
                            title: { type: 'string', description: 'Widget display name' },
                            status: { type: 'string', description: 'Current state: active, retired or draft' },
                            updated: { type: 'string', description: 'When the widget last changed, ISO-8601' }
                        }
                    }
                },
                err: { type: 'string', description: 'Error message when the call fails in a handled way' }
            }
        },
        startMessage: (params) => {
            return 'Looking up widgets';
        },
        validator: (params) => {
            var validation = { messages: [], extraParams: null };
            var limit = formatter.toInteger(formatter.ifEmpty(params.limit, 20));
            if (formatter.gt(limit, 100)) {
                validation.messages.push('limit cannot be more than 100. Ask for a smaller page.');
                return validation;
            }
            validation.extraParams = { limit: limit };
            return validation;
        },
        func: (params) => {
            // System state, not something the model can fix: throw so the request rolls back.
            var currentProfile = services.userManager.currentProfile;
            if (formatter.isNull(currentProfile)) {
                throw new Error('No current user profile');
            }

            var limit = params.validatorParams.limit;

            // SECURITY: scoped to the caller, not to whatever the model asked for.
            var widgets = services.widgetServices.findWidgetsForOwner(currentProfile, params.status, limit);
            if (formatter.isEmpty(widgets)) {
                return { result: [] };  // a valid empty result is a success
            }

            var dm = services.dateManagerV1;
            var records = [];
            formatter.foreach(widgets, function (widget) {
                // Build a plain object with only the fields the schema promises.
                records.push({
                    id: formatter.toString(widget.id),
                    title: widget.title,
                    status: widget.status,
                    updated: dm.formatDateISO8601(widget.modifiedDate)
                });
            });

            return { result: records };
        }
    };
}
```

## 8. Worked example: a write function

```js
/* global formatter, services, controllerMappings, log */

function retireWidgetFunction() {
    return {
        name: 'retireWidget',
        title: 'Retire Widget',
        description:
            'Retires a widget so it is no longer offered. Use after confirming with listWidgets that the ' +
            'widget id is the intended one. A retired widget cannot be un-retired.',
        actionLabel: 'Retire widget',
        actionClass: 'btn btn-danger',
        requiresConsent: true,
        readOnly: false,
        destructive: true,
        openWorldHint: false,
        supportedUsage: ['Agents', 'mcp_admin'],
        roles: ['WidgetAdmin'],
        parameters: {
            type: 'object',
            properties: {
                widgetId: {
                    type: 'string',
                    description: 'Id of the widget to retire, as returned in the id field of listWidgets.'
                },
                reason: {
                    type: 'string',
                    description: 'Short note recorded against the widget explaining why it was retired.'
                }
            },
            required: formatter.toList(['widgetId'])
        },
        outputSchema: {
            type: 'object',
            properties: {
                result: {
                    type: 'object',
                    description: 'Outcome of the retirement',
                    properties: {
                        id: { type: 'string', description: 'Id of the widget that was retired' },
                        status: { type: 'string', description: 'The widget state after the call, always "retired"' }
                    }
                },
                err: { type: 'string', description: 'Error message when the call fails in a handled way' }
            }
        },
        startMessage: (params) => {
            return 'Retiring widget ' + params.widgetId;
        },
        consentMessage: (params) => {
            return `
                <div class="alert alert-danger">
                    <p>You are about to <strong>retire</strong> widget ${params.widgetId}.</p>
                    <p>It will no longer be offered, and this cannot be undone.</p>
                </div>
            `;
        },
        func: (params) => {
            // No try/catch around the body: an unexpected failure mid-write must propagate so the
            // request transaction rolls back rather than committing half the change.
            var currentProfile = services.userManager.currentProfile;
            if (formatter.isNull(currentProfile)) {
                throw new Error('No current user profile');
            }

            var widget = services.widgetServices.findWidgetById(params.widgetId);

            // Not found, and not visible to this caller, give the SAME handled error: a different
            // message for "exists but not yours" tells the model a record exists that it may not see.
            if (formatter.isNull(widget) || !services.widgetServices.canManage(currentProfile, widget)) {
                return { err: 'No widget found with id ' + params.widgetId };
            }

            if (formatter.isEqual(widget.status, 'retired')) {
                return { err: 'Widget ' + params.widgetId + ' is already retired.' };
            }

            // Past this point a write may have happened, so any failure must throw, not return { err }.
            services.widgetServices.retireWidget(widget, formatter.ifEmpty(params.reason, ''));
            log.info('retireWidget: retired widget={} by profile={}', params.widgetId, currentProfile.id);

            return {
                result: {
                    id: formatter.toString(widget.id),
                    status: 'retired'
                }
            };
        }
    };
}
```

## 9. Checklist

- [ ] `parameters` has an explicit `type: 'object'`, even with no properties
- [ ] Every property in `parameters` and `outputSchema` has a `description`
- [ ] `description` says what the tool does **and** when to use it
- [ ] All author-written text is plain ASCII
- [ ] `roles` names at least one role, and it is the role the operation really needs
- [ ] `supportedUsage` lists exactly the surfaces this tool should reach
- [ ] `readOnly` / `destructive` / `openWorldHint` match what the code actually does
- [ ] Destructive tools set `requiresConsent: true` and a `consentMessage` naming the impact
- [ ] `startMessage` present, so the user sees what is running
- [ ] `func` returns `{ result }` or `{ err }`, never a stringified value
- [ ] No blanket try/catch around `func`
- [ ] Every query is scoped to the caller, and results are plain objects, not entities

## Related

- [ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md) - everything an
  app registers with the platform, including `newImplementationBuilder`
- [UserManager](https://docs.kademi.co/ref/templating/md/UserManager.md) - `currentProfile` and role lookups
- [Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md) - `isEmpty`, `isNull`, `toList`,
  `foreach` and the rest of the null-safe helpers
- [DateManagerV1](https://docs.kademi.co/ref/templating/md/DateManagerV1.md) - date formatting, including
  `formatDateISO8601`
