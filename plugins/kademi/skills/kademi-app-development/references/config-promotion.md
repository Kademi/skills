# Promoting configuration between environments

A client with more than one account - typically a dev account, sometimes a staging one, and
production - builds and tests in the lowest and moves the result up. The hard part is not moving
it. It is knowing with certainty **what** to move, because an account accumulates changes from
several people over weeks and a release that quietly includes something untested is how a
production incident starts.

Snapshots answer that. A snapshot captures the account's configuration at a moment, a diff between
two snapshots is exactly what changed between them, and a deployment item is that diff with a
decision recorded against each part of it.

This is almost entirely an admin console workflow. **There is nothing here to sync.** Snapshots,
diffs and deployment items are account state, not repository files - a snapshot is not a folder in
your app, and you cannot check one out with KSync. The one part that is your code is making your
own app promotable, at the end of this file.

Everything below lives in the admin console at **Settings > Configurations**
(`/account-settings/config-management`), documented at
<https://docs.kademi.co/blogs/docs-kb/configuration-management/>.

## What configuration is, and what it deliberately is not

Configuration is the **structure** of a solution: app settings, which apps are installed and at what
version, queries, dashboards, KCodes, journeys, points rules, and whatever else each installed app
contributes.

It is not:

- **Data** - profiles, organisations, sales records, points balances. Production has real people in
  it and dev does not; copying either way would be wrong.
- **Content** - blog articles, the promotions actually running. These are expected to differ.

So "why did my article not come across" has an answer: it was never in scope. That is not a fault
to chase.

## The shape of a release

On the **source** environment, the lower one:

1. Create a snapshot before the work starts, if nobody has. Without a "before" there is nothing to
   compare, and this is the step people skip and cannot recover afterwards.
2. Create a second snapshot once the work is built and tested.
3. Diff the two, and read the diff. Every snapshot page offers a comparison against another
   snapshot; **Settings > Configurations > All diffs** lists the ones already generated.
4. Decide about every section. A section is auto-applied on the target, applied manually by a
   person there, or ignored. A section with no decision recorded applies nothing - untriaged is not
   a safe default, it is a release that silently does half of what was intended.
5. Write the instruction for anything manual, against the section itself. "Recreate the Gold Tier
   journey node, matching the criteria in the source" is an instruction. "Journey changed" is not,
   and the person reading it on production has no way to find out what you meant.
6. Export the deployment item.

On the **target** environment, the higher one:

7. Upload the deployment item and read it back before applying anything.
8. Apply the sections that were agreed, and follow the job it starts.
9. Carry out the manual steps.

Applying a deployment item changes the account you are in. On production that is a production
change: it installs apps and rewrites settings. Read the package first and say what it will do.

## Trust flows one way

A higher environment may read a lower one. The apply job runs on the **target** and pulls from the
source, using the credentials from the pairing between the two accounts - production pulling from
staging is normal.

A lower environment must never reach a higher one. Dev does not read production, does not write to
it, and does not hold credentials for it. A request that would have configuration flow upward from
the environment you are in is not something to find a way around.

Pairing two environments is done once, by a person, in the admin console. It is not something an
app does and not a reason to ask anyone for production credentials.

## What must not travel

Some things are supposed to differ between environments, and moving them breaks the target:

- Endpoints, hostnames and callback URLs pointing at the environment they came from.
- Integration keys and credentials of any kind.
- Anything switched on for testing - a test mode, a redirect of outbound email, a shortened timer.

The fix for the first of those is not to keep catching it in diffs. Put the value in an environment
variable and reference it, so the same configuration is correct in both places; environment
variables and secrets are the `kademi-security` skill's subject, and they live on the Environment
variables page, `/account-settings/env-vars/` on the admin domain, linked from the Configurations page.

Where an item genuinely should never travel, add it to the account's ignore list. An ignore entry
names an app, optionally a config item type and optionally a single item, and matching items are
left out of every subsequent diff and deployment - so nobody has to notice it correctly every
single release. The ignore list is at **Settings > Configurations > Ignored configuration items**, and a
diff page warns you when ignores are hiding changes from the list you are reading.

Secrets are a special case. A diff can show you that a secret exists and name it; it cannot show
you the value. A secret that differs between environments is always a manual step for a person who
has the actual value.

## Making your own app promotable

This part is your code, in `APP-INF/`. Two registrations on
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md), both at
init like every other registration:

```javascript
controllerMappings.appendConfigFunction(appendMyAppConfig);
controllerMappings.applyConfigFunction(applyMyAppConfig);

function appendMyAppConfig(configBuilder) {
    formatter.foreach(myThings(), function (thing) {
        var props = formatter.newMap();
        props.title = thing.title;
        props.enabled = thing.enabled;
        configBuilder.add(thing.name, 'myThing', props);
    });
}

function applyMyAppConfig(config, acc) {
    formatter.foreach(config.myThing, function (delta) {
        if (delta.deleted) {
            return;
        }
        var thing = findOrCreateThing(delta.portableId);
        // delta.changes holds only the properties that differ
    });
}
```

`appendConfigFunction` is what puts your app's entities into a snapshot at all: without it, your
app contributes nothing to a diff and nothing about it can be promoted. `applyConfigFunction` is
what makes those entities importable on the target - without it the platform reports that the app
cannot apply config changes, and every one of its changes becomes a manual step.

Three things to get right in `appendConfigFunction`:

- **The first argument is the portable id, and it has to be stable across accounts.** It is what
  matches an item in the source snapshot to the same item in the destination. A database id is not
  stable across accounts; a name usually is.
- **Put only serialisable values in the props map** - strings, numbers, dates, booleans, and lists
  or maps of those. Not entities. A referenced entity is recorded by its name, so the target can
  look it up in its own data.
- **Nothing secret.** A snapshot is exported and moved between accounts.

## The object model

Reach for these when reading a diff from your own code rather than in the admin console. They hang
off the account manager - `createAccountConfigSnapshot`, `listSnapshots`, `loadSnapshot`,
`diffConfigSnapshots`, `applyIgnoredToDiff`, `findIgnoredItems`, `addIgnore` and `removeIgnore` are
all on [AccountManager](https://docs.kademi.co/ref/templating/md/AccountManager.md).

| Class | What it is |
|---|---|
| [AccountConfigSnapshot](https://docs.kademi.co/ref/templating/md/AccountConfigSnapshot.md) | One point-in-time capture, keyed by app id and then by config item type |
| [ConfigItem](https://docs.kademi.co/ref/templating/md/ConfigItem.md) | A single captured item: a portable id and a bag of properties. What `configBuilder.add` produces |
| [ConfigDiff](https://docs.kademi.co/ref/templating/md/ConfigDiff.md) | Everything that differs between two snapshots, plus `numChanges` and any `warnings` |
| [AppDeltas](https://docs.kademi.co/ref/templating/md/AppDeltas.md) | The changes for one app within a diff |
| [AppTypeDeltas](https://docs.kademi.co/ref/templating/md/AppTypeDeltas.md) | The changes of one config item type within an app. This is the unit a decision is recorded against |
| [AppTypeAction](https://docs.kademi.co/ref/templating/md/AppTypeAction.md) | The decision itself: `"a"` auto-applied, `"m"` applied manually, `"i"` ignored, plus who and when |
| [ConfigDelta](https://docs.kademi.co/ref/templating/md/ConfigDelta.md) | One changed item. `created`, `deleted` or `updated`, with `changedProps` naming what differs |
| [IgnoredConfigItem](https://docs.kademi.co/ref/templating/md/IgnoredConfigItem.md) | One ignore entry. A null app id, type or item id is a wildcard |
| [IgnoredConfigItemList](https://docs.kademi.co/ref/templating/md/IgnoredConfigItemList.md) | The account's whole ignore list |

Either side of a `ConfigDelta` can be null, and which one tells you what happened: no source item
means the item was created, no destination item means it was deleted.
