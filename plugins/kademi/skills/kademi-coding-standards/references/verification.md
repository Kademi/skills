# Verifying your change

There is no build step and no test suite. The account is the runtime, and the only thing that can
tell you a change works is the account. Everything below is something an ordinary administrator
login can see.

**The file being on the server is not the thing working.** KSync copies bytes. Whether the platform
parsed them, whether the registration in them took effect, and whether the code they registered
runs are three separate questions, and they fail independently.

Ask them in order.

---

## 1. Did the app load at all

An app's scripts are parsed and its registrations run once, when the app initialises for that
version of the repository. If that fails the app does not half work: it does not load, and
everything it registers disappears at once. A menu item vanishes, a route 404s, a component is
missing from the picker, `services.yourService` is undefined. None of those symptoms names the
cause, and developers routinely debug one of them for an hour.

Look in the admin console, at **Websites & apps > Apps**. Find your app and open its app
initialisation info: the init date, the init error if there was one, and the init logs. The Dev
tools page at `/dev-tools` shows the same three for a repository you pick, alongside everything
that repository registered.

Two things to read there:

- **The init error, before anything else.** The top of the message is always generic, along the
  lines of "Couldnt initialise appName=X", which says only that something failed. The part you can
  act on - the file, the line, the unexpected token - is further down the cause chain.
- **The init date.** It should be later than your last sync. An older one means the platform is
  still holding the previous version and your change has not been picked up.

When init fails, fix the parse error before changing anything else. With the app not loading, the
next edit is a guess layered on a guess.

### The unfinished app

A `controllers.xml` that names a script file which does not exist is the most common way to produce
this, and it is not a broken app, it is an unfinished one. On `engineVersion="2.0"` the app **fails
to initialise, every time**, with an error naming the app and the missing source. On Nashorn the
missing file is skipped with one warning in the account log, and everything it would have registered
is silently absent.

Write the scripts first, then the `controllers.xml` entry that names them.

### The account's queries repository

Pick `queries` on the Dev tools page. It loads by a different mechanism from an app, and a script
that fails to parse there takes down every points rule, record matcher, lookup and query table in
the repository at once. The page says so plainly when it happened, and its per-file table gives a
count of what is loaded and in effect right now - so a file you added and a count that is still
zero is the whole answer.

---

## 2. Did the registration actually take effect

Loading is not registering. `addComponent`, `addTableDef`, `addFieldV2`, a controller, a menu item,
an event listener: each is a line of code that ran, or did not.

**The Dev tools page (`/dev-tools`, then pick your app) is the list of what the platform is actually
holding for that app.** Engine version and sources; website and admin mappings; components; admin
and website portlets; profile and organisation tabs; event listeners; menus; roles; app settings;
templates; node types; fields and KCodes; metric types; table action handlers; JS services and JS
implementations; queries; sign-in providers; authentication handlers; mailbox mappings; websocket,
SSE and MCP controllers.

**If your registration is not on that list, it did not happen, whatever the source file says.** The
usual causes, in the order worth checking:

1. The file is not in a `<source>` element of `controllers.xml`, so it never ran.
2. Under GraalJS, the function named in the registration is not on `globalThis`, so the platform
   cannot find it.
3. The extension does not match the engine: a `.mjs` in a `1.1` app is never loaded, a `.js` in a
   `2.0` app is not the entrypoint anything imports.
4. The registration ran after something above it threw, so the file stopped part way. Check the
   init logs.

A registration that **is** on the list still proves only that the registration ran. It says nothing
about whether the code it registered works, because that code has not run yet.

---

## 3. Run the thing

| What you changed | How to see it actually run |
|---|---|
| An admin or website route | Open the path. A 404 means the mapping is not registered (step 2) or a path resolver returned null. `This controller is currently disabled` means the builder is missing `.enabled(true)` |
| A POST handler | Submit it and read the `JsonResult`. An HTML error page instead of JSON is an uncaught exception - go to the debug session |
| A query table | Open `/queries/<tableId>/` on the admin domain, which renders its first rows; add `?as=csv&startAsync=true` to exercise the export path |
| A KCode or journey field expression | The Test KCode page, `/test-kcode/` on the admin domain, linked from the KCodes page under **Data & reports**. Give it a username, organisation, lead or sales record for context; it shows the value and the log lines the expression wrote |
| A background job | Run it and read the job. A job that threw is shown as **cancelled**, with the message in its warnings - see [background-jobs.md](../../kademi-server-js/references/background-jobs.md) |
| A browser asset | View source: your path should appear inside one of the combined `/theme/...` bundle URLs. See [dependencies-json.md](../../kademi-themes/references/dependencies-json.md) |
| A page component | Open the page editor and confirm it is in the picker, then drop one on a page and render it |

**The query table deserves its own warning.** Its loader does not run until something asks for rows,
and when it throws the platform catches the exception and returns it as the table's content. The
table renders two rows reading `Exception running querytable <id> in app <app>` and `Error: ...`,
the request succeeds, and nothing else anywhere reports a failure. So a query table is never
verified by seeing it registered - open it and read the rows.

---

## 4. Things that look like a bug and are not

- **A disabled app keeps its whole repository and registers nothing.** Every file is still there,
  still syncs, still opens. None of it is in effect. Source files existing is not evidence that a
  registration is live; the runtime is what says so. Check the app is enabled before debugging its
  code.
- **A change lands on the version you synced to.** Repositories have versions, and if the account is
  running a different one your edit is real and invisible. The Dev tools page names the branch it is
  showing you.
- **Registering a website page and linking to it are separate acts.** A new page does not appear in
  the site menu until it is added to `/theme/menu.json` in the website repository.
- **Admin client-side JavaScript is served from a combined bundle the browser caches.** A change
  does not reach an already-open tab without a forced reload, whatever version the app carries. Hard
  refresh before believing the change did not work.
- **KSync `sync` is push-only.** It never brings server-side changes down, so anything edited in the
  admin console is missing from your working copy until you `pull`. If you are unsure a file arrived,
  `pull` and read it back.

---

## 5. When it is failing rather than absent

Everything above answers "is it there". Once something is there and behaving wrongly, the tools are
a **debug session** (**Developer > Debugging** in the admin console), which captures one
request or task with its parameters, its authenticated user and every log line it wrote, and the
**Logs** screen (**Settings > Logs**), which searches and tails your account's log.

Both are documented in
[kademi-server-js/references/troubleshooting.md](../../kademi-server-js/references/troubleshooting.md),
along with what each failure mode looks like. Read that rather than guessing from the symptom.

Add logging before you need it. A log line either side of the part in doubt usually settles in one
request what reading the code will not settle at all.

---

## 6. Say what you checked

Report the checks you ran and the ones you did not. "The app initialises with no error and the
component is registered; I have not rendered it on a page" is a useful sentence. Silence about the
second half is not, because nobody else can tell the difference between checked and assumed.
