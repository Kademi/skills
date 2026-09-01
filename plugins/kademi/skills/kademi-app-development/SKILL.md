---
name: kademi-app-development
description: Use when someone is getting started with Kademi, or is working on a Kademi app as a package rather than on the code inside it. Covers what Kademi is and its account, organisation, website and profile model; how a repository app is laid out; whether to build an app, a lib or a theme; setting up KSync and syncing to a hosted account; and creating versions and publishing to the Marketplace. Use on first contact with Kademi, when someone asks what a Kademi term means, how a Kademi app is structured, or how to set up, sync, version, deploy or publish one - including when they do not name Kademi but are clearly working in a Kademi repository. For writing the code inside an app, this skill names the specialist skill to use instead.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: app development

## What Kademi is

Kademi is a hosted SaaS platform for running channel and partner programs: partner portals,
incentives, sales claims, training, rewards and the journeys that drive them. A customer gets an
**account** - one tenant - which owns an organisation tree of partner companies, a set of user
profiles, and one or more public **websites**.

You extend an account by installing **repository apps** from the Kademi Marketplace. A repository
app is a versioned bundle of server-side JavaScript, Velocity templates and browser assets. It
registers what it contributes - URL routes, admin pages, menu items, roles, KEditor components,
portlets, journey node types, integration steps - and the platform calls back into your JavaScript
at the right moments. Everything third parties build on Kademi is a repository app.

Two consequences shape all Kademi development:

- **The account is the runtime.** There is no local server. You edit files locally and sync them to
  a real account.
- **Accounts are the unit of environment.** Teams typically run a development or staging account
  alongside production, and promote app configuration between them with a configuration snapshot:
  <https://docs.kademi.co/blogs/docs-kb/configuration-management/>

## Anatomy of a repository app

The directory name is the **app id** and it appears everywhere else - in dependency declarations,
in template paths, in your asset directory name.

```
myApp/
  app-version.txt            <- "1.0.0". The version. Nothing else in the file
  APP-INF/                   <- server side, never served to visitors
    controllers.xml          <- the manifest. Read this first, always
    app.js
  admin/                     <- assets served on the admin domain only
    theme/apps/myApp/
      hello.html
      dependencies.json
  website/                   <- assets served on public websites only
  common/                    <- assets served on both
```

`admin/`, `website/` and `common/` are **stripped from the URL**. A request on the admin domain is
resolved against `admin/<path>` and then `common/<path>`; a request on a website against
`website/<path>` and then `common/<path>`. So `admin/theme/apps/myApp/hello.html` is served at
`/theme/apps/myApp/hello.html`.

A complete, working four-file app that adds a menu item and an admin page:

`app-version.txt`

```
1.0.0
```

`APP-INF/controllers.xml`

```xml
<controllers>
    <source>/APP-INF/app.js</source>

    <menu parentId="menuRoot" id="menuMyApp" text="My App"
          css="fa fa-star" path="/myapp/" ordering="90"/>
</controllers>
```

`controllers.xml` is the manifest: nothing in `APP-INF/` runs unless this file names it, so read it
first in an unfamiliar app. Its full element reference - engine selection, roles, settings pages -
belongs to `kademi-server-js`.

`APP-INF/app.js`

```javascript
/* global controllerMappings, views, log */

controllerMappings
    .adminController()
    .pathSegmentName('myapp')
    .enabled(true)
    .defaultView(views.templateView('myApp/hello.html'))
    .build();
```

`admin/theme/apps/myApp/hello.html`

```html
<html>
<head>
    <title>My App</title>
</head>
<body>

#set ( $um = $services.userManager )

<section id="myApp">
    <h1>Hello, $!formatter.htmlEncode($um.currentProfile.name)</h1>
</section>

</body>
</html>
```

Note the two different path conventions: `views.templateView(...)` takes a path relative to
`/theme/apps/`, while portlet and component registrations take the full URL path
`/theme/apps/myApp/...`. Mixing them up is the most common cause of a blank page.

Read [references/project-layout.md](references/project-layout.md) when you need the full annotated
tree, when you are deciding which directory a new file belongs in, or when you need to work out
which URL a file in the repository is served at.

## App vs lib vs theme

All three are the same file structure, in the same Marketplace, published the same way. What
differs is what the repository declares itself to provide, which you set in the App Builder when
you create it.

| | Build one when | Installed by |
|---|---|---|
| **App** | You are delivering a feature an account administrator would recognise and choose to turn on: a claims process, a quiz, a payment provider, an integration | The account, from the Marketplace. Appears in the account's app list |
| **Lib** | You are delivering something other apps consume rather than something a user turns on: shared services, a wrapped third-party JS library, common templates | Pulled in automatically as a dependency of an app that names it |
| **Theme** | You are delivering the look of a website: master template, page templates, LESS, fonts, images. Usually no server-side code at all | Selected as a website's theme |

Notes that decide the choice in practice:

- **Depend on a lib, do not copy it.** Name it, with its exact version, in your app's
  `dependencies.json` - the `kademi-themes` skill documents that file.
- **A lib can still register routes and services.** "Lib" is about who installs it, not about what
  it is allowed to do.
- **A lib version is pinned by the app that depends on it.** Two apps can depend on different
  versions of the same lib, so never assume your lib is the only copy on the account.
- **Themes are versioned and published like everything else** - there is no separate theme upload.

## The development loop

There is no local Kademi server - you develop locally against a real Kademi account, and
**KSync** syncs your files to it as you save them. Check out a repository once, then leave
`sync` running while you work:

```bash
java -jar ksync3.jar -command checkout -url <repo-url> -user <username>
java -jar ksync3.jar -command sync
```

`sync` is push-only and never modifies local files; take server-side changes with `pull`.
Publishing to the Marketplace is a separate `publish` command.

Read [references/dev-loop.md](references/dev-loop.md) when you are setting KSync up for the first
time, when you need a command or an option, or when a checkout, sync or pull is not behaving.

## Versions, deploying and the Marketplace

Versions are created **on the server** in the App Builder - you never make a version folder
locally. Duplicate the latest version, increment it, switch to it, sync into it, then publish
from Marketplace Details.

Read [references/publishing.md](references/publishing.md) when you are cutting a new version,
publishing an app for the first time, or releasing an update to one already on the Marketplace.

## Which skill do I need?

| Doing this | Use |
|---|---|
| Confirming a platform class, service, manager or method before calling it | `kademi-api-reference` |
| Anything under `APP-INF/` - `controllers.xml`, routes, services, POST handling, roles, app settings, background async jobs, and tracking down a server-side error | `kademi-server-js` |
| Admin console screens, portlets that add a panel to another app's page, and admin browser JavaScript | `kademi-admin-ui` |
| Velocity templates, website and theme templates, KEditor components, LESS and CSS, and `dependencies.json` on any surface | `kademi-themes` |
| Moving data in or out in bulk - imports, exports, feeds, pipelines, map-reduce, scheduled runs | `kademi-integrations` |
| Custom journey goal and action node types, and the journey fields administrators reach through KCode | `kademi-journeys` |
| Prompt functions, agent definitions, MCP | `kademi-ai` |
| Turning sales records into points - points allocation sources, custom points rule types, expiry, record matching, vouchers | `kademi-rewards` |
| Stores, products, carts and checkout - checkout rules, payment providers, promotion mechanics | `kademi-commerce` |
| Credentials, secrets, request input, authorisation checks, anything security-sensitive | `kademi-security` |
| The house coding standards, and the review to run before handing work back | `kademi-coding-standards` |

That is all eleven specialist skills. If a task fits one of them, hand it over rather than guessing
from this skill. `kademi-coding-standards` is not an alternative to the others - run its review over
your changes whatever else you used.

## Rules that apply everywhere

These hold in server-side JavaScript, in Velocity templates and in every kind of app.

### Verify a platform method exists before you call it

The platform objects you are handed - `services`, `formatter`, `controllerMappings`, `page` and
everything reachable from them - are Java objects dispatched dynamically. **Nothing checks your
method names.** A typo, a method that was renamed, or a method you assumed exists all fail the same
way: a `TypeError` at runtime, when a user hits that page, not when you save the file. Velocity is
worse - an unresolved reference silently renders as empty.

So: look the method up before you call it. Every documented class is at
`https://docs.kademi.co/ref/templating/md/<ClassName>.md`, for example
[Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md),
[ApplicationServices](https://docs.kademi.co/ref/templating/md/ApplicationServices.md) (the
`services` global) and
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md) (the
`controllerMappings` global). The `kademi-api-reference` skill exists for exactly this.

The same rule applies to your own code across apps. If you change the signature of a function you
expose as a service, search every consumer surface - templates as well as scripts - before you
publish. Nothing will tell you at build time that you broke a caller.

### Never reach for Java classes directly

Server-side JavaScript runs sandboxed behind a class whitelist. `Java.type(...)`, `Packages.*` and
equivalents are blocked for anything not explicitly allowed, and the failure is a runtime error on
a live account. Do not design around it: everything you need is already injected as a global -
`services`, `formatter`, `views`, `applications`, `controllerMappings`, `log`. If you cannot find a
platform method for what you want, that is a question for the API reference, not a reason to reach
into the JVM.

### Registration only happens at init

`controllerMappings` is frozen once the app engine has finished initialising. Register controllers,
portlets, components and listeners at the top level of a sourced script. A registration call made
later - from inside a request handler, say - is silently ignored, with no error.

### Declare dependencies, do not assume them

Both halves of this are `dependencies.json`: another app you rely on has to be named there with its
version, and your own CSS and JS files are only injected into a page if they are listed there too.
A file that exists in the repository but is not declared is simply never loaded. The format, and
which surface's copy of the file to edit, are documented by the `kademi-themes` skill.

### One version, one published artifact

Never republish a version that already exists - bump `app-version.txt` and publish a new one.
Accounts pin the version they installed, so overwriting a published version changes code underneath
running programs.

### Assets are public, `APP-INF/` is not

Assume any file under `website/` or `common/` can be fetched by any visitor to the site, and
anything under `admin/` by anyone who can reach the admin domain. Do not put API keys, private
templates or partial work there. `APP-INF/` is loaded by the script engine rather than served, so
server-side logic belongs there - but secrets belong in app settings, not in any file.

## Glossary

Read [references/glossary.md](references/glossary.md) whenever an unfamiliar Kademi term turns up,
or when a familiar word is clearly being used in a narrower sense than usual: account,
organisation, website, repository, branch, profile, group, membership, repository app, component,
portlet, KCode, journey, funnel, lead, pipeline, series.
