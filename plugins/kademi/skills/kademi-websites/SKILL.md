---
name: kademi-websites
description: Build, restyle or fix a Kademi website from its checkout - its pages, menu, who sees which content, the colours, fonts and spacing that give it its look, and its languages. Use when asked to give a site a new look or vibe, add or lay out a page, put a page in the navigation, show content only to some visitors or translate a site, and when a page renders nothing, the editor flattens a page into one text block, a section is missing or visible to everyone, the site appears unstyled, or a page renders in the wrong language. Read it before editing theme-params.less, custom-styles.less, menu.json or any page in a website repository.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: websites

A Kademi website is a repository of its own. It holds the site's pages, its navigation, and the
files that override the theme it was given - and almost nothing else about how the site looks, which
lives in the theme and in Kademi's base libraries. Content authors edit the pages in a drag-and-drop
editor that reads a fixed page structure; you work on the same files through a checkout.

This skill is for the site: pages, layout, images, who sees what, the look, the menu and the
languages. The templates a theme is made of, the KEditor components an app contributes, the
`dependencies.json` that declares browser assets and the Velocity language itself are the
`kademi-themes` skill.

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

### Look before you restyle

A website checkout contains almost none of what the site looks like. Theme parameters are merged
from four LESS files, in this order, later winning - and only the last is in the checkout:

| # | Path | What it is |
|---|---|---|
| 1 | `/theme/less/variables.less` | Bootstrap's own defaults |
| 2 | `/theme/less/extra-variables.less` | Kademi's additions |
| 3 | `/theme/less/theme-variables.less` | the installed theme's variables |
| 4 | `/theme/theme-params.less` | this site's own overrides, and they win |

The first three come from other repositories and exist on the site only as an overlay assembled at
request time, but all four are served, unauthenticated, from the website's own domain - and that
domain can be worked out from the checkout URL in `.ksync/ksync.properties`, so you never have to ask for it.
Read all four before deciding what to change: the parameter names a theme actually defines are in
layer 3, and writing a name that does not exist fails the whole site's stylesheet.

**Read the `url` in `.ksync/ksync.properties`, and nothing else
under `.ksync`.** That one value says which account and repository this checkout is connected to;
in older checkouts the same file can hold a user token, so quote the URL and never the file. The rest of the directory
is KSync's bookkeeping, and writing anything there corrupts the checkout's record of what is synced.

**[references/theme-discovery.md](references/theme-discovery.md)** is the procedure - deriving the
host, the four requests and what their responses mean, and the offline fallback through
`WEB-INF/settings.xml`. Follow it before writing a parameter.

**Restyling is a LESS job, not a template job.** Two files in the website's own repository:

- `/theme/theme-params.less` holds LESS **variable** overrides - `@brand-primary: #2b4be6;` - and
  is already in every site's build, so a declaration there takes effect on reload. This is the
  first thing to reach for: a parameter restyles the site consistently. Variable assignments only -
  putting a style rule in this file gets it deleted, see Gotchas.
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

## KCode

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

## Gotchas

Almost everything here fails silently: a wrong page with no error, no log line and no stack trace.
These are the ones that cost the most time.

### Theming

- **A style rule in `theme-params.less` is deleted the next time theme parameters are saved through
  Kademi.** Editing the file directly is safe and is how you set variables. But that file is a list of
  `@name: value;` assignments read by a line-based parser, and every parameter save - the admin
  console's theme editor, the KToolbar panel on the website itself, a tool acting for an
  administrator - rewrites the file from what it parsed, dropping every style rule, comment and blank
  line with no warning. A line starting with `@` that is not a variable is misread too: `@media (max-width: 768px) {`
  becomes a parameter named `media (max-width`. Set variables here; put rules in `custom-styles.less`.

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
- **The four variable files are this site's styling only on the website's own host.** The admin
  domain resolves the same paths against a different tree, so what comes back there is some other
  site's - or nothing - with no error to say so.
- **An empty `/theme/theme-params.less` is not a failed request.** A 204 with no body means the site
  has no overrides yet, so layers 1 to 3 are the whole answer.
- **A value in those files may be another variable or an expression**, such as
  `@wellBackground: @well-bg`, so what a layer says is not necessarily a colour. Resolve it through
  the chain.
- **A `dependencies.json` with any bad key is discarded whole**, so every asset that app declared
  vanishes at once. When *none* of an app's scripts or stylesheets load, suspect the file before
  the paths.

### Targeting

- **A wrong group or org type name fails closed** - the container is removed and everyone sees a
  page with a section missing. Group **names** are not the titles shown in the UI.
- **A malformed advanced-visibility rule fails open** - a typo in `data-vis-comparator`, or a
  missing `data-vis-value`, and the rule is skipped entirely and the container is shown to
  everyone. Content meant to be restricted becomes public and the page looks normal.

## Related skills

- **kademi-themes** - when the work moves into the theme or an app: Velocity syntax and its traps,
  building a KEditor component, the `dependencies.json` that declares browser assets, and the
  front-end registration, login and payment forms.
- **kademi-server-js** - when a page needs data or behaviour no installed app provides: the
  controller behind a page, or what a website can register through its own `WEB-INF/controllers.xml`.
- **kademi-app-development** - the checkout itself: KSync, versions, what a website is relative to an
  app, lib or theme, and syncing your changes to the account.
- **kademi-journeys** - when the KCode a page uses should reach a field that does not exist yet.
- **kademi-api-reference** - to confirm a `$services` or `$formatter` call before a page relies on it.
