# Project Layout

Every repository app - app, lib, theme or recipe - has the same shape. The directory name is the
**app id**, and it is the id you use everywhere else: in `dependencies.json`, in template paths,
and in the `theme/apps/<appId>/` directory that holds your assets.

## The tree

```
myApp/                                  <- directory name is the app id
  app-version.txt                       <- the version, e.g. "1.4.2". Nothing else in the file
  APP-INF/                              <- server side. Never served to website visitors
    controllers.xml                     <- the manifest. Read first, always
    app.js                              <- registration + handlers (.mjs on the modern engine)
    services.js
    admin/
      manageThings.js
  admin/                                <- static assets served on the admin domain only
    theme/apps/myApp/
      manageThings.html                 <- Velocity page template
      manageThings.js                   <- browser JS
      manageThings.css
      dependencies.json                 <- what to load on admin pages
  website/                              <- static assets served on public websites only
    theme/apps/myApp/
      viewThing.html
      myApp.less
      dependencies.json                 <- what to load on website pages
  common/                               <- served on BOTH admin and websites
    theme/apps/myApp/
      components/                       <- KEditor components live here by convention
        thingListComponent.html
        thingListComponent.js
        thingListSettings.html
        thingList.png                   <- the component's preview image
    theme/media/
      logo.png
```

## How each directory is served

The `admin/`, `website/` and `common/` prefixes are **stripped from the URL**. They are not part
of the path a browser requests.

| Request arrives on | Platform looks in | Then falls back to |
|---|---|---|
| The admin domain | `admin/<path>` | `common/<path>` |
| A public website | `website/<path>` | `common/<path>` |

So `admin/theme/apps/myApp/manageThings.html` is served at `/theme/apps/myApp/manageThings.html`
on the admin domain, and is invisible to website visitors. A file at
`common/theme/apps/myApp/thing.js` is reachable at `/theme/apps/myApp/thing.js` on both.

Consequences worth internalising:

- **A file in two places wins in the specific one.** `admin/theme/apps/myApp/x.html` shadows
  `common/theme/apps/myApp/x.html` on the admin domain.
- **`common/` is the right home for KEditor components**, because a component is configured in the
  admin editor and rendered on the website. Putting it in `website/` breaks the editor preview.
- **`APP-INF/` is not a web directory.** Its contents are loaded by the script engine, not served.

## `app-version.txt`

A single line, no trailing content beyond the number:

```
1.4.2
```

Format is `<major>.<minor>.<patch>`. This is the version the Marketplace publishes and the version
other apps name in their `dependencies.json`. Third-party libraries wrapped as Kademi libs
conventionally use `<upstream version>.<wrapper patch>`, e.g. `1.13.11.5` for upstream `1.13.11`.

Bump it when you cut a new version to publish - see [publishing.md](publishing.md).

## `APP-INF/controllers.xml`

The manifest. Nothing in `APP-INF/` runs unless this file names it: script files are loaded in the
order they are listed in `<source>` elements, and the file also selects the JavaScript engine and
declares the app's menu items, roles and settings page. Read it first when you open an unfamiliar
app - it tells you the engine, the entry points and what the app contributes.

The element-by-element reference, and everything an app registers from JavaScript against the
`controllerMappings` global, belong to the `kademi-server-js` skill.

## `dependencies.json`

One per asset directory, at `<admin|website|common>/theme/apps/<appId>/dependencies.json`. It
declares two things: the other apps this app depends on, and which of your own CSS, LESS and JS
files to inject into pages on that surface. A file that exists in the repository but is not
declared here is never loaded.

The format is documented in full by the **`kademi-themes`** skill. See also
[Dependency](https://docs.kademi.co/ref/templating/md/Dependency.md).

## Templates

Page templates are Velocity, and they live under `theme/apps/<appId>/`. A controller names one
with a path relative to `/theme/apps/`:

```javascript
.defaultView(views.templateView('myApp/manageThings.html'));
```

Portlets and component templates name the full URL path instead:

```javascript
.templatePath('/theme/apps/myApp/myPortlet.html');
```

Two different conventions for the same directory - it is a common source of 404s.

## Themes

A theme is the same structure with almost everything omitted. It usually has only
`app-version.txt` and a `website/theme/` directory holding `masterTemplate.html`, page templates,
`less/`, `fonts/` and `img/`. A theme has no `APP-INF/` unless it also registers behaviour. See
[RepositoryAppTheme](https://docs.kademi.co/ref/templating/md/RepositoryAppTheme.md).
