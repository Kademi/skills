---
name: kademi-server-js
description: Use when writing or debugging the server-side JavaScript of a Kademi app, lib or website - anything under APP-INF/ or a website's WEB-INF/, the controllers.xml that registers it, and the account's queries repository. Covers where server code can live and what each place can register, choosing the engine (engineVersion 2.0 is GraalJS and .mjs, 1.1 or unset is Nashorn and .js), the sandbox, registering controllers, menus, roles, components and services, website and admin routes, path resolvers versus GET handlers, POST handling and validation, roles and privileges, app settings, saved queries and custom index fields, the JSON database and user and membership APIs, background async jobs, sending and receiving email, and OAuth 2, CSRF and brute-force hardening. Use when a route 404s, a POST silently does nothing, a privilege check unexpectedly returns 403, a script needs to run in the background, or a server-side error needs tracking down.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: server js

Server-side JS runs inside the Kademi platform, in a sandboxed engine, with a set of Java-backed
globals bound into it. It is not Node. There is no `require`, no npm, no filesystem, no
`java.*`.

## Where server code lives

Three places in an account can hold server-side JavaScript, and all three extend the platform the
same way: a `controllers.xml` registering what the code provides, next to the scripts that implement
it.

| Where | Config file | Global |
|---|---|---|
| An app or lib repository | `/APP-INF/controllers.xml` | `controllerMappings` |
| A website repository | `/WEB-INF/controllers.xml` | `controllerMappings` |
| The account's `queries` repository | `/controllers.xml` at the root | `queries` |

**A website registers through the same class an app does.** `/WEB-INF/controllers.xml` deserialises
into the same
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md), and the
platform loads and initialises the two the same way, so a website can register most of what an app
can: routes, portlets, components, event listeners, journey node types, payment providers. Almost
nobody knows this. If you have only ever built websites, these extension points were open to you the
whole time. Three things are read from app repositories only, so they need an app: **JS services**
(`services.yourService`), **query tables**, and **admin menu items** (a website's `<menu>` entries
reach the website menu only). Everything else in this skill applies to `/WEB-INF/` unchanged. Build an
app when the feature could be reused or installed elsewhere, or needs one of those three; build it
into the website when it only makes sense for that one site.

**The `queries` repository is not an app and does not behave like one.** Its config is
`/controllers.xml` at the root with a different and much smaller schema (sources, tables, metrics,
data series content, product category content, and nothing else); the engine is always Nashorn at
ES2015, with no `engineVersion` attribute and no `.mjs`; the global is `queries`, not
`controllerMappings`; and **every write is live**, because only the live version is ever read, so
there is no draft version to try something on and the isolation that protects an app does not apply.
Know that before you write into it, not after.

**Two traps that look like bugs and are not.** A `controllers.xml` naming a script that does not exist
yet does not wait for it: GraalJS fails to initialise naming the file, but Nashorn, the default engine,
skips it with only a warning in the account log and the app comes up with everything that file would
have registered silently absent - so when a registration is missing for no reason, check the source
paths first. And a disabled app keeps every file while registering nothing; when source and runtime
disagree, the runtime is right.

Read [references/surfaces.md](references/surfaces.md) when you are deciding where a piece of code
belongs, creating a repository or choosing its kind, working in a website's `/WEB-INF/`, or writing
anything into the account's `queries` repository.

## Pick the engine first

Read `engineVersion` on the root `<controllers>` element of `/APP-INF/controllers.xml`, or of
`/WEB-INF/controllers.xml` in a website. It decides the file extension, and you do not get to
choose per file.

| `engineVersion` | Engine | Extension | Language |
|---|---|---|---|
| `2.0` | GraalJS | `.mjs` | ES2024 |
| `1.1` | Nashorn | `.js` | ES2015-ish |
| omitted | Nashorn | `.js` | ES5.1 |

A `.mjs` file in an app declared `engineVersion="1.1"` is never loaded. If you want ES modules,
`const`/`let`, arrow functions, template literals and `async`/`await`, set `engineVersion="2.0"`
and write `.mjs`. **Use GraalJS for anything new.**

Switching an existing app from 1.1 to 2.0 is a rewrite of every `.js` file in it, not a config
change: the Nashorn helpers behave differently and the logging global changes. Do not do it
casually.

Read [references/graaljs.md](references/graaljs.md) before writing or changing any `.mjs` file.
Read [references/nashorn.md](references/nashorn.md) before writing or changing any `.js` file, or
when a comparison, a loop or a `JSON.stringify` in one behaves strangely.

## The sandbox

Class filtering is on. These are blocked at runtime, not at lint time:

| Do not | Use instead |
|---|---|
| `Java.type('java.util.HashMap')` | `formatter.newMap()` |
| `new java.util.ArrayList()` | `formatter.newArrayList()` |
| Any fully-qualified Java class name | a `formatter.*` helper or a service method |
| Direct method calls on `application` | a manager under `services.*` |
| `application.call('otherApp', ...)` | that app's published JS service (see below) |

The globals bound into your engine are `controllerMappings`, `services`, `views`, `formatter`,
`securityManager` and `transactionManager`. GraalJS also gets `console` and standard web APIs such
as `navigator` and `fetch`. Nashorn gets `log` instead of `console`.

Long loops must yield or the platform CPU governor cannot interrupt the request. In Nashorn use
`formatter.foreach(...)`. In GraalJS call `securityManager.yield()` inside the loop
([ControllerSecurityManager](https://docs.kademi.co/ref/templating/md/ControllerSecurityManager.md)).

## Registering things: controllers.xml

`controllers.xml` declares which script files to load, which engine to use, lifecycle callbacks,
admin menu items, roles, and the app settings page. Everything else (controllers, services,
portlets, components, queries, event listeners) is registered from JS by calling
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md) methods on
the `controllerMappings` global.

```xml
<controllers engineVersion="2.0"
             onAppEnabled="_onAppEnabled"
             onAppUpdated="_onAppEnabled"
             onAppDisabled="_onAppDisabled">

    <source>/APP-INF/app.mjs</source>

    <menu parentId="menuECommerce" id="menuManageMyApp" path="/my-app/"
          text="My App" css="fas fa-star" ordering="100">
        <roles>
            <string>MyAppAdmin</string>
        </roles>
    </menu>

    <role class="role">
        <name>MyAppAdmin</name>
        <privNames>
            <string>WRITE_CONTENT</string>
        </privNames>
        <description>Allows users to manage My App</description>
        <category>Administrative</category>
    </role>

    <settings enabled="true" path="/theme/apps/myapp/settings.html">
        <function>saveSettings</function>
    </settings>
</controllers>
```

Registration only takes effect while the engine is initialising. Calling `controllerMappings.*`
add methods later is silently ignored, so register at module top level, not inside a handler.

Read [references/controllers-xml.md](references/controllers-xml.md) when you are adding or
changing anything in `controllers.xml` - a source file, a menu item, a role, the settings page, a
lifecycle callback - or when something declared there never appears.

## Routes, path resolvers and handlers

Build a route with
[ControllerMappingBuilder](https://docs.kademi.co/ref/templating/md/ControllerMappingBuilder.md),
from `controllerMappings.websiteController()` for public site pages or
`controllerMappings.adminController()` for admin screens.

```js
controllerMappings
    .websiteController()
    .path('/posts/(?<postId>[^/]*)')
    .addPathResolver('postId', 'resolvePost')
    .addMethod('GET', 'showPost')
    .enabled(true)
    .isPublic(true)
    .build();
```

`.path(...)` takes a literal path or a regular expression with named groups.
`.pathSegmentName('token')` matches one fixed segment. `.pathSegmentResolver('clientId',
'resolveClient')` matches one dynamic segment and resolves it.

### Resolvers run before authentication

A resolver is called during URL resolution, **before the user is authenticated**. There is no
current profile inside it. Its only job is to turn a path segment into an entity, or return
`null` so the request 404s.

```js
globalThis.resolvePost = (rf, groupName, groupVal) => {
    const db = rf.find('/jsondb/my-posts');
    return db ? db.child(groupVal) : null;   // null means 404
};
```

The first argument is the root folder for the request:
[WebsiteRootFolder](https://docs.kademi.co/ref/templating/md/WebsiteRootFolder.md) for a website
controller, [OrganisationRootFolder](https://docs.kademi.co/ref/templating/md/OrganisationRootFolder.md)
for an admin one. Whatever you return replaces the raw segment value.

### Access checks belong in a GET handler

Add `.addMethod('GET', 'handlerFn')`. That handler runs after authentication, so the current user
is available, and `page.throwNotAuthorized(msg)` denies access.

```js
globalThis.showPost = (page, params, files, fc) => {
    const curUser = services.userManager.currentProfile;
    if (!curUser) {
        page.throwNotAuthorized('Not authorized');
    }
    page.attributes.post = page.pathParams.postId;   // the resolved record
    return views.templateView('/theme/apps/myapp/post.html');
};
```

`page` is a [ControllerResource](https://docs.kademi.co/ref/templating/md/ControllerResource.md);
it also offers `throwNotFound`, `throwBadRequest`, `pathParams`, `attributes` and `appSettings`.
Return a view from [ViewsBuilder](https://docs.kademi.co/ref/templating/md/ViewsBuilder.md):
`views.templateView(path)`, `views.redirectView(href)`, `views.jsonResult(true, 'ok')`,
`views.textView(text, 'text/plain')`, `views.csvView(rows)`.

## POST handlers and validation

`addMethod` for `POST` takes **the handler function name first and the triggering request
parameter second**. Both are strings, so the wrong order fails silently: the POST falls through
to the default view instead of your handler.

```js
controllerMappings
    .adminController()
    .path('/my-app/items/')
    .addRole('MyAppAdmin', 'READ_CONTENT', 'WRITE_CONTENT')
    .postPriviledge('WRITE_CONTENT')
    .addMethod('GET', 'listItems')
    .addMethod('POST', 'createItem', 'newItem')   // fires when the body has newItem=true
    .enabled(true)
    .build();
```

Never read request parameters directly. Extract every one through a
[ValidationContext](https://docs.kademi.co/ref/templating/md/ValidationContext.md) obtained from
the [FormContext](https://docs.kademi.co/ref/templating/md/FormContext.md) handler argument, then
check `vc.isValid()` before doing anything.

```js
globalThis.createItem = (page, params, files, fc) => {
    const vc = fc.newValidationContext();

    const title = vc.validateString('title', true, 200);
    const qty = vc.validateInteger('qty', true, 1, 999);
    const active = vc.validateBoolean('active', false, true);
    const payload = vc.validateRawString('payloadJson', false);  // JSON: raw, not sanitised

    if (!vc.isValid()) {
        return vc.toJsonResult();
    }

    return transactionManager.executeInTransaction(() => {
        services.myAppManager.createItem(title, qty, active, payload);
        return views.jsonResult(true, 'Saved');
    });
};
```

Rules that keep POSTs correct:

- `validateString` runs HTML sanitisation. It corrupts JSON, paths and anything containing `&`,
  `<` or `>`. Use `validateRawString` for structured blobs and parse them yourself.
- Open and commit the transaction in the controller function, never inside a helper it calls.
- Mutating endpoints return a [JsonResult](https://docs.kademi.co/ref/templating/md/JsonResult.md),
  so the browser gets `status` plus field errors.
- Put the business logic in a separate module that takes plain arguments and returns plain
  values. The controller is the only part that knows about requests.

## Roles and privileges

Two ways in. Roles you define yourself go in `controllers.xml` (`<role class="role">`), then get
granted on a mapping with `.addRole('MyAppAdmin', 'READ_CONTENT', 'WRITE_CONTENT')`. Privilege
names are `READ`, `WRITE`, `READ_CONTENT`, `WRITE_CONTENT`, `WRITE_ACL` and similar.

**A platform-defined role also needs a matching `.addType(...)`.** Platform roles only grant
privileges on resources of the type they apply to. Without the type tag the `.addRole` is
silently ignored and the user gets a 403 even though they hold the role.

```js
controllerMappings
    .adminController()
    .path('/my-app/people/')
    .addRole('User Administrator', 'READ_CONTENT')
    .addType('userAdminResource')      // required, or the addRole does nothing
    .addMethod('GET', 'listPeople')
    .enabled(true)
    .build();
```

To find the type for a platform role, look the role up in the API reference (the Roles section of
`https://docs.kademi.co/ref/templating/md/index.md`) and read its description: it names the
resource it applies to. For example
[ProductManagerRole](https://docs.kademi.co/ref/templating/md/ProductManagerRole.md) says it
applies to "the ProductManagerResource", so the tag is `.addType('productManagerResource')` -
same name, lower-camel first letter.

**POSTs must grant and require the same privilege.** A mapping with no `.postPriviledge(...)`
requires `WRITE`. Privilege checks resolve downward only: a granted parent satisfies a required
child, never the reverse, so a role granted `WRITE_CONTENT` does not satisfy a required `WRITE`.
Set both `.addRole(role, 'READ_CONTENT', 'WRITE_CONTENT')` and `.postPriviledge('WRITE_CONTENT')`.
The symptom of getting this wrong is a generic "authorisation declined" for a non-admin who
clearly has the role, while admins succeed.

`Administrator` implicitly grants everything, so never add it with `.addRole`.

## App settings

Settings are named strings scoped to your app id, at account level or per website branch. Declare
the editing UI with the `<settings>` element (above); the named function receives the form POST.

```js
// read
const key = services.websiteManager.getSetting('my-app', 'apiKey', branch);
// write
services.websiteManager.setSetting('my-app', 'apiKey', branch, value);
```

From a Velocity template: `$services.websiteManager.getSetting('my-app', 'apiKey', $branch)`.
Inside a controller handler, `page.appSettings` is the already-loaded map for the current
organisation and branch.

**Use `getSetting`, not `getRawSetting`.** `getSetting` resolves `${my.variable}` and
`${secret.name}` placeholders; `getRawSetting` deliberately returns the stored value verbatim, for
the settings editor UI that has to show and re-save the placeholder. A credential fetched with
`getRawSetting` goes out to the provider as the literal string `${secret....}`. See
[WebsiteManager](https://docs.kademi.co/ref/templating/md/WebsiteManager.md) and
[kademi-security](../kademi-security/SKILL.md).

## Caching

Never hold a cache in a module-level object: app instances are shared across accounts, so a value
cached while serving one account is served to the next. Declare one instead:

```js
controllerMappings.cacheBuilder()
    .cacheName('skuLookups')
    .maxSize(500)
    .expireAfterWrite(300000)
    .build();

const sku = controllerMappings.getCacheValue('skuLookups', code, () => loadSku(code));
```

Keys are scoped per organisation, and per branch for a website, and the cache is discarded when the
app is updated. Caches are process-local, so treat them as a latency optimisation, never as shared
state. See [CacheBuilder](https://docs.kademi.co/ref/templating/md/CacheBuilder.md) and
[kademi-security](../kademi-security/SKILL.md).

## Services

A JS service is how one app calls another. Publish yours with
`controllerMappings.newServiceBuilder('myThingManager').serviceObject(obj).build()`, and consume
someone else's as `services.myThingManager.doThing(...)`, from JS or from Velocity as
`$services.myThingManager.doThing(...)`. Expose stable high-level operations only, and never your
internal helpers. Read [references/services.md](references/services.md) when you are publishing
a service, consuming another app's, or `services.yourThing` is undefined at the call site.

## Queries, search and stored data

Read [references/queries.md](references/queries.md) when a task involves searching or reporting
over records: saved search queries, custom indexed fields, query tables and criteria queries, or
a search that returns the wrong rows.

Two query-table traps worth knowing before you open it. **The loader signature differs by where the
table is registered**: an app, lib or website loader is `(start, maxRows, rowsResult, rootFolder,
status, params)`, and a `queries` repository loader is `(rowsResult, rootFolder, status, params)` -
copy one into the other and `rowsResult` is bound to the number `0`. And **a loader that throws
comes back as data**: the platform catches it and returns the exception text as the table's cells,
so nothing turns red and the app still initialises. Run the table, do not assume it.

Read [references/data-apis.md](references/data-apis.md) when a task involves storing or reading
your app's own data: the JSON database, the user and membership API, and custom index fields.

## Email, notifications and inbound mail

Read [references/email-and-notifications.md](references/email-and-notifications.md) when an app
has to send mail or react to mail arriving: sending from an app, notification automations,
calling your app's API from an email template, and capturing incoming mail with a mailbox
controller.

## Background jobs

Anything slower than a request - an import, a bulk update, a slow external API - belongs on the
job queue, not in the handler. Submit the work with
[AsyncJobManager](https://docs.kademi.co/ref/templating/md/AsyncJobManager.md), return the job
id, and let the browser poll it.

```js
const taskParams = formatter.newMap();          // serialisable values only, never entities
taskParams.put('categoryId', categoryId);
const curUser = services.userManager.currentProfile;

const job = services.asyncJobManager.newAsyncTask(
    'my-app', 'Rebuild the item index', '_rebuildIndex', taskParams, null, curUser, curUser);
return views.jsonResult(true, 'Rebuild started', String(job.id));
```

Read [references/background-jobs.md](references/background-jobs.md) when a script needs to run in
the background, when a request is timing out or being interrupted by the CPU governor, or when a
job reports itself cancelled that nobody cancelled.

## Authentication and hardening

Read [references/auth.md](references/auth.md) when a task touches sign-in or a machine-called
endpoint: OAuth 2 sign-in providers, CSRF token rules (and the `excludeCsrf` paths a
machine-called endpoint needs), and brute-force protection.

## When it fails on a live account

**Did the app load at all?** Ask that first after any change to a script or to `controllers.xml`. An
app that fails to initialise does not half work; everything it registers disappears at once and the
symptom turns up somewhere else. The init error, init date and init logs are on the app's row at
**Websites & apps > Apps** in the admin console, and initialising is not the same as working: anything
called later still has to be run. The procedure is
[kademi-coding-standards/references/verification.md](../kademi-coding-standards/references/verification.md).

For a failure at request time the response tells you almost nothing: an uncaught exception becomes a
500 error page with the status code and no message. Reach for a **debug session** - started from
the admin console's developer tools and scoped to a path prefix or task name, it captures the
request, its parameters, the authenticated user, timings and every log line that one operation
wrote, including debug levels the account log discards. The account log is the fallback for
failures you cannot reproduce on demand.

Read [references/troubleshooting.md](references/troubleshooting.md) when something throws, 404s
or returns null on a hosted account and you need to find out why: where the error surfaces, what
your own logging output gets you, telling a syntax error from a runtime error, and what a silent
null means.

## Before you call a method

`services.*`, `formatter`, `views`, `page`, `vc` and every entity you touch are Java objects
dispatched dynamically. A method that does not exist is not a lint error - it throws
`TypeError: <name> is not a function` at runtime, only on the code path that calls it, so it
survives review and reaches production.

Look it up first. The public reference is one Markdown file per class:
`https://docs.kademi.co/ref/templating/md/<ClassName>.md`, indexed at
`https://docs.kademi.co/ref/templating/md/index.md`. Use the `kademi-api-reference` skill.

## Related skills

- **kademi-api-reference** - confirm any class, manager, builder or method before calling it. A
  method that does not exist fails only at runtime, on the path that calls it.
- **kademi-admin-ui** - the admin screen and the browser JavaScript sitting on top of an admin
  route: page layout, tables, dialogs, the forms plugin, and the client half of polling a
  background job.
- **kademi-themes** - the Velocity templates a controller renders with
  `views.templateView(...)`, and the `dependencies.json` that declares the app's browser assets.
- **kademi-integrations** - bulk data work: imports, exports, feeds, pipelines, map-reduce over
  large datasets, and running work on a schedule. Reach for it instead of hand-rolling a loop
  over thousands of rows.
- **kademi-journeys** - journey and automation node types registered from server JS: custom
  goals and actions, journey fields, triggers, and app events journeys respond to.
- **kademi-ai** - prompt functions, agent definitions and MCP servers registered from server JS,
  and the result envelope their tools return.
