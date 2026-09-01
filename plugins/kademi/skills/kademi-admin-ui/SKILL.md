---
name: kademi-admin-ui
description: Use when building or fixing a screen a Kademi administrator sees, or the browser JavaScript behind one - admin console pages, portlets that add a panel to a page owned by another app, and profile and organisation tabs. Covers the standard admin page shell, metric cards, notices, list pages and panel-wrapped tables, the shared macros the admin theme provides, the admin client-side globals (pageInitFunctions, Msg, Kalert, the forms plugin, reloadFragment, polling a background job, CSRF) and Kademi's admin UX rules. Use when an admin page looks wrong, a table or dialog misbehaves, or a panel needs to appear on a page owned by someone else. For website pages, Velocity syntax, or declaring browser assets, use kademi-themes instead.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: admin UI

The Kademi admin console is server-rendered Velocity HTML wrapped in a shared admin theme,
using Bootstrap 3 markup with jQuery on the client. Your app contributes to it in three ways:

1. **Whole admin pages** of its own, routed by a controller mapping.
2. **Portlets** - a fragment injected into a named section of a page owned by a *different* app.
3. **Profile and organisation tabs** - an extra tab (and optional summary panel) on the built-in
   user and organisation detail pages.

## Where admin UI lives

Inside your app, browser-facing assets sit under three top-level folders:

| Folder | Served on |
|---|---|
| `admin/` | admin console pages only |
| `website/` | participant-facing website pages only |
| `common/` | both |

Under each of those the convention is `theme/apps/<appId>/`. A file at
`admin/theme/apps/myapp/managePolls.js` is served to the browser as
`/theme/apps/myapp/managePolls.js`, and that URL is how you refer to it everywhere - in
`dependencies.json`, in `templatePath(...)`, and in `#parse(...)`.

An admin request resolves `admin/` first and falls back to `common/`. A website request
resolves `website/` first and falls back to `common/`. Anything used by both belongs in
`common/`, not duplicated.

Server-side JS lives separately, under `APP-INF/`. Nothing in `APP-INF/` is ever served to
a browser.

## Assets are declared, not linked

Every JS, CSS and LESS file is registered in a `dependencies.json` sitting beside it in
`theme/apps/<appId>/`. **Never** write `<script src="...">` or `<link rel="stylesheet">`
into a template - that path skips CSRF wiring and bundling.

```json
{
    "appDependencies": [{ "appId": "jquery-timeago-lib", "branch": "1.5.3.12" }],
    "dependencies": [
        { "js":  { "path": "/theme/apps/myapp/managePolls.js", "group": "main" } },
        { "css": { "path": "/theme/apps/myapp/managePolls.css", "cssMedia": "all" } }
    ]
}
```

That much registers a script and a stylesheet. `appDependencies` pulls in another app or
library at a pinned branch/version, bringing its own dependencies with it. For the complete
format - `less`, `position`, bundling groups, load order - use the `kademi-themes` skill.

Files are emitted on **every** page of that side of the account, so client JS must detect
cheaply whether it is needed and return early.

## Admin pages

An admin page is a controller mapping plus a Velocity template. Register the mapping in your
app's server-side JS:

```js
controllerMappings
    .adminController()
    .enabled(true)
    .pathSegmentName('polls')
    .defaultView(views.templateView('/theme/apps/myapp/managePolls.html'))
    .addMethod('GET', 'managePolls')
    .addMethod('POST', 'savePoll', 'pollName')
    .postPriviledge('WRITE_CONTENT')
    .addRole('Poll Editor', 'READ_CONTENT', 'WRITE_CONTENT')
    .build();

function managePolls(page, params) {
    page.attributes.polls = loadPolls(page);
}
```

The template is a full document; the admin theme supplies all the chrome around `<body>`:

```velocity
<html>
<head>
    <title>Manage Polls</title>
    <meta name="description" content="Create and edit the polls shown on your website.">
</head>
<body>

#parse("/theme/apps/admin/common-macros.html")
#set( $dm = $services.dateManagerV1 )

<div class="panel panel-default">
    <div class="panel-heading">Polls</div>
    #if( $formatter.isEmpty($page.attributes.polls) )
        <div class="panel-body"><p>No polls yet.</p></div>
    #else
        <table class="table table-striped mg-bottom-0">
            ...
        </table>
    #end
</div>

</body>
</html>
```

`#parse("/theme/apps/admin/common-macros.html")` gives you the shared macro library -
`subtext`, `renderIntroPanel`, `renderDataPanel`, `renderActivityNotice`, `standardTable`,
`renderPaginator`, `timeAgo` and more. Use those macros instead of hand-rolling the markup:
they are what makes one app's page look like the rest of the console, and they carry fixes
centrally. Read [references/page-patterns.md](references/page-patterns.md) before laying out
any admin page - it is the macro catalogue plus copy-pasteable layouts for the page shell,
header, metric tiles, notices, list pages, panel-wrapped tables and empty states.

Reference: [ControllerMappingBuilder](https://docs.kademi.co/ref/templating/md/ControllerMappingBuilder.md),
[TemplateView](https://docs.kademi.co/ref/templating/md/TemplateView.md),
[Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md).

## Portlets

A portlet is how your app puts a panel on a page it does not own. The host page's template
declares a named section; any app can register a fragment for it. Neither app knows about
the other.

Register on the admin side with `adminPortletController()` (or `websitePortletController()`
for participant-facing pages):

```js
controllerMappings
    .adminPortletController()
    .portletSection('adminDashboardQuickLinks')
    .templatePath('/theme/apps/myapp/recentPollsPortlet.html')
    .method('recentPollsPortlet')
    .enabled(true)
    .build();

function recentPollsPortlet(page, params, ctx) {
    ctx.put('myappRecentPolls', loadRecentPolls(page));
}
```

Consume in a template you own, so other apps can extend your page too:

```velocity
#portlets("myAppExtraSettings")
```

The handler receives the **host** page, the request parameters, and a context map whose
entries become Velocity variables in your portlet template. The portlet template is a bare
fragment - no `<html>`, `<head>` or `<body>`. Handler exceptions are logged and swallowed,
so a broken portlet renders as nothing rather than breaking the host page.

Read [references/portlets.md](references/portlets.md) when you are adding a panel or tab to
a page another app owns, or your registered portlet renders nothing - it lists the section
names, the profile and organisation tab and summary-panel variants, and the gotchas.
Public write-up:
[Creating your own portlets with custom apps](https://docs.kademi.co/blogs/docs-kb/creating-your-own-portlets-with-custom-apps/).

Reference: [PortletMappingBuilder](https://docs.kademi.co/ref/templating/md/PortletMappingBuilder.md),
[PortletMapping](https://docs.kademi.co/ref/templating/md/PortletMapping.md),
[ProfileTabsBuilder](https://docs.kademi.co/ref/templating/md/ProfileTabsBuilder.md).

## Client-side JavaScript

The admin theme already loads jQuery 3.6, Bootstrap 3.4.1, FontAwesome 6 and a set of
Kademi globals. Your file is loaded on every admin page, so gate it:

```js
/* global pageInitFunctions, $, Msg, Kalert, showStandardError */
pageInitFunctions.push(function () {
    var container = $('#poll-list');
    if (!container.length) {
        return; // not this page
    }

    container.on('click', '.btn-delete-poll', function () {
        var pollName = $(this).data('pollName');
        Kalert.confirm('Delete poll "' + pollName + '"? This cannot be undone.', function () {
            $.ajax({ url: '/polls/', type: 'POST', data: { deletePoll: pollName } })
                .done(function (resp) {
                    if (resp.status) {
                        Msg.success('Poll deleted', 'polls');
                        container.reloadFragment();
                    } else {
                        Msg.danger(resp.messages.join(', '), 'polls');
                    }
                })
                .fail(function () { showStandardError('deleting the poll'); });
        });
    });
});
```

The essentials: register work through `pageInitFunctions`; delegate events from a stable
ancestor; use `Msg.*` for transient feedback and `Kalert.confirm` for destructive actions;
refresh with `reloadFragment()` instead of `window.location.reload()`; drive form submits
with the `forms()` plugin rather than hand-rolled AJAX. Read
[references/client-side.md](references/client-side.md) before writing any browser JS or CSS
for an admin page - for the exact signatures, the CSRF header, form validation and
serialization timing, polling a background job, and the `Kalert.confirm` argument trap.

## UX standards

Four rules are non-negotiable, because breaking them is visible to every administrator:

- **Plain language, never a schema dump.** Translate the domain into sentences and
  purpose-built editors. An administrator must never see an internal alias, a
  fully-qualified class name, a slug, or type jargon. Resolve a stored identifier to the
  thing it names before displaying it.
- **No page-specific stylesheets.** Use Bootstrap and the shared theme classes. If a layout
  need is genuinely new, it belongs in a shared class used by every page that has it - never
  a CSS file per page.
- **`text-muted` is for subtext only.** Never on an empty state, never on primary content.
  An empty state is a plain `<p>`, not grey text.
- **Confirm destructive actions**, and say what is affected: "Delete 137 users?", not
  "Are you sure?".

The rest - prominence, semantic colours, when a button gets an icon versus icon and text,
list-page versus detail-page layout - is in
[references/ux-standards.md](references/ux-standards.md). Read it before designing a screen
or deciding how something should look, not after the markup exists.

## Related skills

- **`kademi-server-js`** - the controller mapping, route, POST handler and privileges behind
  every admin page. Go there when a page 404s, a privilege check refuses, or a POST silently
  does nothing: that last one is almost always a registration problem, not a UI problem. It
  also owns the server half of background jobs.
- **`kademi-themes`** - Velocity syntax and its traps, the full `dependencies.json` format,
  and participant-facing website pages.
- **`kademi-api-reference`** - confirm a class or method exists, and its signature, before
  you call it from a template or handler.
- **`kademi-app-development`** - project layout, where assets live, versioning and publishing
  the app that contains your admin page.
