# Nashorn (.js)

Applies to every `.js` file under `APP-INF/` in an app whose `controllers.xml` declares
`engineVersion="1.1"` or omits `engineVersion`. This is the legacy engine. Use it to maintain
existing apps; write new apps on GraalJS.

## Language target

- Default to ES5.1. Declare variables with `var`.
- `let` and `const` are available only when `engineVersion="1.1"` is set explicitly.
- Avoid arrow functions, `class`, template literals, destructuring, default parameters,
  spread/rest and `for...of`.
- Functions the platform calls by name are plain top-level `function` declarations. There is no
  `globalThis` step and no module system: files load in the order their `<source>` elements
  appear, so declare dependencies before dependents.

## Sandbox bans

| Do not | Use instead |
|---|---|
| `Java.type('java.util.HashMap')` | `formatter.newMap()` |
| `new java.util.ArrayList()` | `formatter.newArrayList()` |
| Any fully-qualified Java class name | a `formatter.*` helper or a service method |
| `application.call(...)` to reach another app | that app's published JS service |
| Direct method calls on `application` | a manager under `services.*` |

## Loops and comparisons

Native loops and operators do not yield, so the CPU governor cannot interrupt them, and native
comparison operators are wrong against Java values. The
[Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md) helpers yield, are null-safe,
and normalise types before comparing.

| Instead of | Use |
|---|---|
| `for (var i = 0; i < arr.length; i++)` | `formatter.foreach(arr, function (item) { ... })` |
| `for (var k in obj)` | `formatter.foreach(obj, function (v, k) { ... })` |
| `x === null`, `x === undefined` | `formatter.isNull(x)` |
| `x !== null` | `formatter.isNotNull(x)` |
| `s === '' \|\| s == null` | `formatter.isEmpty(s)` (also true for null/empty Java collections) |
| `s !== ''` | `formatter.isNotEmpty(s)` |
| `a === b` on objects | `formatter.isEqual(a, b)` |
| `a !== b` on objects | `formatter.isNotEqual(a, b)` |
| `a === b` on ids or numbers | `formatter.eq(a, b)` |
| `a > b`, `a >= b`, `a < b`, `a <= b` | `formatter.gt/gte/lt/lte(a, b)` |

The id case is the one that bites hardest. A Kademi id arrives as a Java `Long`, and `===`
against a JS number is always false. `formatter.eq(profile.id, someId)` is the only correct
comparison.

## Serialising to JSON

`JSON.stringify(javaObject)` returns `{}`: a Java bean's getters are not enumerable JS
properties. Use `formatter.toJson(obj)` or `formatter.toJson(obj, indentSpaces)`, which goes
through Jackson and respects getters and annotations. `JSON.stringify` is fine for plain JS
objects you built yourself.

## Logging

Use the `log` global with `{}` placeholders. Do not use `console.log` or `print`.

```js
log.info('user {} saved profile', userId);
log.warn('missing setting: {}', key);
log.error('failed to save', ex);
```

## Background tasks

Engine-neutral, and documented in [background-jobs.md](background-jobs.md).

## Reading request data

- Never touch the raw request. Use `formContext.cleanedParam(name)`.
- Read JSON and other structured blobs with `form.rawParam(name)`. `cleanedParam` runs OWASP HTML
  sanitisation and silently corrupts JSON and paths (`&`, `<`, `>`).
- In POST handlers extract everything through the validation context
  (`vc.validateString`, `vc.validateInteger`, ...), then check `vc.isValid()`.

## Linting

Functions referenced only by name from `.addMethod('GET', 'myFn')` will look unused to a linter.
That is expected; the platform calls them by name at runtime.

## Checklist

- [ ] No `Java.type`, no `java.*`
- [ ] No native loop over a collection - used `formatter.foreach`
- [ ] No `===`/`!==`/`<`/`>` against Java values - used `formatter.eq`/`isEqual`/`gt`/...
- [ ] `var` (unless `engineVersion="1.1"`)
- [ ] No direct `application.*`, no `application.call` to another app
- [ ] `formatter.toJson`, not `JSON.stringify`, for Java objects
- [ ] Controller checks permissions and owns the transaction
- [ ] POST params via the validation context; mutating endpoints return a JsonResult
