# Node types

A custom journey node is two files that have to agree with each other:

| Half | Where it runs | What it does |
|---|---|---|
| Handler | Server-side app JavaScript | Decides whether the goal is met, or performs the action |
| Node UI file | Journey editor, in the browser | Draws the node, and renders its settings form |

Register both in one call. If you ship only the handler, the node type exists but no administrator
can ever place it on a canvas.

## Registration

```js
/* global controllerMappings */

controllerMappings
    .addGoalNodeType('warrantyApprovedGoal', 'MyApp/warrantyApprovedGoal.js', 'checkWarrantyApproved')
    .addActionNodeType('closeWarrantyAction', 'MyApp/closeWarrantyAction.js', 'doCloseWarranty');
```

Both methods return the mappings object, so they chain.

- **name** - the node type id. Global across every app on the account, and written into every saved
  funnel that uses the node. Prefix it and never rename it.
- **template** - repository path *relative to* `theme/apps/`. `'MyApp/warrantyApprovedGoal.js'`
  resolves to `theme/apps/MyApp/warrantyApprovedGoal.js` in your app. It is rendered as a Velocity
  template and its output is appended to the journey editor's handler script, so it is a `.js` file
  that may contain Velocity directives.
- **jsMethod** - name of a global function in your app's server-side JavaScript.

A goal takes an optional fourth argument, the name of an on-enter function:

```js
controllerMappings.addGoalNodeType(
    'warrantyApprovedGoal',
    'MyApp/warrantyApprovedGoal.js',
    'checkWarrantyApproved',
    'onWarrantyApprovedEnter'
);
```

The match function is also called with a null lead while the goal is being evaluated as journey
*entry* criteria. The on-enter function is only ever called with a real, persisted lead - including
on the very first node of a lead that was just created. Put anything that needs a lead there. See
[RepoAppGoalNodeType](https://docs.kademi.co/ref/templating/md/RepoAppGoalNodeType.md) and
[RepoAppActionNodeType](https://docs.kademi.co/ref/templating/md/RepoAppActionNodeType.md).

## Handler signatures

Note that the two orders differ. This is the most common source of bugs in a custom node.

```
goal match     (rootFolder, lead, funnel, params, customNextNodes, customSettings, event, atts)
goal on enter  (rootFolder, lead, funnel, exitingNode, customSettings, customNextNodes, funnelEvent)
action         (rootFolder, lead, funnel, exitingNode, customSettings, customNextNodes, funnelEvent)
```

| Argument | Notes |
|---|---|
| `rootFolder` | The account root folder for the lead's admin organisation, so a node still works on a website where your app is switched off |
| `lead` | [Lead](https://docs.kademi.co/ref/templating/md/Lead.md). **Null in a goal match during entry evaluation** |
| `funnel` | [Funnel](https://docs.kademi.co/ref/templating/md/Funnel.md) |
| `params` | The fired event's parameters, `Map<String,String>` |
| `event` / `funnelEvent` | The funnel event. May be null for an action reached by a straight transition |
| `customSettings` | What the administrator saved in the node's settings form |
| `customNextNodes` | Logical outcome name to node id, so a handler can pick a branch |
| `atts` | Goal match only. The lead's custom field values - writes persist |
| `exitingNode` | The node the lead came from |

Return values:

- Goal match: `true` (met, use the configured next node), `false` or `null` (keep waiting), or a
  node id string (met, go there instead).
- Goal on enter: ignored.
- Action: `null` to use the configured next node, or a node id string to override it.

See [RepoAppEventGoal](https://docs.kademi.co/ref/templating/md/RepoAppEventGoal.md) and
[RepoAppAction](https://docs.kademi.co/ref/templating/md/RepoAppAction.md) for the runtime nodes
that call your functions.

## The node UI file

The journey editor exposes two globals your file writes into:

```js
var JB_NODE_TYPE = { ACTION: 1, GOAL: 2, DECISION: 3 };
var JBNodes = { /* nodeTypeName -> node definition */ };
```

Your file assigns one entry into `JBNodes`, keyed by **exactly** the node type name you registered.

```js
/* theme/apps/MyApp/closeWarrantyAction.js */
/* global JB_NODE_TYPE, JBNodes */

JBNodes['closeWarrantyAction'] = {
    icon: 'fa fa-check',
    title: 'Close the warranty claim',
    type: JB_NODE_TYPE.ACTION,
    nodeTypeClass: 'customAction',

    ports: {
        nextNodeId: {
            label: 'then',
            title: 'When completed',
            maxConnections: 1
        }
    },

    settingEnabled: false
};
```

That is a complete, working action node with no settings.

| Property | Meaning |
|---|---|
| `icon` | CSS classes for the node's icon |
| `title` | Label in the node palette and on the node itself |
| `type` | `JB_NODE_TYPE.GOAL` or `JB_NODE_TYPE.ACTION` - drives the node's colour and whether a "view leads for goal" link is offered |
| `nodeTypeClass` | **Required.** `'customGoal'` for a goal, `'customAction'` for an action. This is the JSON discriminator that tells the server which node class to deserialise your node into. Get it wrong and the saved funnel will not load your node |
| `ports` | The connection points on the node. The key is the port name; `nextNodeId` is the normal outgoing path and `timeoutNode` gets timeout styling. Any other key becomes an entry in `customNextNodes` on the server |
| `settingEnabled` | `true` to show a cog button and build a settings form |
| `initSettingForm(form)` | Called once at editor load. Build the form's HTML and bind its save handler |
| `showSettingForm(form, node)` | Called each time an administrator opens the node. Populate the controls from `node.customSettings` |

## A node with settings

`initSettingForm` runs **once per node type**, not once per node, so it must not depend on which
node was clicked. `showSettingForm` runs per open, and is where you read the saved values.

```js
/* theme/apps/MyApp/warrantyApprovedGoal.js */
/* global JB_NODE_TYPE, JBNodes, JBApp, $, showStandardError */

JBNodes['warrantyApprovedGoal'] = {
    icon: 'fa fa-shield-alt',
    title: 'Warranty approved',
    type: JB_NODE_TYPE.GOAL,
    nodeTypeClass: 'customGoal',

    ports: {
        nextNodeId: {
            label: 'approved',
            title: 'When the warranty is approved',
            maxConnections: 1
        },
        timeoutNode: {
            label: 'timeout',
            title: 'When the timeout elapses',
            maxConnections: 1
        }
    },

    settingEnabled: true,

    initSettingForm: function (form) {
        form.append(
            '<div class="form-group">' +
            '    <div class="col-md-12">' +
            '        <label>Warranty type</label>' +
            '        <select class="form-control warrantyType"></select>' +
            '        <em class="small help-block">Leave blank to match any warranty type.</em>' +
            '    </div>' +
            '</div>'
        );

        // Goals get the shared timeout / stage / scoring controls
        form.append(JBApp.standardGoalSettingControls);
        JBApp.initStandardGoalSettingControls(form);

        form.forms({
            allowPostForm: false,
            onValid: function () {
                JBApp.currentSettingNode.customSettings = {
                    warrantyType: form.find('select.warrantyType').val() || null
                };

                JBApp.saveStandardGoalSetting(form);
                JBApp.saveFunnel('Funnel is saved');
                JBApp.hideSettingPanel();
            }
        });
    },

    showSettingForm: function (form, node) {
        var customSettings = node.customSettings || {};

        JBApp.showStandardGoalSettingControls(form, node);
        JBApp.showSettingPanel(node);

        $.ajax({
            url: '/mywarranties/types',
            dataType: 'json'
        }).done(function (resp) {
            var options = '<option value="">[Any warranty type]</option>';
            (resp.data || []).forEach(function (t) {
                options += '<option value="' + t.name + '">' + t.title + '</option>';
            });

            var select = form.find('select.warrantyType');
            select.html(options);
            select.val(customSettings.warrantyType || '');
        }).fail(function () {
            showStandardError('loading warranty types for the "Warranty approved" node');
        });
    }
};
```

### Editor helpers

| Helper | Use |
|---|---|
| `JBApp.currentSettingNode` | The node being edited. Write your values to its `customSettings` |
| `JBApp.saveFunnel(message)` | Persists the whole funnel and shows the message |
| `JBApp.showSettingPanel(node)` | Opens the settings panel for a node |
| `JBApp.hideSettingPanel()` | Closes it |
| `JBApp.standardGoalSettingControls` | HTML for the shared goal controls: timeout units and multiples, stage, achieved stage, source, cost, probability, timer time, relative-date expression |
| `JBApp.initStandardGoalSettingControls(form)` | Wires those controls up. Call from `initSettingForm` |
| `JBApp.showStandardGoalSettingControls(form, node)` | Populates them. Call from `showSettingForm` |
| `JBApp.saveStandardGoalSetting(form)` | Reads them back onto `JBApp.currentSettingNode`. Call from your `onValid` |
| `JBApp.funnel` | The funnel being edited, including `stages` and `sources` |

The three `standard...GoalSetting` helpers only apply to goals. An action node skips them; it has no
timeout and no stage.

### Rules for the UI file

- **Settings values must survive a round trip as strings.** `customSettings` reaches your handler as
  a map of strings (for a goal) or of plain values (for an action). Do not stash a nested structure
  in a goal's settings and expect it back intact.
- **Every port you draw must be handled.** A port other than `nextNodeId` and `timeoutNode` arrives
  in `customNextNodes` keyed by the port name. If your handler never returns that node id, the
  administrator has wired up a path that can never be taken.
- **Fetch reference data from your own endpoints.** The editor cannot see your app's server-side
  JavaScript. Anything the form needs - lists of types, categories, programs - has to come over HTTP
  from a controller your app publishes.
- **Fail visibly.** If a lookup fails, tell the administrator which node it was for. A settings form
  that silently renders an empty dropdown is much worse than an error.

## Checklist

1. Node type name is prefixed, unique, and final.
2. Registered with the UI file path *and* the handler function name.
3. UI file lives under `theme/apps/` at exactly the registered path.
4. `JBNodes['<name>']` key matches the registered name.
5. `nodeTypeClass` is `'customGoal'` or `'customAction'`.
6. Goal handler guards against a null lead.
7. Action handler writes inside a transaction and is safe to run twice.
8. Handler argument order matches the table above.
