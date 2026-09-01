# Portlets

A portlet is how one app puts content onto a page owned by a **different** app. The host
page's template declares a named section; any installed app can register a fragment to
render into it. Neither app knows about the other, and neither needs changing when the other
is installed or removed.

Public write-up:
[Creating your own portlets with custom apps](https://docs.kademi.co/blogs/docs-kb/creating-your-own-portlets-with-custom-apps/).

## Registering a portlet

In your app's server-side JS, alongside your other controller mappings:

```js
controllerMappings
    .adminPortletController()
    .portletSection('adminDashboardQuickLinks')
    .templatePath('/theme/apps/myapp/recentPollsPortlet.html')
    .method('recentPollsPortlet')
    .enabled(true)
    .build();
```

| Builder method | Meaning |
|---|---|
| `portletSection(name)` | The section to render into. Matched as a **regular expression**, so one mapping can target several related sections. |
| `templatePath(path)` | Repository path of the fragment to render. |
| `method(nameOrFn)` | Optional. JS function called to prepare data before the template renders. Accepts a function name or a function reference. |
| `enabled(bool)` | Required. Defaults to **false** - a mapping without `.enabled(true)` never renders. |
| `addSectionResolver(key, value)` | Optional extra values made available to the template, keyed by name. |
| `build()` | Creates and registers the mapping. |

Use `adminPortletController()` for admin console pages and `websitePortletController()` for
participant-facing website pages. They are separate registries: a mapping registered as an
admin portlet is never considered when rendering a website page, and vice versa.

Reference: [PortletMappingBuilder](https://docs.kademi.co/ref/templating/md/PortletMappingBuilder.md),
[PortletMapping](https://docs.kademi.co/ref/templating/md/PortletMapping.md).

## The handler

```js
function recentPollsPortlet(page, params, ctx) {
    var polls = services.myPollService.recent(10);
    ctx.put('myappRecentPolls', polls);
}
```

| Argument | What it is |
|---|---|
| `page` | The **host** page resource - the page your portlet is being rendered into, not a page of yours. |
| `params` | The request's query parameters, as a map of string to string. |
| `ctx` | The Velocity context the host page is rendering against. `ctx.put(name, value)` makes `$name` available in your portlet template. |

Two extra behaviours worth knowing:

- **Returning a string from the handler overrides the template path.** Use it to pick one of
  several fragments at render time, or return nothing to use the registered `templatePath`.
- **Handler exceptions are logged and swallowed.** A broken portlet renders as nothing rather
  than breaking the host page - which also means a silent blank is the symptom of a bug, not
  of the section being missing.

The handler is optional. A portlet whose template needs nothing but what the host page
already put in context can omit `.method(...)` entirely:

```js
controllerMappings
    .adminPortletController()
    .portletSection('websiteSecuritySettingsBlockLeft')
    .templatePath('/theme/apps/myapp/corsConfigurationsPortlet.html')
    .enabled(true)
    .build();
```

An async handler works too, and is awaited before the template renders:

```js
globalThis.handleHostedZonePortlet = async (page, params, ctx) => {
    const domainName = page.customDomain;
    if (!domainName) {
        ctx.put('myappShowPortlet', false);
        return;
    }
    const zone = await services.myDnsService.lookup(domainName);
    ctx.put('myappShowPortlet', true);
    ctx.put('myappZone', zone);
};
```

## The template

A portlet template is a **bare HTML fragment** - no `<html>`, `<head>` or `<body>`. It
renders against the host page's Velocity context, so `$page` is the host page and every
variable the host set is visible to you, alongside whatever your handler put in `ctx`.

```velocity
#parse("/theme/apps/admin/common-macros.html")

#if( $formatter.isNotEmpty($myappRecentPolls) )
<div class="col-xl-3 col-lg-4 col-md-6">
    #renderDataPanel({"title": "Recent polls", "value": $myappRecentPolls.size(), "link": "/myapp/polls/"})
</div>
#end
```

Because the context is shared, **prefix your variable names**. `$polls` will collide with the
host page or another app's portlet in the same section; `$myappRecentPolls` will not.

An alternative to `ctx.put` is `page.attributes.foo = value` in the handler, read as
`$page.attributes.foo` in the template. It works and appears in existing apps, but it writes
onto the host page rather than into the render context, so prefer `ctx.put`.

Portlet templates follow the same asset rule as everything else: **no `<script src="">` in
the fragment.** Register the JS in your app's `dependencies.json` and have it detect the
portlet's markup before doing anything.

## Consuming a section

Any template can declare a section, which is how you let other apps extend *your* pages:

```velocity
#portlets("myAppExtraSettings")
```

The directive takes exactly one argument, the section name. It renders every enabled portlet
whose section pattern matches, in registration order, passing the current Velocity context
through to each. Nothing is emitted if no app registered for the section, so a section costs
you nothing until someone uses it.

Name your sections after the place, not the content: `manageWidgetsTools`,
`widgetDetailSidebar`, `afterWidgetForm`. Once other apps target a section, its name is
effectively a public API - renaming it breaks them silently.

## Existing admin sections

Sections declared by Kademi's own admin pages, which your app can render into:

| Section | Where it appears |
|---|---|
| `adminDashboardQuickLinks` | Tile row on the admin dashboard |
| `adminDashboardAlerts` | Notice queue on the admin dashboard |
| `adminDashboardPrimaryAnnounce` | Prominent announcement slot on the dashboard |
| `adminDashboardMid`, `adminDashboardMiddle`, `adminDashboardSecondary` | Lower dashboard bands |
| `adminProfile` | User profile page in the admin console |
| `groupDetails` | Group detail page |
| `membersTab` | Members tab of an organisation |
| `manageUsersTools`, `manageUsersBottom` | Tools row and footer of the manage-users list page |
| `manageOrgsTools` | Tools row of the manage-organisations list page |
| `filemanagerTools` | Tools row of the file manager |
| `websiteSecuritySettingsBlockLeft`, `websiteSeoSettings`, `websiteDomainStatus`, `websiteSSLManager` | Website settings pages |
| `beforeManageProductDetails`, `insideManageProductDetails`, `afterManageProductDetails` | Product detail page |
| `OrderPageLinks`, `OrderPageCustomer` | Order detail page |
| `rewardEntriesTools` | Reward entries list |
| `syncJobExtraSettings` | Sync job settings |
| `endOfPage` | End of the document, for modals and page-wide JS hooks |

Section availability tracks the pages that declare them, so confirm the section exists on the
page you are targeting before relying on it. The reliable way is to render something visible
and load the page.

## Profile and organisation tabs

A related mechanism adds a whole tab, and optionally a summary panel, to the built-in user or
organisation detail page:

```js
controllerMappings
    .adminProfileTab()
    .tab('AI chats', 'myapp-conversations', 'myappProfileTab')
    .tabTemplate('myapp/adminProfileTab.html')
    .panel('AI chats', 'myapp-conversations-panel', 'myappProfileTab')
    .panelTemplate('myapp/adminProfilePanel.html')
    .build();

function myappProfileTab(page, params, ctx) {
    ctx.put('myappChats', services.myAppService.chatsFor(page.profile));
}
```

`tab(title, portletId, func)` sets the tab's label, its id and the function that prepares its
data; `tabTemplate(path)` is the fragment. `panel(...)` and `panelTemplate(...)` add an
optional summary panel on the same page and are omitted if you only want a tab. Use
`adminOrgTab()` for the organisation page instead of `adminProfileTab()`.

The handler signature is the same as a portlet's - `(page, params, ctx)` - and here `page`
is the profile or organisation page, so `page.profile` gives you the record being viewed.

Reference: [ProfileTabsBuilder](https://docs.kademi.co/ref/templating/md/ProfileTabsBuilder.md).

## Timelines

A profile and an organisation each have a **timeline** - a merged activity stream on their detail
page. Your app contributes its own items to it:

```js
controllerMappings.setUserTimelineFunction('addMyAppUserTimelineItems');
controllerMappings.setOrgTimelineFunction('addMyAppOrgTimelineItems');

globalThis.addMyAppUserTimelineItems = (page, user, items) => {
    // add stream items to `items` for this profile
};
```

The function receives the page, the user (or organisation) and the list to add items to. Same shape
for both.

This is the right home for "what has this dealer done with our app" - it puts your app's events
where an administrator is already looking, rather than behind another tab. Keep it cheap: the
function runs on every view of the detail page, so query once and bound the number of items you add.

Contrast with a **profile or organisation tab** (above), which is a whole screen of your own; a
timeline item is one entry in a stream someone else owns.

## Checklist

- `.enabled(true)` is set. Without it nothing renders and nothing is logged.
- Template is a fragment, not a full document.
- Every context variable you set is prefixed with your app id.
- The template degrades to nothing when your data is absent - the host page belongs to
  someone else, and an empty panel on it is worse than no panel.
- Portlet JS and CSS are declared in `dependencies.json`, not inlined.
- Anything expensive in the handler is guarded, because it runs on every render of the host
  page.
