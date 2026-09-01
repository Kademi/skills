---
name: kademi-themes
description: Use when working on a Kademi website, theme or Velocity template - any .html file under a theme/ folder, the master, theme and page template chain, KEditor components that authors drag onto a page, LESS and CSS restyling, the dependencies.json that declares an app's browser assets on any surface, and front-end registration, login, one-time-password, survey and payment forms. Use when writing or debugging Velocity (#set, #if, #foreach, #macro, escaping), when a page shows "Couldnt parse template file", when a value renders as 4.0 or comes out empty, when a macro shows the previous row's data, when a CSS or JavaScript file is not loading, or when restyling a Kademi site.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: themes

Kademi renders websites and admin screens from **Velocity** templates. A theme is an app whose
files are mostly templates and LESS. Any app can also contribute **KEditor components** -
drag-and-drop blocks that content authors place on a page.

## Which .html files are Velocity

Every `.html` file under a `theme/` folder in an app is a Velocity template. There are three
roots in an app, and each maps to where the template is used:

| Folder in the app | Used by |
|---|---|
| `website/theme/` | public website pages |
| `admin/theme/` | admin screens |
| `common/theme/` | both |

Everything under `<root>/theme/` is served from the URL path `/theme/`. So an app called
`myapp` with a file at `website/theme/apps/myapp/banner.js` serves it at
`/theme/apps/myapp/banner.js`. Put an app's templates and assets in
`<root>/theme/apps/<appId>/` so they cannot collide with another app's.

A website also has its own `/theme/` folder in its repository. Files you put there override the
files the theme app supplies at the same path - that is how you customise a theme without
forking it. See <https://docs.kademi.co/blogs/docs-kb/authoring/> for the three ways to edit
those files (browser file manager, WebDAV, or local file sync).

**Format Velocity by hand.** Generic HTML formatters and pretty-printers treat a template as
plain HTML. Velocity directives are not HTML - a formatter does not know that `#foreach` ...
`#end` is a block, that `#macro` bodies must stay intact, or that whitespace inside `#if` lines
is significant to the output. Reflowing a template silently reorders directives relative to the
tags they wrap and produces markup that no longer nests. Indent and wrap these files manually,
and keep automatic formatters pointed away from `theme/**/*.html`.

## Velocity syntax as Kademi uses it

```velocity
#set( $dm = $services.dateManagerV1 )
#if( $formatter.isNotEmpty($items) )
    <ul>
    #foreach( $item in $items )
        <li>$formatter.htmlEncode($item.title) - $dm.formatDate($item.created)</li>
    #end
    </ul>
#else
    <p>Nothing here yet.</p>
#end
```

Read **[references/velocity.md](references/velocity.md)** before writing or editing a template,
and whenever a page renders wrong, renders blank, or fails with `Couldnt parse template file` -
it covers the document-wrapper requirement behind that error, escaping, null handling, macros,
raw blocks and the Kademi-specific directives.

## Gotchas

Velocity's failure mode is a wrong page with no error, no log line and no stack trace. These are
the ones that cost the most time:

- **A `#set` whose right-hand side evaluates to null is silently skipped** - the variable keeps
  its previous value. Any block that runs twice (`#foreach`, a repeated card, a macro called
  again) then shows the previous iteration's data. Reset first: `#set( $match = false )`, then
  `#set( $match = $map.get($key) )`.
- **Macros have no scope.** Every `#set` inside a macro writes into the caller's context and
  stays there, so a macro can clobber a page variable, and the same macro called twice starts its
  second call holding the first call's values. Prefix macro-internal variables and reset them at
  the top of the body.
- **A method call that matches no signature returns null silently** - no error, no log entry.
  When a service call returns null for no apparent reason, suspect the argument types before the
  data, and check the signature.
- **Numbers coming from server-side JavaScript arrive as doubles** and render `4.0` instead of
  `4`. Fix it at the source - return `formatter.toInteger(count)` from the server-side code -
  not at each call site.
- **`#anything` inside a double-quoted string is parsed as a directive.**
  `#set( $link = "/points/?x=$y#points-tab" )` is a trap. Single-quoted literals are not parsed:
  `#set( $hash = '#points-tab' )`, then interpolate `$hash`.
- **Nothing is escaped.** Velocity writes `$value` raw; `$!value` only suppresses nulls, it does
  not escape. Any value that came from a person goes through `$formatter.htmlEncode($value)`.
- **`#if($x)` is unreliable for Java objects** - an empty list is truthy. Use
  `$formatter.isEmpty` / `isNotEmpty` / `isNull` / `isNotNull`.
- **A method call on its own line prints its return value** into the page. Wrap calls made for
  their side effect: `$formatter.call($list.add("x"))`.
- **Arithmetic and logical operators do not work inside a method-call argument.**
  `$formatter.toInteger($a * 100)` is a lexical error. Hoist it into its own `#set` first.

The full list, with the fixes worked through, is in
**[references/velocity.md](references/velocity.md)**.

## Reading settings and data from a template

Templates read data that has already been prepared. Do not put business logic in a template -
that belongs in the app's server-side code.

**Variables always in scope on a rendered page:**

| Variable | What it is |
|---|---|
| `$page` | the resource being rendered |
| `$folder` | its parent folder |
| `$rootFolder` | the website or organisation root |
| `$user`, `$profile` | the logged in user, null when anonymous |
| `$formatter` | the helper object - see [Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md) |
| `$services` | named platform and app services - see [ApplicationServices](https://docs.kademi.co/ref/templating/md/ApplicationServices.md) |
| `$applications` | installed apps - see [Applications](https://docs.kademi.co/ref/templating/md/Applications.md) |
| `$request` | the current request |
| `$menu` | the site menu root - see [MenuItem](https://docs.kademi.co/ref/templating/md/MenuItem.md) |
| `$templateName`, `$themeName` | names of the template and theme in use |

**Call a service:**

```velocity
#set( $um = $services.userManager )
#set( $dm = $services.dateManagerV1 )
```

Use [DateManagerV1](https://docs.kademi.co/ref/templating/md/DateManagerV1.md) for date
formatting so dates follow the account's configured pattern.

**Call another app's function, or read its settings:**

```velocity
#set( $payments = $applications.get("KPayment") )
#set( $settings = $payments.call("getAppSettings", $rootFolder) )
<p>Default currency: $formatter.htmlEncode($settings.defaultCurrency)</p>
```

`call(fnName, args)` invokes a function the app exposes - see
[RepositoryApp](https://docs.kademi.co/ref/templating/md/RepositoryApp.md).

**Read request parameters** through a form context, never straight off the request:

```velocity
#set( $fc = $formatter.newFormContext() )
#set( $status = $fc.cleanedParam("status") )
```

See [FormContext](https://docs.kademi.co/ref/templating/md/FormContext.md).

**Assign services once, at the top.** A repeated `$services.someManager.find(...)` inside a
`#foreach` is a lookup per row.

### KCode

Content authors have a **KCode** picker in KEditor, in dashboard content and in journey emails.
KCode is dot-notation field navigation - the author clicks through *Current user -> Primary
memberships -> First membership -> Membership organisation -> Full name* and Kademi renders the
value in the saved content. It is an authoring feature, not a developer scripting language, and
there is nothing to register for it.

It matters to you for two reasons: authored content your templates render may contain KCode, so
do not strip or re-encode saved page HTML; and the context KCode resolves against comes from
where the content is rendered (website content resolves against the current user, journey email
content against the lead). See <https://docs.kademi.co/blogs/docs-kb/using-kcode/>.

## KEditor components

A component is a block an author drags onto a page. An app registers one line of JavaScript in
its server-side app file, and Kademi derives every file path from the app id and component id:

```javascript
controllerMappings.addComponent("myapp", "priceTable", "html", "Shows the current price table", "My app");
```

That expects these files under `common/theme/apps/myapp/`:

| File | Purpose |
|---|---|
| `priceTableComponent.html` | Velocity template that renders the component with live data |
| `priceTableSettings.html` | the settings panel form (optional) |
| `priceTableComponent.js` | browser code that wires the settings panel up (optional) |
| `priceTable.png` | thumbnail in the component picker |

Author-set options arrive in the render template as camel-cased variables: a
`data-show-title="true"` attribute on the component becomes `$showTitle`. So the template is:

```velocity
#set( $showTitle = $formatter.toBool($showTitle, true) )
#set( $listTitle = $formatter.ifNull($listTitle, "Prices") )

<div class="price-table">
    #if( $showTitle )
        <h3>$formatter.htmlEncode($listTitle)</h3>
    #end
    ...
</div>
```

Read **[references/components.md](references/components.md)** when you are building a KEditor
component, or when a registered one does not appear in the picker, renders without its
author-set options, or has a settings panel that never opens: it has all the `addComponent`
overloads, the builder for default attributes and multiple types, the settings form and its
JavaScript, and how the component re-renders inside the editor.

## Themes and websites

A **theme** is an app that supplies the page chrome. A minimal theme is a handful of templates
plus a LESS parameters file:

```
website/theme/masterTemplate.html        page shell - <html>, <head>, <body>
website/theme/defaultThemeTemplate.html  the standard wrapper (menu + body region)
website/theme/blankThemeTemplate.html    wrapper with no menu
website/theme/page.html                  body template for an interior page
website/theme/home.html                  body template for the home page
website/theme/theme-params.less          LESS variable overrides
website/theme/apps/<themeId>/dependencies.json
```

Rendering runs through three layers, innermost first:

1. **The content page** names its body template:
   `<link rel="template" href="theme/page" />` in its `<head>`.
2. **The body template** (`theme/page.html`) names its theme template the same way:
   `<link rel="template" href="theme/defaultThemeTemplate" />`. If it names none, the theme
   template `normal` is used.
3. **The theme template** `#parse`s `masterTemplate.html` and drops the layer below it in with
   `$themeTemplate.body`.

`masterTemplate.html` is where the `<head>` is assembled and where the combined CSS and JS that
Kademi built from every app's `dependencies.json` gets written out.

Restyling is normally a LESS job, not a template job. Setting Bootstrap variables in
`/theme/theme-params.less` in the website repository re-skins the whole site, and Kademi compiles
LESS server side - just reload the page. See
<https://docs.kademi.co/blogs/docs-kb/style-your-site-with-less/> and
<https://docs.kademi.co/blogs/docs-kb/custom-css/> for custom classes and responsive
breakpoints.

You can also customise the WYSIWYG editor authors see, by overriding `/theme/styles.js` and
`/theme/editor-templates.js` in the website:
<https://docs.kademi.co/blogs/docs-kb/customising-editor-styles-and-templates/>.

### Registering extra page templates

Apps and themes can offer their own page templates to content authors:

```javascript
controllerMappings.addTemplate("theme/apps/myapp/", "landing", "Campaign landing page", true);
```

The last argument, `contentTemplate`, is true when authors may create new pages from it.

## Declaring assets

An app's browser JavaScript, CSS and LESS are declared in a `dependencies.json` beside them, at
`<root>/theme/apps/<appId>/dependencies.json`. Kademi combines every active app's declarations
into the minimum number of files and writes the tags into the page.

```json
{
    "appDependencies": [
        { "appId": "moment-lib", "branch": "2.30.1.4" }
    ],
    "dependencies": [
        { "css":  { "path": "/theme/apps/myapp/myapp.css", "cssMedia": "all" } },
        { "less": { "path": "/theme/apps/myapp/myapp.less", "lessMedia": "all" } },
        { "js":   { "path": "/theme/apps/myapp/myapp.js", "group": "main" } }
    ]
}
```

`appDependencies` entries are **objects with `appId` and `branch`**, not plain strings. Each
`dependencies` entry is an object wrapping exactly one of `js`, `css` or `less`.

**[references/dependencies-json.md](references/dependencies-json.md) is the full specification** -
read it whenever you add, move or debug a browser asset: a script or stylesheet that never loads,
files loading in the wrong order, an asset appearing on the website but not in admin, or LESS
that does not compile. Every field, the grouping and ordering rules and the failure modes are
there; this snippet is only the shape.

## Front-end forms

Registration, login, one-time-password login, payment and survey forms all post to built-in
Kademi endpoints and are wired up with the `jquery.forms` plugin, which submits over AJAX and maps
the JSON response's field messages back onto the inputs.

Read **[references/forms.md](references/forms.md)** before you write any of those forms, and when
one posts but nothing happens, returns a validation message that lands on no field, or rejects an
input you thought was named correctly - it lists each endpoint, the exact input names it requires,
the JSON response shape and complete working examples.

## Related skills

- **kademi-server-js** - reach for it when the work moves behind the template: the controller
  that prepares the page's data, the endpoint a form posts to, or a service the template calls.
- **kademi-admin-ui** - when the screen is an admin console page rather than a website page:
  layout, tables, paginators and Kademi's admin UX conventions.
- **kademi-api-reference** - when you need to confirm a class or method, and its exact signature,
  before calling it from a template.
- **kademi-journeys** - when the Velocity file you are editing is a journey node's configuration
  UI, or renders journey or lead data.
- **kademi-app-development** - when the question is about the project layout around these files,
  app ids and branches, or publishing your changes.
