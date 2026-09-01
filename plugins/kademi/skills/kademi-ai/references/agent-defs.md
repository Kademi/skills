# Agent definitions

An **agent definition** describes an agent: its system prompt, the tools it may call, the user groups whose
members get it, and the timers, event handlers and workflows that make it act without being asked. An
**agent** is a running instance of a definition for one particular user, acting with that user's identity
and privileges.

- [AgentDef](https://docs.kademi.co/ref/templating/md/AgentDef.md) - the definition
- [Agent](https://docs.kademi.co/ref/templating/md/Agent.md) - a running instance for one user
- [AgentManager](https://docs.kademi.co/ref/templating/md/AgentManager.md) - definitions, instances, timers
- [AgentWorkflow](https://docs.kademi.co/ref/templating/md/AgentWorkflow.md) - the state of one workflow run

## Two ways to supply one

**From your app, in code.** Register an `agentDefProviders` implementation with a `getAgentDefs()` function
returning a list of definitions. Build them with
[AgentDefBuilder](https://docs.kademi.co/ref/templating/md/AgentDefBuilder.md), obtained from
`services.agentManager.newAgentDefBuilder()`. These are assembled fresh on each lookup and nothing is
stored, so upgrading your app updates the definition everywhere.

**As XML.** A definition can be stored in the account, where an administrator can also edit it. A stored
definition of a given name **replaces** an app-supplied definition of the same name outright - it does not
merge - because an administrator overriding one is usually doing it to take something away.

The `name` is the definition's portable identifier and is always the file name including the `.xml` suffix,
e.g. `WidgetWatcher.xml`. A name supplied without the suffix has one added.

## Registering from an app

```js
/* global services, formatter, controllerMappings */

controllerMappings
    .newImplementationBuilder('agentDefProviders')
    .implementationObject({
        getAgentDefs: function () {
            return buildWidgetAgentDefs();
        }
    })
    .build();

function buildWidgetAgentDefs() {
    var def = services.agentManager
        .newAgentDefBuilder()
        .name('WidgetWatcher.xml')
        .title('Widget Watcher')
        .instructions(
            'You look after widget stock levels for this account.\n' +
            'Rules:\n' +
            '- Only use information your functions return. Do not answer from general knowledge, and do not\n' +
            '  guess at ids, names or values - look them up.\n' +
            '- Report what you actually did, including which functions you called. If you could not finish,\n' +
            '  say why rather than describing what you would have done.'
        )
        .functions(formatter.toList(['MyApp_listWidgets', 'MyApp_retireWidget']))
        .groups(formatter.toList(['administrators']))
        .build();

    return formatter.toList([def]);
}
```

Reference the function name as it is exposed, `providerName_functionName`, matching what the provider's
`name()` returns. The `functions` list is an allow-list: the agent is offered only these, and only those
the running user's roles also permit.

The builder covers `name`, `title`, `instructions`, `functions`, `groups`, `timers`, `events`,
`attributes` and `allowedOverrides`. Properties it does not cover are set on the built definition with the
`withXxx` methods on [AgentDef](https://docs.kademi.co/ref/templating/md/AgentDef.md), each of which
returns a new copy:

```js
var def = services.agentManager
    .newAgentDefBuilder()
    .name('WidgetWatcher.xml')
    .title('Widget Watcher')
    .instructions('...')
    .functions(formatter.toList(['MyApp_listWidgets']))
    .groups(formatter.toList(['administrators']))
    .build()
    .withDescription('Answers questions about widget stock and retires widgets that are out of production.')
    .withAllowPlanning(false)
    .withModelTier('balanced');
```

- `description` is not the system prompt. It is the one line **another** agent's planning reads when
  deciding whether to hand work to this one, so write it as routing information: what this agent is for.
- `allowPlanning` lets the agent spend a call working out an approach before acting. Off unless set. Worth
  it for multi-step work, wasted on an agent that mostly answers questions.
- `withModelTier` says what kind of model the agent needs - `fast`, `balanced` or `deep` - rather than
  pinning it to one, so the agent follows model releases without being edited. `withModel` is the escape
  hatch that names an exact model.
- `availableSubAgents` names the definitions a root agent may delegate to. Delegation is how you keep an
  agent's context small: the specialist loads its own tools, and the root only ever sees names and
  descriptions.

## The XML

The XML is the same structure as the object. The root element is `agent`; the file name gives the
definition its name.

```xml
<agent>
    <title>Widget Watcher</title>
    <description>Answers questions about widget stock and retires widgets that are out of production.</description>
    <instructions>
        You look after widget stock levels for this account.
        Only use information your functions return, and do not guess at ids.
    </instructions>
    <groups>
        <string>administrators</string>
    </groups>
    <functions>
        <string>MyApp_listWidgets</string>
        <string>MyApp_retireWidget</string>
    </functions>
    <attributes>
        <entry>
            <string>reorderLevel</string>
            <string>25</string>
        </entry>
    </attributes>
</agent>
```

`attributes` is an arbitrary name/value map carried with the definition, for configuration none of the
other properties covers. A tool can read it back through the agent context when it runs under one.

`allowedOverrides` controls what a user may change on their own instance without replacing the whole
definition. Each entry is `property=mode1,mode2`, where each mode is `add`, `edit` or `remove`:

```xml
<allowedOverrides>
    <string>timers=edit</string>
</allowedOverrides>
```

## Timers

A timer runs its own instructions on a schedule, with no user present. See
[AgentDefTimer](https://docs.kademi.co/ref/templating/md/AgentDefTimer.md).

```xml
<timers>
    <timer>
        <name>dailyStockCheck</name>
        <instructions>
            List widgets below their reorder level. If there are any, retire the ones marked out of
            production and report the rest. If there are none, say so in one line.
        </instructions>
        <timerUnit>d</timerUnit>
        <timerMultiple>1</timerMultiple>
        <timerTime>09:00</timerTime>
    </timer>
</timers>
```

| Field | Meaning |
|---|---|
| `name` | Identifies the timer. A user override matches on it, and it is not itself editable |
| `instructions` | What to do when it fires |
| `timerUnit` | The interval unit: `m` minutes, `h` hours, `d` days, `w` weeks, `M` months, `y` years |
| `timerMultiple` | How many units between firings, e.g. 3 with unit `d` for every three days. `-1` marks the timer disabled by a user override |
| `timerTime` | Optional time of day the timeout is adjusted to, e.g. `09:00` |

Confirm the unit values for an account with `services.agentManager.getAgentDefTimerUnits()`, which returns
the units keyed by the value to store.

Timer instructions run unattended, so they need to be complete on their own: name the tools to use, say
what counts as done, and say what to do when there is nothing to report. Anything requiring consent will
not run here.

## Event handlers

An event handler fires the agent when a matching platform event occurs. See
[AgentDefEventHandler](https://docs.kademi.co/ref/templating/md/AgentDefEventHandler.md).

```xml
<events>
    <event>
        <name>WidgetOutOfStockEvent</name>
        <instructions>
            A widget has gone out of stock. Look it up, and if it is marked out of production, retire it.
            Otherwise report it for reordering.
        </instructions>
        <scope>cust_profile</scope>
        <bufferSecs>300</bufferSecs>
        <bufferSize>20</bufferSize>
    </event>
</events>
```

| Field | Meaning |
|---|---|
| `name` | The event name, the same name an app event listener would use. It must identify a platform funnel event |
| `instructions` | What to do when a matching event fires |
| `scope` | Omit to match every event; `cust_profile` matches only events for the agent owner's own profile |
| `bufferSecs` | Buffer matching events for up to this many seconds, then fire once with everything collected |
| `bufferSize` | Buffer until this many events have arrived, then fire with them |

Buffer anything that fires in bursts. Without it a hundred events in a minute is a hundred agent runs.
Setting both means whichever limit is reached first triggers the run.

Unlike timers, event handlers **cannot** be overridden per user.

## Workflows

A workflow is a named series of steps the agent can run: much simpler than a journey, typically gathering
data over a few steps and then calling a function with it. Each step has instructions and a **completion
type** that decides when the step is done and what happens next. See
[AgentWorkflowDef](https://docs.kademi.co/ref/templating/md/AgentWorkflowDef.md) and
[AgentWorkflowStep](https://docs.kademi.co/ref/templating/md/AgentWorkflowStep.md).

```xml
<workflows>
    <workflow>
        <name>reorderRequest</name>
        <title>Raise a reorder request</title>
        <instructions>Collect what is needed to raise a reorder, then submit it. Be brief at every step.</instructions>
        <steps>
            <step>
                <name>identifyWidget</name>
                <instructions>Ask which widget to reorder and confirm it with listWidgets.</instructions>
                <completion class="immediate" nextStep="confirmQuantity">
                    <requiredFields>
                        <string>widgetId</string>
                    </requiredFields>
                </completion>
            </step>
            <step>
                <name>confirmQuantity</name>
                <instructions>Ask how many units to order, and repeat it back before continuing.</instructions>
                <completion class="confirm">
                    <confirmation>Raise a reorder for this widget and quantity?</confirmation>
                    <inner class="immediate" nextStep="submit"/>
                </completion>
            </step>
            <step>
                <name>submit</name>
                <instructions>Submit the reorder with the widget id and quantity collected so far.</instructions>
                <completion class="function">
                    <functionName>submitReorder</functionName>
                    <inner class="end"/>
                </completion>
            </step>
        </steps>
    </workflow>
</workflows>
```

The `class` attribute on `completion` and on any nested `inner` names the completion type. Completion types
nest, so you can require a confirmation and then a function call and then an end, in one step.

### Completion types

| `class` | What it does |
|---|---|
| `immediate` | Move to the next step straight away. `nextStep` names it, and `requiredFields` optionally lists fields that must already be in the workflow data first. [ImmediateAgentWorkflowStepCompletionType](https://docs.kademi.co/ref/templating/md/ImmediateAgentWorkflowStepCompletionType.md) |
| `prompt` | Run one or more `prompts` against the AI, then defer to `inner`. [PromptAgentWorkflowStepCompletionType](https://docs.kademi.co/ref/templating/md/PromptAgentWorkflowStepCompletionType.md) |
| `validate` | Wrap `inner` so it only completes once every one of `validationPrompts` is satisfied, each checked separately. [ValidationAgentWorkflowStepCompletionType](https://docs.kademi.co/ref/templating/md/ValidationAgentWorkflowStepCompletionType.md) |
| `confirm` | Show `confirmation` and wait for the user to agree, then defer to `inner`. [UserConfirmsAgentWorkflowStepCompletionType](https://docs.kademi.co/ref/templating/md/UserConfirmsAgentWorkflowStepCompletionType.md) |
| `function` | Complete once `functionName` has been called successfully, then defer to `inner`. [FunctionCallAgentWorkflowStepCompletionType](https://docs.kademi.co/ref/templating/md/FunctionCallAgentWorkflowStepCompletionType.md) |
| `decision` | Ask the AI to pick one of `choices` using `prompt`; each choice carries its own completion, with `defaultCompletion` when none apply. [DecisionAgentWorkflowStepCompletionType](https://docs.kademi.co/ref/templating/md/DecisionAgentWorkflowStepCompletionType.md) |
| `end` | Finish the workflow. Set `cancel` true, with an optional `reason`, to cancel instead. [EndWorkflowStepCompletionType](https://docs.kademi.co/ref/templating/md/EndWorkflowStepCompletionType.md) |

A `decision` uses [DecisionChoice](https://docs.kademi.co/ref/templating/md/DecisionChoice.md) entries. A
choice carries its name as an XML attribute, and its `description` is what the AI reads to decide, so write
that as a condition rather than a label:

```xml
<completion class="decision">
    <prompt>Is the widget marked out of production?</prompt>
    <choices>
        <choice name="retire">
            <description>Take this when the widget is out of production and should not be reordered.</description>
            <next class="immediate" nextStep="retireIt"/>
        </choice>
        <choice name="reorder">
            <description>Take this when the widget is still in production and simply needs restocking.</description>
            <next class="immediate" nextStep="confirmQuantity"/>
        </choice>
    </choices>
    <defaultCompletion class="end">
        <cancel>true</cancel>
        <reason>Could not tell whether the widget is still in production.</reason>
    </defaultCompletion>
</completion>
```

The `function` completion names the function's **own** name as its provider registered it, not the
namespaced `provider_function` form used in the definition's `functions` allow-list.

## Design notes

- **The instructions are the agent.** State what it is for, what it must not do, and what "done" looks
  like. Tell it to use only what its functions return and not to guess at ids or values. Plain ASCII, for
  the same token reason as tool descriptions.
- **Keep the tool list short.** Every tool's description and schema sits in context on every turn. An
  agent with forty tools spends most of its budget reading about tools it will not call, and picks worse
  among the near-duplicates. Split by domain and delegate.
- **An unattended run cannot ask a question.** For timers and event handlers, say what to assume when
  something is ambiguous, rather than leaving the agent to stall or invent.
- **Groups are the access boundary.** Members of any one of the listed groups can have the agent. That is
  separate from tool roles: the agent's own functions are still filtered by the running user's roles, so a
  user who has the agent but lacks a tool's role simply is not offered that tool.
