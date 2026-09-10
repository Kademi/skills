# Theming a Kademi site

Restyling a Kademi site is almost always a LESS job, not a template job. This page covers the two
files a site's appearance is driven from, the template chain a theme supplies, and the navigation
and page templates that go with it.

---

## What a theme app contains

A theme is an app whose files are mostly templates and LESS. A minimal one:

```
website/theme/masterTemplate.html         page shell: <html>, <head>, <body>
website/theme/defaultThemeTemplate.html   the standard wrapper (menu + body region)
website/theme/blankThemeTemplate.html     wrapper with no menu
website/theme/page.html                   body template for an interior page
website/theme/home.html                   body template for the home page
website/theme/theme-params.less           LESS variable overrides
website/theme/less/theme-variables.less   the theme's own variables
website/theme/less/theme-styles.less      the theme's own rules
website/theme/img/logo.png
website/theme/apps/<themeId>/dependencies.json
```

A theme's `dependencies.json` is usually nothing but an `appDependencies` entry for the Bootstrap
base library, which is what brings in Bootstrap itself, jQuery, FontAwesome, the content editor and
the rest. Everything the theme adds on top is in its own LESS files.

---

## The template chain

Rendering runs through three layers, innermost first:

1. **The content page** names its body template in its `<head>`:
   `<link rel="template" href="theme/page" />`.
2. **The body template** (`theme/page.html`) names its theme template the same way:
   `<link rel="template" href="theme/defaultThemeTemplate" />`. If it names none, the theme template
   `normal` is used.
3. **The theme template** `#parse`s `masterTemplate.html` on its first line and drops the layer
   below it in with `$themeTemplate.body`.

`masterTemplate.html` is where the `<head>` is assembled and where the combined CSS and JS that
Kademi built from every app's `dependencies.json` gets written out.

The theme templates themselves are built out of the same container and column structure a page is,
with components for the parts the theme supplies. A default theme template is typically two
containers: one holding `component-menu`, one holding `component-templateBody`. An interior page
template is one container holding `component-pageBody`. That is why the menu is configurable from
the editor at all, and why the logo in the menu is an attribute on the menu component
(`data-logo="/theme/img/logo.png"`) rather than markup. See
<https://docs.kademi.co/blogs/docs-kb/how-to-change-the-logo-displayed-in-the-menu/>.

---

## The website's own /theme/ folder overrides the theme app

A website has a `/theme/` folder in its own repository. A file there overrides the theme app's file
at the same path, which is how a site is customised without forking its theme. This is where a
site's own `theme-params.less`, `custom-styles.less`, `menu.json` and any overridden template live.

---

## theme-params.less: the LESS parameters

A site's look is driven by LESS variables. They resolve in four layers - Bootstrap's defaults,
Kademi's additions, the installed theme's variables - and the site overrides any of them in
`/theme/theme-params.less` in its own repository. Only that last layer is in the checkout; read
[theme-discovery.md](theme-discovery.md) to get the other three off the running site before you
change anything. The Bootstrap base library declares that file immediately after Bootstrap's own,
so it is concatenated last and its declarations win. Nothing needs wiring up: the file is already
in the build on every site, and an untouched one is empty except for a comment.

```less
@brand-primary: #2b4be6;
@font-size-base: 15px;
@navbar-height: 64px;
```

Kademi compiles LESS server side and rebuilds the stylesheet automatically, so a change shows on
reload.

**A bad value here takes down the whole site's appearance, not one rule.** The file is compiled into
a single document with the whole of Bootstrap, so one bad token fails all of it, and the failure is
served as an error message with a CSS content type and a 200 status, cacheable. The site simply
appears unstyled with nothing on the page to say why. Two consequences:

- **Take parameter names from the theme, never from assumption.** A name that does not exist is not
  ignored; a value referring to an `@variable` the theme does not have fails the compile. The names
  in force are Bootstrap 3.4's variables plus whatever the theme declares in its own
  `less/theme-variables.less`, so read that file for the theme the site is on -
  [theme-discovery.md](theme-discovery.md) is how you get hold of it. From a template,
  `$rootFolder.themeParams` is the resolved map of parameter names to the value currently in force,
  which is the way to check one without compiling:
  `#set( $navHeight = $rootFolder.themeParams.get("navbar-height") )`.
- **The file is the record.** Anything that changes a parameter on the site's behalf, whether an
  administrator or a tool acting for one, writes a line into this same `/theme/theme-params.less`.
  So a change made outside your working tree shows up there when you sync, and the file is always
  the complete list of what this site overrides.
- **Keep values simple.** A hex colour, a number with a unit, a percentage, a bare keyword, a font
  stack, another `@variable`, or a simple colour function over one of those, such as
  `darken(@brand-primary, 10%)`. One declaration per line, ending in a semicolon.

Removing a line resets that parameter to the theme's default. There is no "unset" value.

Anything you can express as a parameter, express as a parameter: it restyles the site consistently,
whereas a rule is a local exception someone has to maintain.

See <https://docs.kademi.co/blogs/docs-kb/style-your-site-with-less/>.

---

## custom-styles.less: the site's own rules

For styling the theme has no parameter for - a rule for one component, a layout tweak, a bit of
branding - a site has a stylesheet of its own at `/theme/custom-styles.less` in the website
repository. It is compiled with the theme, so a rule there can use `@brand-primary` and the theme's
mixins, and it comes last so it wins.

**Creating the file is not enough. It has to be declared**, in the website's own
`/theme/dependencies.json`:

```json
{
    "dependencies": [
        { "less": { "lessMedia": "all", "path": "/theme/custom-styles.less" } }
    ]
}
```

Note the path: this is the **website-level** dependencies file at `/theme/dependencies.json`, not
the per-app one at `/theme/apps/<appId>/dependencies.json`. Leave `position` out of the entry so
the site's own overrides land last, which is where they belong. Everything else about the file's
format, and the way a single bad key discards it whole, is in
[dependencies-json.md](../../kademi-themes/references/dependencies-json.md).

An undeclared `custom-styles.less` is not an error. The rules simply do not apply, and the only
symptom is styling that does nothing.

The same compile warning applies: unbalanced braces or invalid LESS in this file fail the whole
site's stylesheet, not just this file's rules.

See <https://docs.kademi.co/blogs/docs-kb/custom-css/>.

### Never put style rules in theme-params.less

`theme-params.less` is not a stylesheet. It is a list of variable assignments that Kademi reads and
rewrites with a line-based parser, and that parser only understands lines of the form
`@name: value;`.

Two things follow, and the second one destroys work:

- **A line starting with `@` that is not a variable is misread as one.** `@media (max-width: 768px) {`
  starts with `@` and contains a colon, so it is recorded as a parameter named `media (max-width`.
  The same applies to `@import`, `@supports` and `@keyframes`.
- **Anything that is not a variable assignment is deleted the next time theme parameters are saved
  through Kademi.** Editing the file yourself is safe: writing it through KSync, or in an editor,
  changes nothing else. But every parameter save - the admin console's theme editor, the KToolbar
  panel on the website itself, site creation from a recipe, a tool acting for an administrator -
  round-trips the file through the same parser: it reads the variables, then rewrites the file from
  them, and writes back only the lines it recognised. Every style rule, comment and blank line is dropped, with no warning and no error.
  You will not be the one who triggers it. Someone tweaks a brand colour in the admin months later
  and the rules vanish.

One more limit of that parser: it splits each line on the first colon, so a value that itself
contains a colon - `url(https://...)` - reads back truncated at that point, both in the editor and in
`$rootFolder.themeParams`. Keep such values in `custom-styles.less`.

You will see older sites with rules in `theme-params.less`, and they render, which is why the
practice spread. They are one theme-parameter edit away from being erased.

Variables in `theme-params.less`. Rules in `custom-styles.less`. Always.

### Per-organisation and per-request theming

A site can vary its theme parameters per organisation or per request rather than having one set for
the whole site. That is the `KDynamicTheming` app from the Marketplace, configured in the admin console
rather than in the website's files: <https://docs.kademi.co/blogs/docs-kb/dynamic-theming/>.

### The editor's own styles

The style and template menus authors see in the WYSIWYG editor come from `/theme/styles.js` and
`/theme/editor-templates.js`, which a website can override the same way it overrides any theme
file: <https://docs.kademi.co/blogs/docs-kb/customising-editor-styles-and-templates/>.

---

## Page templates

A page picks its template with `<link rel="template" href="...">` in its `<head>`. The value is a
path with no extension: `theme/page` means `/theme/page.html`, and a bare `user/dashboard` means
`/theme/apps/user/dashboard.html`.

Two sources of templates:

- **The site's own** `/theme/*.html` files. Any `.html` file directly in the website's `theme/`
  folder is offered as a template for its pages.
- **Templates apps register.** An app offers a template to content authors with:

  ```javascript
  controllerMappings.addTemplate("theme/apps/myapp/", "landing", "Campaign landing page", true);
  ```

  The last argument, `contentTemplate`, is true when authors may create new pages from it; false
  means it is a template for other templates rather than for content. The fuller
  `templateDefBuilder()` form, including which editor a page on the template opens in, is in
  [components.md](../../kademi-themes/references/components.md).

The template picker an author sees when creating a page is exactly the union of those two lists. If
a template is offered in the editor and you cannot find it, it is either a file in `/theme/` or an
`addTemplate` call in an installed app; there is no third place, and nothing is configured in the
admin console.

A page created with no template gets the site's default, which is usually `theme/page`.

---

## Navigation

A page is reachable only by its URL until it is in the navigation. Adding it there is part of
building the page, not somebody else's job, unless the page is deliberately unlisted.

A site's menu is three layers merged: what the active apps contribute, the theme's own menu, and the
site's customisation in `/theme/menu.json` in the website repository. Only the last is editable. It
works by id: an entry either overrides an app's item or adds one of its own.

```json
{
    "version": 2,
    "items": [
        {
            "id": "menu-custom-my-referrals",
            "parentId": "menuRoot",
            "text": "My Referrals",
            "href": "/my-referrals.html",
            "ordering": 10,
            "custom": true,
            "hidden": "false",
            "cssClass": "fa fa-share-alt"
        }
    ]
}
```

Worth knowing:

- The list is **flat**. Nesting is expressed with `parentId`, and the root of the tree is itself an
  item with the id `menuRoot`. An entry with a blank `parentId` belongs to nothing and is silently
  never shown, so a top level entry must say `menuRoot` explicitly.
- `hidden` is a **string**, `"true"` or `"false"`, not a boolean.
- `ordering` sorts among siblings, lower first. App-contributed items sit at 100.
- An id starting `menu-custom-` marks an entry this site invented rather than one overriding an
  app's. Only those can be deleted outright. To take an app's item out of the menu, add an entry
  with that app item's id and `"hidden": "true"` rather than trying to remove it.
- Entries may also carry `visible`, `orgTypeVisible` and `orgTypeHidden` to restrict who sees them.
- `version` is 2. Version 1 files exist and overload `hidden` to mean several things; write 2.

The menu editor in the content editor writes exactly this file, so the reliable way to learn the ids
an account actually has is to open the menu editor on the site and read the file back.

---

## Versions, and when a change is visible

A website has versions. A change to a version applies to that version straight away, and visitors
see it only once that version is published. A published version is readonly, so style and content
changes go on a draft version which is then published. See
<https://docs.kademi.co/blogs/docs-kb/safely-changing-website-content-using-website-versions/>.

Before a site goes live: <https://docs.kademi.co/blogs/docs-kb/go-live-checklist/>.
