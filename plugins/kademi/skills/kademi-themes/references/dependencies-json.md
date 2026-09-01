# dependencies.json

`dependencies.json` declares the browser assets an app needs, and the other apps it relies on.
Kademi reads every active app's file, combines the JavaScript and CSS into the smallest number of
files it can, and writes the `<script>` and `<link>` tags into the page. You never write those
tags yourself.

---

## Where it goes

```
<root>/theme/apps/<appId>/dependencies.json
```

`<root>` is `admin`, `website` or `common`, and the choice decides where the assets load:

| Location | Loads on |
|---|---|
| `admin/theme/apps/<appId>/dependencies.json` | admin screens |
| `website/theme/apps/<appId>/dependencies.json` | public website pages |
| `common/theme/apps/<appId>/dependencies.json` | both |

An app that needs different assets in the two contexts has two files, one under `admin/` and one
under `website/`. That is normal - the admin file typically pulls in editor and settings scripts
the public site does not need.

---

## Format

```json
{
    "appDependencies": [
        { "appId": "moment-lib", "branch": "2.30.1.4" },
        { "appId": "handlebars-lib", "branch": "4.7.9" }
    ],
    "dependencies": [
        { "css":  { "path": "/theme/apps/myapp/vendor.css", "cssMedia": "all" } },
        { "less": { "path": "/theme/apps/myapp/myapp.less", "lessMedia": "all" } },
        { "js":   { "path": "/theme/apps/myapp/vendor.min.js", "group": "main" } },
        { "js":   { "path": "/theme/apps/myapp/myapp.js", "group": "main" } }
    ]
}
```

Both top-level keys are optional. A theme that only pulls in other apps has just
`appDependencies`; a lib that only ships a script has just `dependencies`.

### appDependencies

Each entry is an **object**, not a string:

```json
{ "appId": "moment-lib", "branch": "2.30.1.4" }
```

| Field | Meaning |
|---|---|
| `appId` | the id of the app to depend on |
| `branch` | the version of that app to use |

Declaring a dependency means that app's own assets load too, so you do not repeat its files in
your `dependencies` array. Pin the `branch` to an exact version - leaving it to drift is how a
page breaks after someone else publishes.

### dependencies

Each array element is an object wrapping **exactly one** of `js`, `css` or `less`. Do not put two
keys in one element.

**js**

```json
{ "js": { "path": "/theme/apps/myapp/myapp.js", "group": "main", "position": 3 } }
```

| Field | Meaning |
|---|---|
| `path` | absolute served path to the file |
| `group` | the bundle this file joins; every file in a group is concatenated into one served file |
| `position` | ordering within the group (optional) |

Always give a `group`. `main` is the ordinary group and is where almost everything goes - a
separate group is a separate network request, so only add one when a file genuinely must be
served apart from the rest.

**Ordering.** `position` orders files *within* one group. Three rules decide the final order:

- files with a `position` come first, sorted by it;
- files with no `position` come after all positioned files, whatever order they were declared in
  relative to them;
- files that tie - same position, or both unpositioned - keep the order they were declared in,
  and dependency files from `appDependencies` are pushed before the declaring app's own.

The order the *groups* are emitted in is not guaranteed, so never rely on one group loading
before another. If file A must run before file B, put them in the same group and give them
positions.

**Deduplication is by path and position together.** The same path pushed twice with the same
position (or with none both times) is added once. The same path declared with two *different*
positions is two entries, and the file is concatenated into the bundle twice - which is how a
script that registers something ends up registering it twice.

**css**

```json
{ "css": { "path": "/theme/apps/myapp/myapp.css", "cssMedia": "all" } }
```

| Field | Meaning |
|---|---|
| `path` | absolute served path to the file |
| `cssMedia` | intended as the CSS media attribute. See the caveat below |

`cssMedia` is the key every existing app uses, and it is what you should write. Be aware that it
does not currently reach the rendered `<link>` element, so a stylesheet declared here is loaded
unconditionally regardless of the value you give. Do not rely on it to scope a stylesheet to
`print` or to a breakpoint - put the media query inside the stylesheet instead:

```css
@media print {
    /* print rules */
}
```

**less**

```json
{ "less": { "path": "/theme/apps/myapp/myapp.less", "lessMedia": "all", "position": 1 } }
```

| Field | Meaning |
|---|---|
| `path` | absolute served path to the `.less` file |
| `lessMedia` | media attribute, and the bundling key - shared with `css` of the same media |
| `position` | index at which to insert the file in that media group (optional) |

LESS is compiled server side. LESS and CSS declaring the same media value end up in the same
served stylesheet, with the compiled LESS first. `position` matters when a file defines variables
or mixins that a later file uses.

---

## A bad file is discarded whole, silently

The file is parsed strictly. Any problem - invalid JSON, a misspelled key, an extra key that is
not part of the format - throws out **the entire file**, not just the offending entry. Nothing
appears on the page, nothing appears in the browser console, and every asset the app declared is
simply absent. The only trace is a server-side log entry you cannot see.

The keys are exactly the ones documented above. `media` instead of `cssMedia`, `src` instead of
`path`, `version` instead of `branch`, a stray trailing comma, or a comment (JSON has none) each
cost the app all of its assets.

So when *none* of an app's scripts or stylesheets load, suspect the file itself before you
suspect a path. Validate the JSON, then check every key against this page, then reload. Confirm
the fix from the rendered page source: your file's path should appear inside one of the combined
`/theme/...` bundle URLs in the `<head>`.

---

## Paths

`path` is the **served** path, always starting `/theme/`, not the path inside the app. A file the
app stores at `website/theme/apps/myapp/myapp.js` is declared as `/theme/apps/myapp/myapp.js`.

---

## Common mistakes

- Writing `appDependencies` entries as bare strings (`"moment-lib"`). They must be objects with
  `appId` and `branch`.
- Using the in-app path rather than the served `/theme/...` path.
- Putting `js` and `css` keys in the same array element. One key per element.
- Relying on `cssMedia` to scope a stylesheet. It does not reach the rendered `<link>`. Use an
  `@media` block inside the stylesheet.
- Re-declaring files that already come from an app listed in `appDependencies`. It is redundant,
  and if your declaration gives a different `position` from theirs the file is served twice.
- Omitting `branch` from an `appDependencies` entry, so which version you get depends on what is
  installed rather than on what you asked for.
- A misspelled or extra key anywhere in the file, which discards the whole file - see above.
- Declaring a component's browser JavaScript nowhere - the component then renders but its
  settings panel never appears in the editor.
