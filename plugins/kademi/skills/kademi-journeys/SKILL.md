---
name: kademi-journeys
description: Use when a Kademi app needs to extend journeys or funnel automations - registering custom goal and action node types along with their journey-editor UI, contributing journey fields that administrators reach through KCode, declaring custom automation triggers and actions, and firing app events that journeys respond to. Journeys themselves are configured by administrators; this skill is for building the blocks they use. Use when the user mentions a Kademi journey, funnel, lead, automation, a journey goal, action, trigger or node, a custom node in the journey editor, or wants an app to react to something a profile does.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: journeys

## Who builds what

Journeys are **configured by administrators**, not by you. An administrator opens the journey
editor, drags nodes onto a canvas, wires them together, fills in each node's settings form and
saves the funnel. They also build the automations, write the emails and pick the KCode fields
that get merged into them.

Your job as an app developer is to **contribute building blocks** that then show up in those
admin screens:

| You ship | An administrator gets |
|---|---|
| A goal node type | A new goal they can drop into a funnel and configure |
| An action node type | A new action node that does something in your app |
| A journey field | A new value in the KCode picker, segment builder and query builder |
| A funnel trigger type | A new way to start an automation |
| A funnel action type | A new step an automation can perform |
| An app event | Something the platform, and other apps, can listen for |

You do not create funnels, place nodes, or decide when a journey runs. Ship the block, document
what it does, and let the administrator wire it up.

## The model

A **funnel** ([Funnel](https://docs.kademi.co/ref/templating/md/Funnel.md)) is the definition of a
journey: a graph of nodes plus stages, automations, scoring and task definitions. It is stored in a
[FunnelRepository](https://docs.kademi.co/ref/templating/md/FunnelRepository.md), versioned per
branch, so editing a funnel does not disturb leads already running on the old version.

A **lead** ([Lead](https://docs.kademi.co/ref/templating/md/Lead.md)) is one entity's run through
one funnel. Usually that entity is a profile, but a lead can exist before the profile is known
(carrying only a captured name, email and phone). A lead has a `currentGoal` (the node it is
waiting at), a `stageName`, custom field values, and lifecycle dates.

A **journey node** is one box on the canvas. Two kinds matter to you:

- a **goal** is a *wait* node. The lead sits at it until an incoming event satisfies the goal, then
  transitions on. [Begin](https://docs.kademi.co/ref/templating/md/Begin.md) is the funnel's entry
  point; the goal it points at is also used as *entry criteria* - if that goal matches an event for
  someone who has no lead yet, a new lead is created.
- an **action** is a *do* node. The lead passes straight through it and something happens on the
  way: an email is sent, points are granted, your app is called.

A **stage** ([Stage](https://docs.kademi.co/ref/templating/md/Stage.md)) is a coarse grouping of
goals, used for reporting ("how many leads are in Qualified?").

An **event** is what makes a lead move. Platform events (a module completed, a cart checked out, a
profile updated) are translated into funnel events by
[FunnelManager](https://docs.kademi.co/ref/templating/md/FunnelManager.md), which then asks each
waiting goal whether the event satisfies it. Your app can fire its own:
[RepoAppFunnelEvent](https://docs.kademi.co/ref/templating/md/RepoAppFunnelEvent.md).

A **funnel automation** is a separate mechanism from the node graph: a trigger plus one or more
actions, attached to the funnel and evaluated against every incoming event. Automations are how a
funnel reacts to something *without* a lead being parked at a node. Each firing is recorded as a
[JourneyAutomation](https://docs.kademi.co/ref/templating/md/JourneyAutomation.md) row, which is
also how "only once per person" automations know they already ran.

A **fork** ([LeadFork](https://docs.kademi.co/ref/templating/md/LeadFork.md)) is a parallel branch
of one lead, with its own current goal and its own timeout.

## What an app contributes

All registration happens in your app's server-side JavaScript, against the global
`controllerMappings`
([ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md)). Every
call is idempotent at load time and is ignored once the app's engine has finished initialising, so
register at the top level of a loaded source file, not inside a request handler.

```js
/* global controllerMappings */

// A goal: lead waits here until your JS says the goal is met
controllerMappings.addGoalNodeType('warrantyApprovedGoal', 'MyApp/warrantyApprovedGoal.js', 'checkWarrantyApproved');

// Same, plus a function that runs when a real lead enters the node
controllerMappings.addGoalNodeType('warrantyApprovedGoal', 'MyApp/warrantyApprovedGoal.js', 'checkWarrantyApproved', 'onWarrantyApprovedEnter');

// An action: runs when a lead reaches the node
controllerMappings.addActionNodeType('closeWarrantyAction', 'MyApp/closeWarrantyAction.js', 'doCloseWarranty');

// A simple text field, usable in KCode, segments and queries
controllerMappings.addTextJourneyField('warranty_last_status', 'Warranty: last status', 'getLastWarrantyStatus');

// Fields that can only be known at runtime (one per configured warranty type, say)
controllerMappings.journeyFieldsFunction(loadWarrantyFields);
```

The three arguments to `addGoalNodeType` / `addActionNodeType` are:

1. `name` - the node type id. Unique across every app on the account. This is what an
   administrator's saved funnel JSON records, so **never rename it** once anything uses it.
2. `template` - repository path, relative to `theme/apps/`, of the file that renders the node's
   **admin UI**. `'MyApp/closeWarrantyAction.js'` means the file `theme/apps/MyApp/closeWarrantyAction.js`
   in your app. It is rendered through Velocity and appended to the journey editor's script.
3. `jsMethod` - the name of a global function in your app's server-side JavaScript.

A node type without its UI file is invisible in the journey editor. Read
[references/node-types.md](references/node-types.md) when you are actually writing a custom node
type - it has both halves, the server handler and the journey-editor UI file, plus a checklist.

## Gotchas

**Handler argument orders differ between hooks.** `customSettings` and `customNextNodes` swap
position between the goal match function and everything else, and the match function takes two
arguments the others do not. Getting this backwards is the single most common bug in a custom node,
and it fails silently - you read settings out of the wiring map and get nothing.

```
goal match     (rootFolder, lead, funnel, params, customNextNodes, customSettings, event, atts)
goal on enter  (rootFolder, lead, funnel, exitingNode, customSettings, customNextNodes, funnelEvent)
action         (rootFolder, lead, funnel, exitingNode, customSettings, customNextNodes, funnelEvent)
```

**A goal's match function runs with a null `lead`.** The same function decides whether an incoming
event should *start* a new lead, and at that point no lead exists. Guard every `lead.` access. Work
that only makes sense with a real, persisted lead belongs in the on-enter function instead.

## Writing a goal handler

```js
/**
 * @param {Object} rootFolder  current root folder
 * @param {Lead}   lead        the lead being tested - NULL when this goal is only being
 *                             evaluated as journey entry criteria
 * @param {Funnel} funnel      the funnel definition
 * @param {Map}    params      the fired event's parameters, a Map of string to string
 * @param {Map}    customNextNodes  logical outcome name -> node id, as configured on the node
 * @param {Map}    customSettings   the node's settings, as saved by the administrator
 * @param {Object} event       the funnel event
 * @param {Map}    atts        the lead's custom field values - writes here persist on the lead
 * @returns {boolean|string|null}
 */
function checkWarrantyApproved(rootFolder, lead, funnel, params, customNextNodes, customSettings, event, atts) {
    if (formatter.isEmpty(params)) {
        return false;
    }

    // Only match the warranty type this node was configured for, if any
    var wantType = formatter.isNull(customSettings) ? null : customSettings.warrantyType;
    if (formatter.isNotEmpty(wantType) && formatter.isNotEqual(wantType, params.warrantyType)) {
        return false;
    }

    // Remember what matched, so later nodes and KCode can read it off the lead
    atts.put('warrantyId', params.warrantyId);
    atts.put('warrantyType', params.warrantyType);

    return true;
}
```

Return value:

- `true` - goal met, the lead moves to the node's configured next node.
- `false` or `null` - not met, the lead keeps waiting.
- **a node id string** - goal met, and the lead goes to *that* node instead. Read the id out of
  `customNextNodes` rather than hard-coding it; that map is what the administrator's wiring
  produced.

Three things bite people:

- **`lead` is null during entry evaluation.** The same function is used to decide whether an event
  should *start* a new lead. Guard every `lead.` access. If you need work that only makes sense with
  a real, persisted lead, register a fourth argument (`jsOnEnterMethod`) instead - see
  [RepoAppGoalNodeType](https://docs.kademi.co/ref/templating/md/RepoAppGoalNodeType.md).
- **`atts` is the lead's field map.** When a lead exists, writes go straight onto its custom fields.
  During entry evaluation it is a plain map whose contents become the *new* lead's initial fields.
  Either way, `atts.put(...)` is how you carry event data onto the lead - and `lead.allFieldValues`
  or `lead.getFieldValue(name)` is how a later node reads it back.
- **A goal is asked about every matching event, repeatedly.** It must be a pure test. Do not send
  emails or write records from a match function.

The optional on-enter function has a *different* argument order:
`fn(rootFolder, lead, funnel, exitingNode, customSettings, customNextNodes, funnelEvent)`. Its
return value is ignored.

## Writing an action handler

```js
/**
 * @param {Object} rootFolder      current root folder
 * @param {Lead}   lead            the lead that reached this node
 * @param {Funnel} funnel          the funnel definition
 * @param {Object} exitingNode     the node the lead came from
 * @param {Map}    customSettings  the node's settings, as saved by the administrator
 * @param {Map}    customNextNodes logical outcome name -> node id
 * @param {Object} funnelEvent     the event that caused the transition, may be null
 * @returns {string|null} a node id to override the configured next node, or null to use it
 */
function doCloseWarranty(rootFolder, lead, funnel, exitingNode, customSettings, customNextNodes, funnelEvent) {
    var warrantyId = lead.allFieldValues.get('warrantyId');
    if (formatter.isEmpty(warrantyId)) {
        log.warn('doCloseWarranty: lead {} has no warrantyId, nothing to close', lead.id);
        return null; // continue down the configured path
    }

    // Let the administrator template the note with KCode
    var vars = formatter.newMap();
    vars.put('lead', lead);
    var note = services.templatingManager.evaluateAllFields(customSettings.note || '', lead.profile, vars);

    transactionManager.runInTransaction(function () {
        closeWarrantyRecord(warrantyId, note); // your own app code
    });

    return null;
}
```

Side effects, errors and idempotency:

- **Wrap writes in `transactionManager.runInTransaction`.** Reads outside a transaction are fine.
- **A thrown error aborts the transition.** The platform wraps a script exception and rethrows it,
  so the lead does not advance and the event processing fails. If your action calls an external
  service, decide deliberately: throw (and have the lead stall at the previous node) or log a
  warning and return null (and let the journey continue). Returning `null` on a soft failure, as
  above, is usually the kinder choice for a marketing journey.
- **Assume it can run more than once.** A retried event, a duplicated node or an administrator
  re-running a lead all produce a second call. Make the effect idempotent - key external records on
  something derived from `lead.id` plus the node, or check for an existing record first, rather than
  blindly inserting.
- **Do not park.** An action node is not allowed to wait. If you need to wait for a callback, pair
  an action node (send the request) with a goal node (wait for the response event), which is exactly
  how integration apps model a round trip.

## Triggers and events

The platform already fires events for most things worth reacting to: module progress, shopping cart
and checkout, group membership, points granted and debited, recognition, vouchers, quotes, contact
forms, page views, credentials, file uploads, tasks and lead lifecycle. Before you invent an event,
check the catalogue - the answer is usually "there is already one".

Your app fires its own journey event with `eventManager`
([EventWrapper](https://docs.kademi.co/ref/templating/md/EventWrapper.md)):

```js
/* global eventManager, formatter */

function onWarrantyApproved(warranty, profile) {
    var params = formatter.newMap();
    params.put('warrantyId', warranty.id + '');   // an id, as a string
    params.put('warrantyType', warranty.type);
    eventManager.goalAchieved('warrantyApprovedGoal', profile, params);
}
```

The first argument is the **node type name** you registered with `addGoalNodeType`. Every goal node
of that type, on any funnel, is offered the event.

Event parameters are a plain string map
([RepoAppFunnelEvent](https://docs.kademi.co/ref/templating/md/RepoAppFunnelEvent.md) exposes them
as `Map<String,String>`, and
[FunnelManager](https://docs.kademi.co/ref/templating/md/FunnelManager.md) can recreate an event
from a map of serializable properties in order to replay it). So put **entity ids and plain
strings** on an event, and re-resolve the record inside the handler. Do not attach a live database
entity: by the time a goal or automation reads the event, the session that loaded it may be gone.

Read [references/triggers-and-events.md](references/triggers-and-events.md) *before* writing a
custom trigger, goal or event, to check whether a built-in already covers the need - it is the full
catalogue of built-in triggers, goals, actions and events, and it also covers firing your own events
and building custom automation trigger and action types.

## Journey fields

A journey field is a named, typed value your app computes on demand. Once registered it appears in
the segment builder, the query builder, funnel rule expressions and - the reason most apps add one -
the **KCode picker**.

```js
controllerMappings.addTextJourneyField('warranty_last_status', 'Warranty: last status', 'getLastWarrantyStatus');

function getLastWarrantyStatus(profile, vars) {
    var lead = vars.get('lead');
    // ... look up and return a string
}
```

Prefer the version two builder for anything an administrator might want to *chain*:

```js
controllerMappings
    .newFieldBuilder('warrantyClaim', 'Warranty claim')
    .returnType('WarrantyClaim')   // a type name you also hang fields off
    .parentType('Lead')            // so it chains after the built-in currentLead
    .evalFunction('getWarrantyClaimForLead')
    .build();

controllerMappings.addFieldV2('warrantyClaimStatus', 'Status', 'string', 'WarrantyClaim', 'getClaimStatus');
```

Read [references/journey-fields.md](references/journey-fields.md) when you are registering fields -
it has the version one and version two signatures, parent types and KCode chaining, and the dynamic
`journeyFieldsFunction`.

## KCode: why journey fields matter

KCode is the merge-field syntax administrators use in journey emails, SMS, landing pages and node
settings. A KCode expression is a path of field ids inside `*|` and `|*`, navigating from a root
object down through typed fields:

```
*|currentUser/firstName|*
*|currentLead/leadCustomerProfile/email|*
*|currentUser/primaryMemberships/firstMem/membershipOrg/uuid|*
```

In a journey email the context is the **lead**, so administrators start from `currentLead` (in a
website page it is the logged-in user, so they start from `currentUser`). See
[Using KCode](https://docs.kademi.co/blogs/docs-kb/using-kcode/) for the administrator's view, and
[Using KCode for task approval in a sales claim approval workflow](https://docs.kademi.co/blogs/docs-kb/using-kcode-for-task-approval-in-a-sales-claim-approval-workflow/)
for a worked journey example (`currentLead/leadClaim/claimOrg/parentOrg/email`, used to work out
who should approve a claim).

**The connection:** each segment of that path is a registered field. `returnType` says what a field
evaluates to; `parentType` says what it hangs off. When you register a field with
`parentType('Lead')`, it becomes a new branch the administrator can select immediately after
`currentLead` in the picker. When you give it an object `returnType` and then register more fields
with that type as their `parentType`, you have extended the tree by a whole level.

That is the point of contributing a journey field: without one, your app's data is invisible to the
people writing the emails. With one, an administrator can put your value into a journey email
without asking you for anything.

Your server-side code can evaluate KCode too, which is how a node lets an administrator template
its settings:
`services.templatingManager.evaluateAllFields(template, profile, vars)`
([TemplatingManager](https://docs.kademi.co/ref/templating/md/TemplatingManager.md)). Pass `lead` in
`vars` so `currentLead` resolves.

## Naming and versioning

- Node type names, field ids, trigger type ids and event ids are all **global across every app on
  an account**. Prefix them with something specific to your app.
- They are also **stored in saved configuration**. Renaming one silently breaks every funnel that
  uses it. Add a new id and leave the old one working instead.
- There is a ceiling on fields: an app is warned as it passes 200 registered fields and blocked past
  300. A `journeyFieldsFunction` that loops over account data can hit this - cap what you generate.

## References

- Read [references/node-types.md](references/node-types.md) when writing a custom goal or action
  node type - the server handler, the journey-editor UI file and a pre-ship checklist.
- Read [references/triggers-and-events.md](references/triggers-and-events.md) when you need to know
  whether a built-in trigger, goal or event already covers what you want, before writing a custom
  one - it is the full catalogue, plus custom automation trigger and action types.
- Read [references/journey-fields.md](references/journey-fields.md) when registering journey fields -
  version one and version two, dynamic fields, parent types and KCode chaining.

Related public guides:

- [Using KCode](https://docs.kademi.co/blogs/docs-kb/using-kcode/)
- [Using KCode for task approval in a sales claim approval workflow](https://docs.kademi.co/blogs/docs-kb/using-kcode-for-task-approval-in-a-sales-claim-approval-workflow/)
- [Voucher Expiration Rule Types - Developer Guide](https://docs.kademi.co/blogs/docs-kb/voucher-expiration-rule-types-developer-guide/) -
  a different pluggable type, same shape: you declare the type and supply a JS function, an
  administrator picks it and fills in the fields.

## Related skills

- **kademi-server-js** - every registration on this page runs from server-side JavaScript under
  `APP-INF/`, and `controllers.xml` has to load that file or none of it runs at all.
- **kademi-themes** - a custom node's configuration UI is a Velocity-rendered file under the app's
  theme directory.
- **kademi-api-reference** - confirming a trigger, goal, action or entity class and its methods
  before you use it.
- **kademi-integrations** - reacting to bulk-imported data, where the journey event comes out of an
  import rather than a user action.
- **kademi-app-development** - the project layout the registrations live in, and publishing the app.
