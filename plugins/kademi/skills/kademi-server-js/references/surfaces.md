# Where server code lives

Three places in a Kademi account can hold server-side JavaScript. All three extend the platform the
same way - a `controllers.xml` registering what the code provides, alongside the scripts that
implement it - but they are not interchangeable, and only two of them are the same API.

| Where | Config file | Global | Engine |
|---|---|---|---|
| An app or lib repository | `/APP-INF/controllers.xml` | `controllerMappings` | whichever `engineVersion` declares |
| A website repository | `/WEB-INF/controllers.xml` | `controllerMappings` | whichever `engineVersion` declares |
| The account's `queries` repository | `/controllers.xml` at the root | `queries` | always Nashorn, always ES2015 |

## An app or lib

A repository of its own with `/APP-INF/controllers.xml` at its root. It is the most capable of the
three: anything the platform can be extended with can be registered from an app, and an app can be
published to the Marketplace and installed into other accounts.

```
/APP-INF/                       server-side scripts and controllers.xml
/common/theme/apps/<appPath>/   templates and assets shared by admin and website
/admin/theme/apps/<appPath>/    admin-only templates and assets
/website/theme/apps/<appPath>/  website-only templates and assets
```

There are four kinds of repository, and the choice is about what the thing **is**, not about what it
is allowed to do:

| Kind | It is |
|---|---|
| App | A directly installable unit. What someone means by "an app I can add to a website" |
| Lib | Only ever a dependency of an app, never installed on its own. The right kind for shared code |
| Theme | A website's stylesheets and theme templates. Normally one per website |
| Recipe | A solution builder, used by the solution wizard to create fully configured websites |

A lib is declared by providing **none** of the other three rather than by a flag of its own, which
is why a repository is created with one kind rather than a set of switches. A lib can still register
routes, services and every extension point an app can.

Repositories are created **in the admin console**, at **Websites & apps > Apps** on the **App Builder**
tab, **Create new app**; the Developer hub links to the same tab. `kademi-app-development` covers creating, versioning and publishing one, and the KSync
commands that get files between your machine and it.

## A website

A website is a repository too, and it registers through `/WEB-INF/controllers.xml`. That file
deserialises into the same
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md) an app's
does, and the platform loads and initialises the two the same way. So a website can register most of
what an app can - routes, portlets, components, event listeners, journey node types, payment
providers - with the same XML schema and the same `controllerMappings` global.

Three registrations are collected from app repositories only, so a website's are never read:

- **JS services.** `services.yourService` only ever comes from an app or lib.
- **Query tables.** `addTableDef` in a website registers nothing anybody can query.
- **Admin menu items.** A website's `<menu>` entries are matched against the website menu only, with
  no section remapping, and cannot add an admin console menu item.

If the feature needs one of those, it is an app.

The layout is the flat equivalent of an app's, because a website is only ever served on one surface:

```
/WEB-INF/               server-side scripts and controllers.xml
/theme/apps/<appPath>/  templates and assets
```

Which to build: an app when the feature could be reused or installed elsewhere; a website when it
only makes sense for that one site.

## The account's `queries` repository

A single repository per account, named `queries`, holding account-level saved queries and reports,
lookup XML, and rules files for points, points expiry, recognition points, record matchers and
voucher expiry. Four things about it are not guessable from anything an app does.

**Its config is `/controllers.xml` at the root**, and the schema is a different and much smaller one
than an app's. It understands `<source>`, `tables`, `metrics`, `dataSeriesContent` and
`productCategoryContent`, and nothing else. There is no `APP-INF`, no `<menu>`, no `<role>`, no
`<settings>`. An app's controllers.xml pasted in here does not partly work.

The `<table>` element inside it is a different feature - a criteria table defined in XML - and has
nothing to do with `addTableDef`. Do not try to declare a JS-backed table there.

**The engine is always Nashorn at ES2015.** There is no `engineVersion` attribute to set, `.mjs`
files do not work, and GraalJS is not available. Write `.js` to the rules in
[nashorn.md](nashorn.md).

**The global is `queries`, not `controllerMappings`**, and what it registers is a different and much
shorter list - saved-query registration, custom indexed fields, tables, metrics and the rule types
above. Nothing registered on `controllerMappings` exists here. See
[Queries](https://docs.kademi.co/ref/templating/md/Queries.md).

**Every write is live.** Only the live version of this repository is ever read, so there is no draft
version to try something on, and the branch isolation that protects an app does not apply. Know that
before you write, not after.

An account may not have one at all. The platform creates it the first time something saves a query,
report or metric into it, so on an account that has never had one there is nothing to check out
until a query is saved from the queries page in the admin console, `/queries/` on the admin domain,
which is linked from the index queries page under **Data & reports** rather than listed in the menu.

When this repository fails to load it fails wholesale: every rule type, matcher and table in it goes
at once, not just the file with the mistake.

Given the choice, put the code in an app or a lib. The `queries` repository is the right home only
for something account-level that has no app to belong to.

## Write the scripts before the controllers.xml that names them

`controllers.xml` is a list of files to load, and the app initialises the moment that file is
written. A `controllers.xml` naming a script before that file exists does not wait for it, and the
engines differ in how they say so. On GraalJS initialisation fails, every time, naming the app and
the missing source. On Nashorn the missing file is skipped with one warning line in the account log
(`Source file is empty or missing: <path>`, no app name): the app initialises with no init error, and
everything that file would have registered is silently absent.

That is not a broken app. It is an app you have not finished writing. Sync in dependency order - the
scripts first, then the controllers.xml that declares them - and the init check means something at
every step. A new app is the one case where the order of writes is not a matter of taste.

## Source is not the same question as runtime

A disabled app keeps its whole repository. Every file is still there and still readable, and nothing
it registers exists: no route, no component, no query table, no event listener. Accounts accumulate
these - superseded, evaluated and switched off, disabled during an incident.

Two things follow. Nothing registered only by a disabled app can be run, so when the source and the
runtime disagree the runtime is right and there is nothing to reconcile. And **code from a disabled
app is the code least worth copying**, because nothing has kept it correct. Check the app is enabled
in the admin console at **Websites & apps > Apps** before you treat it as an example.

## Learning an extension point

The best reference for a registration you have not used before is a working use of it. Search your
own checked-out tree for the registration method by name - `addComponent`, `addEventListener`,
`addPointsRuleType`, `addFunnelActionType` - across every app and lib you have locally, and read the
file it lands in. Confirm the signature in
`https://docs.kademi.co/ref/templating/md/<ClassName>.md` before you copy it, because an example can
be older than the method.
