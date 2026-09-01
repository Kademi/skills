# controllers.xml

The registration and wiring file for a Kademi app, at `APP-INF/controllers.xml`. It declares the
engine, the script files to load, lifecycle callbacks, admin menu items, roles, and the app
settings page. It deserialises into
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md) - the
same object your JS sees as the `controllerMappings` global.

## Root element

```xml
<controllers engineVersion="2.0"
             onAppEnabled="_onAppEnabled"
             onAppUpdated="_onAppEnabled"
             onAppDisabled="_onAppDisabled">
```

| Attribute | Meaning |
|---|---|
| `engineVersion` | `2.0` GraalJS/`.mjs`; `1.1` Nashorn/`.js` with some ES2015; omitted, Nashorn/`.js` at ES5.1 |
| `onAppEnabled` | function run when the app is installed or turned on |
| `onAppUpdated` | function run when the app is upgraded; usually the same function |
| `onAppDisabled` | function run when the app is turned off; use it to clean up schedules |

Lifecycle callbacks are called with the organisation root folder and the website root folder. One
of the two is null, which is how you tell an account-level install from a per-website one:

```js
globalThis._onAppEnabled = (orgRoot, websiteRoot) => {
    if (websiteRoot !== null) {
        // installed on a website
    } else {
        // installed at account level
    }
};
```

Under GraalJS the named function must be on `globalThis`.

## Sources

```xml
<source>/APP-INF/config.js</source>
<source>/APP-INF/services.js</source>
<source>/APP-INF/app.js</source>
```

Files load in declaration order, so put dependencies first. Under GraalJS declare only the single
`.mjs` entrypoint; it imports the rest.

## Menu items

```xml
<menu parentId="menuECommerce" id="menuManageMyApp" path="/my-app/"
      text="My App" css="fas fa-star" ordering="100">
    <roles>
        <string>MyAppAdmin</string>
    </roles>
</menu>

<menu parentId="menuManageMyApp" id="menuManageMyAppItems"
      text="Items" path="/my-app/items/" ordering="10"/>
```

`parentId` must name an existing menu group, for example `menuRoot`, `menuECommerce`,
`menuGroupsUsers` or `menuWebsiteManager`. `ordering` sorts within the parent, lowest first.
`<roles>` restricts visibility; omit it and the item shows to anyone who can reach the section. A
child of an already-restricted parent does not need its own roles. See
[AppMenuItem](https://docs.kademi.co/ref/templating/md/AppMenuItem.md).

## Roles

```xml
<role class="role">
    <name>MyAppAdmin</name>
    <privNames>
        <string>READ_CONTENT</string>
        <string>WRITE_CONTENT</string>
    </privNames>
    <description>Allows users to manage My App</description>
    <category>Administrative</category>
</role>
```

Kademi's permission model follows RFC 3744. Common privilege names are `READ`, `WRITE`,
`READ_CONTENT`, `WRITE_CONTENT` and `WRITE_ACL`. Declaring a role here makes it assignable to
groups; it grants nothing until a controller mapping grants it with `.addRole(...)`. Use
`.postPriviledge(...)` on the mapping to say which privilege a POST requires - `READ_CONTENT` for
safe actions like voting, a write privilege for administrative ones. Several roles can be
declared in one file.

Background: <https://docs.kademi.co/blogs/docs-kb/defining-roles-in-custom-apps/>

## Settings page

```xml
<settings enabled="true" path="/theme/apps/myapp/settings.html">
    <function>saveSettings</function>
</settings>
```

`path` points at a Velocity template in your app's `admin/` or `common/` tree. `<function>` names
the JS function that handles the settings form POST. Only one settings page is enabled at a time.
See [RepoAppSettings](https://docs.kademi.co/ref/templating/md/RepoAppSettings.md).

## What does NOT go in this file

Registered from JS instead, by calling `controllerMappings` methods at module top level:

| Surface | Call |
|---|---|
| Website route | `controllerMappings.websiteController()...build()` |
| Admin route | `controllerMappings.adminController()...build()` |
| Admin portlet | `controllerMappings.adminPortletController()...build()` |
| Website portlet | `controllerMappings.websitePortletController()...build()` |
| Profile / org tab | `controllerMappings.adminProfileTab()`, `adminOrgTab()` |
| JS service | `controllerMappings.newServiceBuilder('name').serviceObject(o).build()` |
| KEditor component | `controllerMappings.addComponent(...)` |
| Saved query | `controllerMappings.addQuery(path, indexNames, roleNames)` |
| Query table | `controllerMappings.addTableDef(id, desc, fnName)` |
| Report | `controllerMappings.addReport(...)` |
| Journey node type | `controllerMappings.addNodeType(name, template)` and friends |
| Journey field | `controllerMappings.addFieldV2(...)`, `newFieldBuilder(...)` |
| Event listener | `controllerMappings.addEventListener(eventType, enabled, fn)` |
| Inbound mailbox | `controllerMappings.mailboxController()...build()` |
| Websocket / SSE | `controllerMappings.websocketController()`, `sseController()` |
| Custom auth handler | `controllerMappings.authenticationHandler()` |
| IDP dynamic paths | `controllerMappings.dynamicIdpPaths()...build()` |
| Menu contributed from JS | `controllerMappings.menuController()` |

Registration is only honoured while the engine is initialising. Once init finishes the list is
immutable and further add calls are silently ignored, so never register from inside a handler.

The full method list, with signatures, is on
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md).

## Admin page title and breadcrumbs

Set these on the mapping, not in the template. Adding your own `<ol class="breadcrumb">` produces
a duplicate bar.

```js
controllerMappings
    .adminController()
    .pathSegmentResolver('item', 'resolveItem')
    .title((page) => page.attributes.item.title)
    .breadCrumbs('itemBreadCrumbs')
    .defaultView(views.templateView('/theme/apps/myapp/manageItem.html'))
    .enabled(true)
    .build();

globalThis.itemBreadCrumbs = (page) => {
    const crumbs = new Map();
    crumbs.set('/items/', 'Items');
    return crumbs;
};
```

Under Nashorn use `formatter.newMap()` and `put(...)` instead of `new Map()`. Without `.title()`
the framework falls back to the template's `<title>` tag, which is extracted before the body
renders, so Velocity variables in it do not resolve - keep that fallback static.
