# GraalJS (.mjs)

Applies to every `.mjs` file under `APP-INF/` in an app whose `controllers.xml` declares
`engineVersion="2.0"`. Target ES2024 and write ordinary modern JavaScript.

## Module structure

Use ES modules with a single entrypoint, conventionally `app.mjs`, and declare only that file in
`controllers.xml`. It imports everything else.

```xml
<controllers engineVersion="2.0" onAppEnabled="_onAppEnabled" onAppUpdated="_onAppEnabled">
    <source>/APP-INF/app.mjs</source>
</controllers>
```

```js
// APP-INF/app.mjs
import './mappings.mjs';
import './services.mjs';
import { ensureDatabase } from './common.mjs';

globalThis._onAppEnabled = (orgRoot, websiteRoot) => {
    ensureDatabase(orgRoot);
};
```

## Exposing functions to the platform

Anything the platform calls by name - controller handlers, resolvers, lifecycle callbacks,
breadcrumb functions, indexed-field functions, async task functions - must be on `globalThis`. A
plain top-level `function` declaration in a module is module-scoped and will not be found.

```js
globalThis.listItems = (page, params, files, fc) => { /* ... */ };
```

Keep everything else module-local and `export` it normally for use by your other modules.

## Logging

Use the standard `console`: `console.log`, `console.warn`, `console.error`. A `log` global exists
only to ease migration of older code; do not use it in new `.mjs`.

## Write native JavaScript

The `formatter` compatibility helpers exist for the older engine. In GraalJS use the language:

- `for...of`, `Array.prototype.map/filter/forEach`, spread, destructuring
- `===`, `?.`, `??`, `Map`, `Set`, `JSON.stringify` on plain objects
- `async`/`await` and promises

`formatter` is still bound, and is still the right tool for the things it does that the language
does not: date formatting, currency, CSV, and building Java collections when a Java-backed API
demands one. See [Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md).

Two things do still need care:

- `JSON.stringify` on a **Java** object (an entity, a manager result, a `services.*` return value)
  gives you `{}`, because Java getters are not enumerable JS properties. Use
  `formatter.toJson(obj)` for those.
- Long tight loops do not yield, so the CPU governor cannot interrupt the request. Call
  `securityManager.yield()` inside them.

## File storage: navigator.storage

The runtime implements the standard
[StorageManager / File System Access](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/getDirectory)
API (the origin private file system). Prefer it over the older
[FileStorageManager](https://docs.kademi.co/ref/templating/md/FileStorageManager.md) in new `.mjs`
code.

```js
const scratch = await navigator.storage.getDirectory();                    // ephemeral
const durable = await navigator.storage.getDirectory({ persist: true });   // survives the request
const shared = await navigator.storage.getDirectory({ persist: true, path: 'team-files' });

const fh = await durable.getFileHandle('report.csv', { create: true });
const w = await fh.createWritable();
await w.write(csv);
await w.close();

const text = await (await fh.getFile()).text();
await navigator.storage.estimate();
```

`getFileHandle`, `getDirectoryHandle`, `removeEntry`, `entries()`, `createWritable` and
`createSyncAccessHandle` all behave as specified. Stores are scoped to your account, and quota
capped: an over-cap write throws `QuotaExceededError`.

## Java objects are still Java objects

`services.*`, `views`, `formatter`, the `page` argument, the form context and every entity are
Java objects dispatched dynamically. `node --check` and ESLint cannot see their method lists. A
call to a method that does not exist throws `TypeError: <name> is not a function` at runtime, on
that path only. Confirm the method in the reference before calling it:
`https://docs.kademi.co/ref/templating/md/<ClassName>.md`.

## Checklist

- [ ] `engineVersion="2.0"` in `controllers.xml`, single `.mjs` entrypoint declared as `<source>`
- [ ] Every platform-invoked function assigned to `globalThis`
- [ ] `console.*`, not `log.*`
- [ ] No `Java.type`, no `java.*`, no direct calls on `application`
- [ ] `formatter.toJson` (not `JSON.stringify`) for Java objects
- [ ] `securityManager.yield()` in long loops
- [ ] POST params extracted through the validation context, mutating handlers return a JsonResult
