---
name: kademi-themes
description: Use when working on a Kademi website, theme or Velocity template - page bodies and the container, column and component tree they follow, any .html file under a theme/ folder, the master, theme and page template chain, KEditor components authors drag onto a page, theme LESS parameters and custom stylesheets, navigation menus, content targeting, multi-language sites and translated page text, the dependencies.json declaring an app's browser assets, and front-end registration, login, one-time-password, survey and payment forms. Use when writing or debugging Velocity (#set, #if, #foreach, #macro, escaping), when a page shows "Couldnt parse template file", when a value renders as 4.0 or comes out empty, when a macro shows the previous row's data, when a component renders nothing or the editor flattens a page, when a section is missing for everyone or visible to everyone, when a page renders untranslated or in the wrong language, when a CSS or JavaScript file is not loading, or when restyling a Kademi site.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.2"
---

# Kademi: themes

Kademi renders websites and admin screens from **Velocity** templates. A theme is an app whose
files are mostly templates and LESS. A website has a repository of its own holding its pages and
the files that override its theme. Any app can also contribute **KEditor components** -
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

## Building a website page

A page is a complete HTML document whose `<head>` names its template and whose `<body>` is a stack
of containers. The structure is the file format, not a house style: the drag-and-drop editor reads
exactly this shape, and the server renders a component only when its placeholder is present.

```html
<html>
    <head>
        <title>Rewards Dashboard</title>
        <link rel="template" href="theme/page" />
    </head>
    <body>
        <div class="container-bg background-for">
            <div class="container-layout container">
                <div class="container-content-wrapper">
                    <div class="row">
                        <div class="col-sm-8 col-md-8 col-lg-8" data-type="container-content">

                            <section data-type="component-text">
                                <h1>Rewards Dashboard</h1>
                            </section>

                            <div data-type="component-htmlPanel" data-bg="bg-primary"
                                 data-html="&lt;h3&gt;1,250&lt;/h3&gt;&lt;p&gt;Points earned&lt;/p&gt;">
                                <div data-dynamic-href="_components/htmlPanel" id="panel-points"></div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
</html>
```

All four container divs matter, in that order. `data-type="container-content"` is what makes a
column a column. Columns are Bootstrap 3.4 and must total 12. One container per band of the page -
a hero, a row of stats and a row of detail panels are three containers - which is what lets an
author restyle or reorder each band on its own.

A component registered by an app is a wrapper carrying the settings plus an empty placeholder
naming the component. Components built into the editor, `component-text` chief among them, carry
their content inline and take no placeholder.

Read **[references/page-structure.md](references/page-structure.md)** before writing or editing any
page body, and whenever a component renders nothing, an author's save flattened a page, or you need
images, reporting components, kcodes or a stat row on a page: it has the full container and
component rules, layout judgement, the photo and htmlPanel components, the reporting components and
their data sources, and a worked page.

## Themes, templates and styling

A minimal theme is a handful of templates plus a LESS parameters file:

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

1. **The content page** names its body template: `<link rel="template" href="theme/page" />`.
2. **The body template** (`theme/page.html`) names its theme template the same way:
   `<link rel="template" href="theme/defaultThemeTemplate" />`. If it names none, the theme
   template `normal` is used.
3. **The theme template** `#parse`s `masterTemplate.html` and drops the layer below it in with
   `$themeTemplate.body`.

`masterTemplate.html` is where the `<head>` is assembled and where the combined CSS and JS that
Kademi built from every app's `dependencies.json` gets written out.

**Restyling is a LESS job, not a template job.** Two files in the website's own repository:

- `/theme/theme-params.less` holds LESS **variable** overrides - `@brand-primary: #2b4be6;` - and
  is already in every site's build, so a declaration there takes effect on reload. This is the
  first thing to reach for: a parameter restyles the site consistently.
- `/theme/custom-styles.less` holds **rules** the parameters cannot express. It is compiled with
  the theme, so a rule there can use `@brand-primary` and the theme's mixins, and it comes last so
  it wins. Unlike theme-params it is **not** in the build until it is declared in the website's own
  `/theme/dependencies.json`.

Read **[references/theming.md](references/theming.md)** when you are changing how a site looks,
picking between a parameter and a rule, adding a page template, or putting a page in the navigation
menu: it covers both stylesheets and their failure modes, where parameter names come from,
`/theme/menu.json`, page templates and website versions.

## Content targeting

A container can be restricted to particular groups or organisation types, to logged out visitors, or
by a rule built on a kcode. It is set on the outermost `container-bg` element and enforced by the
server, which removes the container - and everything nested inside it - when the rule does not
match.

Read **[references/targeting.md](references/targeting.md)** before writing any of it. The attribute
names are only half of it: the rules combine in a way the editor's own panel does not suggest, and
they fail silently in two opposite directions.

## Multi-language sites

An organisation makes a set of languages available, each a code and a title, and every request
resolves to one active language. Mark an element `trans-lookup` and its text is replaced with the
stored translation for that language as the page renders:

```html
<span class="trans-lookup" data-transcode="page-size">Page size</span>
```

The active language is resolved in this order, first non-blank wins: a `selectedLangCode` **query
parameter**, a `selectedLangCode` **cookie** (what the language switcher sets), the logged in
**profile's** preference, the **website's default language**, then the browser's
**`Accept-Language`** header matched against the configured languages. If all five are blank,
nothing on the site translates at all.

A whole page can be translated as a file instead: `about-fr.html` beside `about.html` is rendered
in its place whenever `fr` is active, using the original page's template.

Read **[references/translations.md](references/translations.md)** when a site serves more than one
language, when text is not translating or is translating in the wrong language, or when you are
marking up a template so its wording can be translated: it covers the resolution order in full,
the `trans-lookup` attributes, the language switcher, per-language page files, translating record
fields with `translationService`, strings built in browser JavaScript, and the AI translate pass.

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

Almost everything here fails silently: a wrong page with no error, no log line and no stack trace.
These are the ones that cost the most time.

### Pages and components

- **The content editor repairs anything that does not match the container structure, and it cannot
  be undone.** When a page is opened for editing, every top-level element of the body without a
  `[data-type="container-content"]` descendant is swept into one synthetic container, as a single
  rich-text block, appended at the **end** of the page. Every component in the non-conforming part
  becomes inert markup, and it moves to the bottom.
- **A component with no `data-dynamic-href` placeholder never renders.** The wrapper's `data-type`
  is what the editor selects; the inner `<div data-dynamic-href="_components/<compId>">` is what
  makes the server run the component's template. Miss it and the page just shows nothing there.
- **Settings go on the wrapper, never on the inner placeholder**, and an attribute name the
  component does not know is ignored in silence. Take names from the component's
  `<compId>Settings.json` or its settings JavaScript.
- **An `htmlPanel` with no `data-html` renders the words "This is sample content"** on the live
  page. `data-html` is decoded with `decodeURIComponent`, so escaped HTML passes through unchanged
  but a stray `%` in the copy breaks the decode - URI-encode the whole value in that case.
- **An unresolved kcode removes the whole span it was in**, taking the label and layout around it
  with it, so the page looks like it lost a section. The span also needs `class="kcode"`, not just
  `data-kcode`, or it is never substituted at all.

### Translations

- **When no language resolves, nothing translates anywhere on the site.** No query parameter, no
  cookie, no profile preference, no website default language and no matching `Accept-Language`
  header leaves the active code null, and every page renders its source text with no error.
- **`trans-lookup` on an element with child elements destroys them.** The lookup replaces the
  element's whole text content, so it belongs on the leaf element holding the words.
- **Marked-up text is only translated on a page that has at least one component.** The lookup runs
  in the same render pass that expands components, and that pass exits early when no element on
  the page carries `data-dynamic-href`.

### Styling

- **A bad theme parameter breaks the site's entire appearance, not one rule.** The parameters are
  compiled into one document with the whole of Bootstrap, so an unknown `@variable` or invalid
  value fails all of it, and the failure is served as an error message with a CSS content type and
  a 200 status. The site appears unstyled with nothing to say why. The same applies to
  `custom-styles.less`.
- **`/theme/custom-styles.less` does nothing until it is declared** in the website's own
  `/theme/dependencies.json`. There is no error; the rules simply never apply.
- **A `dependencies.json` with any bad key is discarded whole**, so every asset that app declared
  vanishes at once. When *none* of an app's scripts or stylesheets load, suspect the file before
  the paths.

### Targeting

- **A wrong group or org type name fails closed** - the container is removed and everyone sees a
  page with a section missing. Group **names** are not the titles shown in the UI.
- **A malformed advanced-visibility rule fails open** - a typo in `data-vis-comparator`, or a
  missing `data-vis-value`, and the rule is skipped entirely and the container is shown to
  everyone. Content meant to be restricted becomes public and the page looks normal.

### Velocity

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

**Read a theme parameter** with `$rootFolder.themeParams.get("navbar-height")`, which is the
resolved value in force rather than whatever the site's override file happens to say.

**Assign services once, at the top.** A repeated `$services.someManager.find(...)` inside a
`#foreach` is a lookup per row.

### KCode

Content authors have a **KCode** picker in KEditor, in dashboard content and in journey emails.
KCode is dot-notation field navigation - the author clicks through *Current user -> Primary
memberships -> First membership -> Membership organisation -> Full name* and Kademi renders the
value in the saved content. It is an authoring feature, not a developer scripting language, and
there is nothing to register for it. The one way an app extends it is by contributing fields a KCode
can walk, which `kademi-journeys` covers under journey fields.

It matters to you for three reasons. Authored content your templates render may contain KCode, so
do not strip or re-encode saved page HTML. The context KCode resolves against comes from where the
content is rendered: website content resolves against the current user, journey email content
against the lead, so a path that works on a logged-in dashboard can be empty in an email. And on a
page it is written as a span, while everywhere else - emails, SMS, certificates, journey action
settings - it is written inline between `*|` and `|*` with no spaces inside the delimiters.

See <https://docs.kademi.co/blogs/docs-kb/using-kcode/>, and the KCode section of
[references/page-structure.md](references/page-structure.md) for the page form and its failure mode.

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
| `priceTableSettings.json` | schema of the settings, for anyone placing it by hand (optional) |
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
JavaScript, the settings schema file, and how the component re-renders inside the editor.

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
`dependencies` entry is an object wrapping exactly one of `js`, `css` or `less`. A website has one
of these of its own, one level up, at `/theme/dependencies.json`.

**[references/dependencies-json.md](references/dependencies-json.md) is the full specification** -
read it whenever you add, move or debug a browser asset: a script or stylesheet that never loads,
files loading in the wrong order, an asset appearing on the website but not in admin, or LESS
that does not compile. Every field, the grouping and ordering rules and the failure modes are
there; this snippet is only the shape.

## Front-end forms

Registration, login, one-time-password, payment and survey forms all post to built-in
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
  layout, tables, paginators, Kademi's admin UX conventions, and the browser-side globals.
- **kademi-api-reference** - when you need to confirm a class or method, and its exact signature,
  before calling it from a template.
- **kademi-journeys** - when the Velocity file you are editing is a journey node's configuration
  UI, or renders journey or lead data.
- **kademi-app-development** - when the question is about the project layout around these files,
  app ids and branches, syncing your changes to an account, or publishing them.
