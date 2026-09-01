# The Kademi review

Run this over the files you changed before handing work back. It is the checklist form of
[SKILL.md](../SKILL.md), plus searches that find most violations mechanically.

**Scope it to your own app, or to your diff.** Run over a whole account's apps and the loop and
comparison checks will return hundreds of pre-existing hits and tell you nothing. From the app
root:

```bash
cd <your-app>            # the directory containing APP-INF/
```

The searches use [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`). `grep -rn` with the same
pattern works too; `-P` replaces `--pcre2`. Every search here prints file and line, and **no output
means the check passed** - except the `engineVersion` lookup in check 4, which is informational.

## 1. Sandbox escapes

```bash
rg -n 'Java\.type|new java\.|java\.(util|lang|io|net)\.' APP-INF
```

Any hit is blocked at runtime. Replace with `formatter.newMap()`, `formatter.newArrayList()` or a
manager method. Polyfill files that shim a browser API are the one common false positive - check
what the file is before changing it.

## 2. Reaching around the service layer

```bash
rg -n 'application\.call\(|\bapplication\.[a-zA-Z]' APP-INF
```

Calls into another app must go through that app's published JS service
(`services.thatManager.doThing(...)`), and platform calls must go through `services.*`.

## 3. Leaking implementation detail out of a service

```bash
rg -n 'return\s+\w+\.(hits|search)\b|return\s+services\.\w+\.(query|search)\(' APP-INF
```

A method that hands back a raw search response ties every caller to Elasticsearch's response shape.
Map it to your own structure first.

## 4. Engine rules

Which set applies is decided by `engineVersion` on the root element of `APP-INF/controllers.xml`:

```bash
rg -n 'engineVersion' APP-INF/controllers.xml
```

`2.0` means GraalJS and `.mjs`. `1.1`, or no match at all, means Nashorn and `.js`.

### Nashorn (`.js`)

```bash
rg -n --glob '*.js' '===|!==' APP-INF
rg -n --glob '*.js' '\bfor\s*\(|\bwhile\s*\(' APP-INF
rg -n --glob '*.js' 'console\.(log|warn|error)\(' APP-INF
```

`===` against a Java `Long` id is always false - use `formatter.eq`. Native loops do not yield, so
the CPU governor cannot interrupt a runaway request - use `formatter.foreach`. Logging is `log.*`.

### GraalJS (`.mjs`)

```bash
rg -n --glob '*.mjs' '\blog\.(info|warn|error|debug)\(' APP-INF
rg -n --glob '*.mjs' 'formatter\.(foreach|eq|isNull|isNotNull|isEmpty)\(' APP-INF
```

Use `console.*` and native JavaScript. The `formatter` compatibility helpers are for Nashorn;
`formatter` itself is still correct for dates, currency, CSV and building Java collections.

Every function the platform calls by name must be on `globalThis` - a module-scoped `function`
declaration is invisible to it. This prints any handler that is registered but never exported:

```bash
comm -23 \
  <(rg -oNI "addMethod\('[A-Z]+', *'(\w+)'" -r '$1' APP-INF --glob '*.mjs' | LC_ALL=C sort -u) \
  <(rg -oNI 'globalThis\.(\w+)' -r '$1' APP-INF --glob '*.mjs' | LC_ALL=C sort -u)
```

## 5. Dates

```bash
rg -n 'formatter\.format(Date|DateTime|Time)\b' APP-INF
```

Replaced by the `dateManagerV1` service.

## 6. App settings and secrets

```bash
rg -n 'getRawSetting\(' APP-INF
rg -n --pcre2 -i '(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*.[A-Za-z0-9+/_-]{16,}' \
   APP-INF admin website common theme 2>/dev/null
```

`getRawSetting` skips `${...}` substitution, so a setting holding `${secret.stripeKey}` comes back
as the literal placeholder. Use `getSetting` unless you specifically want the unresolved value.

The second search finds credentials committed into source. Anything it returns is an incident, not
a cleanup: rotate the credential, then move it to a secret. See
[kademi-security](../../kademi-security/SKILL.md).

## 7. Client-side

```bash
rg -n --pcre2 --glob '*.html' '<script(?![^>]*\bsrc=)' admin website common theme 2>/dev/null
rg -n --glob '*.js' '\$\.ajax\(' -A 8 admin website common 2>/dev/null | rg 'success:|error:|complete:'
```

`<script type="text/template">` blocks are markup, not code - ignore those. Real inline `<script>`
breaks CSRF support - move it to a `.js` file declared in `dependencies.json`.
jQuery's `success`/`error`/`complete` callbacks are removed in the next major version; use `.done()`
and `.fail()`, or `fetch`.

## 8. Read the code for these

No search finds them.

- [ ] The controller checks that the current user is permitted to do this, before doing it.
- [ ] The transaction is opened in the controller method, not in a function it calls.
- [ ] POST parameters come from the validation context; the handler returns a `JsonResult`.
- [ ] Business logic is in a service file taking plain arguments, not in the controller.
- [ ] Failures throw, with context in the message. No error signalled by a return value.
- [ ] Every code path returns the same shape.
- [ ] Nothing mutable is held in module or global scope - app instances are shared across accounts.
- [ ] Each `if (x)` has a decided answer for the `else` - throw, warn, or return early.
- [ ] Logging covers the entry points, not the inside of loops, and never a credential.
- [ ] Any platform class or method used exists, with those arguments, in the API reference at
      `https://docs.kademi.co/ref/templating/md/<Class>.md`.
- [ ] Velocity: services looked up once at the top, paginator for lists, `standardTable` for
      tables.
- [ ] New app, lib or theme? `engineVersion="2.0"` and `.mjs`. Existing app? Leave it on Nashorn.
- [ ] The app version was bumped if the account already has this app installed.
