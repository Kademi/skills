# Client-side JavaScript and CSS

Applies to everything under `admin/`, `website/` and `common/` in your app - admin pages,
portlet templates and website pages alike.

## What is already loaded

| Library | Version |
|---|---|
| jQuery | 3.6 |
| Bootstrap | 3.4.1 |
| FontAwesome | 6 |

The admin theme also loads Kademi's own client libraries, so on an admin page the globals
below are available without your app declaring anything. On a **website** page you must add
the matching library to `appDependencies` before using them.

| Global | Provided by | Purpose |
|---|---|---|
| `pageInitFunctions` | theme | array of functions run on page load |
| `Msg` | `kademi-msg-lib` | transient toast messages |
| `Kalert` | `bootstrap-sweetalert-lib` | modal confirm and alert dialogs |
| `showStandardError` | theme utilities | standard "something went wrong" toast |
| `$.fn.forms` | `jquery-forms-lib` | form submit, validation and error display |
| `$.fn.reloadFragment` | `jquery-reloadFragment-lib` | reload one element from the server |
| `csrfToken` | website theme | CSRF token string - **website pages only**, see below |
| `flog` | theme utilities | console logging that respects the debug flag |

Prefer the **Fetch API** for new HTTP calls. jQuery's `$.ajax` is still used widely and is
fine to match in existing code.

## Registering assets

Every JS, CSS and LESS file is declared in the `dependencies.json` beside it in
`theme/apps/<appId>/`. Never use an inline `<script src="...">` or
`<link rel="stylesheet">` in a template - **including portlet templates**. Declaring the file
is what wires up CSRF and lets the platform concatenate it into a bundle.

```json
{
    "appDependencies": [{ "appId": "jquery-forms-lib", "branch": "2.2.2" }],
    "dependencies": [
        { "js":  { "path": "/theme/apps/myapp/managePolls.js", "group": "main" } },
        { "css": { "path": "/theme/apps/myapp/managePolls.css", "cssMedia": "all" } }
    ]
}
```

That is enough to register a script and a stylesheet. For the complete format - `less`,
`position`, bundling groups and how `appDependencies` resolve - use the `kademi-themes`
skill.

## Initialisation

Your JS is loaded on **every** page of that side of the account, so it must cheaply detect
whether it is needed and return early. Register the work through `pageInitFunctions`:

```js
/* global pageInitFunctions, $ */
pageInitFunctions.push(function () {
    var container = $('#poll-list');
    if (!container.length) {
        return;
    }
    initPolls(container);
});
```

Gate on something specific and stable - an id or a class your template puts on the page - not
on the URL.

## User messages

`Msg` shows a transient toast. Always pass a category as the second argument so a repeated
message replaces its predecessor instead of stacking:

```js
Msg.info('Refreshing balances...', 'points');
Msg.success('Points balances refreshed', 'points');
Msg.warning('3 profiles were skipped', 'points');
Msg.danger('Could not refresh balances', 'points');
```

`showStandardError(whatYouWereDoing)` renders the house-style failure message, so error
handling reads the same everywhere:

```js
showStandardError('refreshing points balances');
// -> "Sorry, an unexpected error occurred when refreshing points balances"
```

It takes two optional further arguments: a callback, and the response object to log.

## Confirmation dialogs

Use `Kalert.confirm` with **two or three arguments only**:

```js
// (message, callback)
Kalert.confirm('Delete this poll? This cannot be undone.', function () {
    doDelete();
});

// (message, confirmButtonText, callback)
Kalert.confirm('This will permanently discard the preview. This cannot be undone.',
    'Yes, delete preview',
    function () {
        doDelete();
    });
```

**Never call it with four or more arguments.** The long form
`Kalert.confirm(title, message, type, btnClass, btnText, callback)` looks like the complete
signature and is what gets copy-pasted, but anything past three arguments takes a branch that
passes your `type` straight through to the bundled dialog library, where an unscoped `logStr`
reference throws:

```
Uncaught ReferenceError: logStr is not defined
```

The dialog never opens. Called synchronously from inside a jQuery click handler that is the
whole failure: the click appears to do nothing at all. The two and three argument forms
already default to a warning icon and a red `btn-danger` confirm button, so the extra
arguments buy nothing. If you want a custom title, fold it into the message text.

Related: `Kalert.info`, `Kalert.success`, `Kalert.warning`, `Kalert.error` for a plain
acknowledgement dialog, `Kalert.confirmWait` for a confirm that keeps the dialog open with a
spinner until you call `Kalert.close()`, and `Kalert.prompt` for a single text input.

## Forms

Always drive form submits with the `forms()` plugin. It serializes, posts, and renders both
client-side and server-side validation errors in the standard way.

```js
$('#mergeForm').forms({
    onSuccess: function (resp) {
        Msg.success('Merged ok', 'merge');
        $('#dups-body').reloadFragment();
    }
});
```

- Use `onSuccess` for the success path. Errors are handled by the built-in `onError`; do not
  override it. If you need extra behaviour after a failure, use `afterError`, which runs
  after the built-in display rather than replacing it.
- The server returns a JSON result whose `status`, `messages` and field errors the plugin
  already understands. Reference:
  [JsonResult](https://docs.kademi.co/ref/templating/md/JsonResult.md),
  [ValidationContext](https://docs.kademi.co/ref/templating/md/ValidationContext.md).

### Custom client-side validation

Pass a `validate` function and return the plugin's shape. Let the plugin render the messages
and highlight the fields; do not roll your own (for example by disabling the save button).

```js
form.forms({
    validate: function (form) {
        var errorFields = [], errorMessages = [];
        if (badSitemap) {
            errorFields.push(sitemapInput);
            errorMessages.push('Sitemap URL must be absolute');
        }
        return { error: errorMessages.length, errorFields: errorFields, errorMessages: errorMessages };
    },
    onSuccess: function () { Msg.success('Saved', 'settings'); }
});
```

Each `errorFields` entry gets `has-error` applied to its `closest('.form-group')`, so a
validated input **must** sit inside a `.form-group`. `has-error` on a bare `.input-group` is
not styled. Keep server-side validation as well - it surfaces through the same display.

### Serialization timing

The plugin serializes the form **before** `beforePostForm` runs. If a hidden input's value is
computed dynamically, keep it in sync as the user types rather than filling it in at submit
time:

```js
container.on('input change', 'input, select', function () {
    hiddenInput.val(computeValue());
});
form.forms({ onSuccess: function () { Msg.success('Saved', 'settings'); } });
```

### JSON in a hidden input

HTML-encode server-side so quotes do not break the attribute. The browser decodes it, so
`$('#myInput').val()` returns valid JSON:

```velocity
<input type="hidden" id="myInput" value="$formatter.htmlEncode($!{jsonValue})"/>
```

## Refreshing part of a page

Use `reloadFragment` on the element that changed, rather than reloading the whole page:

```js
$('#users-list').reloadFragment();
```

A full `window.location.reload()` is worse than it looks. It comes back on whatever hash the
page is sitting on, and the tab initialiser only falls back to the first tab when there is no
hash at all - so a reload with a hash matching no tab returns a page with every tab pane
hidden. It also loses scroll position and re-runs every page initialiser.

The element you reload **must have an id**. The plugin re-requests the current page and copies
the matching element out of the response, so it can only find your fragment by id, and it
silently warns and skips an element without one.

### Re-binding after a swap

`reloadFragment` replaces the markup inside the element. Any handler bound **directly** to an
element inside it dies with the old markup, and so does every jQuery plugin that had decorated
those nodes. Two ways out, in order of preference:

**Delegate from a stable ancestor.** A delegated handler is bound to the ancestor, not to the
replaced nodes, so it survives any number of reloads and needs no re-binding at all. Make this
the default.

```js
$(document).on('click', '#users-list .btn-remove', function () { ... });
```

**Or re-apply the element-bound initialisers**, scoped to the reloaded container so nothing
outside it gets bound twice. Plugin inits are the usual casualties - `forms()`, `domFinder()`,
`bootstrapSwitch()`, date pickers, tooltips. Hang them off the plugin's `whenComplete` callback
so they run against the new markup:

```js
$('#users-list').reloadFragment({
    whenComplete: function () {
        var container = $('#users-list');
        container.find('form').forms({ onSuccess: onUserSaved });
        container.find('input[type=checkbox]').bootstrapSwitch();
    }
});
```

Scope every selector to the container. Re-running a page-wide init after a partial reload binds
a second handler to everything that was *not* replaced, and the symptom - one click firing the
action twice, then three times - shows up long after the change that caused it.

## AJAX and fetch

With `$.ajax`, use `.done()` and `.fail()`. The `success`, `error` and `complete` callbacks
are deprecated.

```js
$.ajax({ url: '/check-status/' })
    .done(function (data) {
        if (data.status) {
            Msg.success('Complete', 'status');
        } else {
            Msg.warning('Incomplete', 'status');
        }
    })
    .fail(function () {
        showStandardError('checking status');
    });
```

Check **both** the HTTP status and the `status` field in the JSON body - a validation failure
comes back as HTTP 200 with `status: false`.

### The CSRF token is website-only

On a **website** page, send the `K-CSRF` header on any POST. `csrfToken` is a global there, and
the website theme also installs a jQuery prefilter that adds the header to `$.ajax` calls for
you, so only Fetch needs it by hand.

```js
fetch('/check-status/', {
    method: 'POST',
    headers: { 'K-CSRF': csrfToken }
})
    .then(resp => resp.json())
    .then(data => {
        if (data.status) {
            Msg.success('Complete', 'status');
        } else {
            Msg.warning(data.messages.join(', '), 'status');
        }
    })
    .catch(() => showStandardError('checking status'));
```

On an **admin console** page there is no token. `csrfToken` is not defined, no prefilter is
installed, and admin POSTs send no header. That does not leave the admin domain unprotected: the
platform checks the browser's origin headers on every state-changing request, on both domains,
before the handler runs, and the token is defence in depth on top of that for website XHR. Do
not add a token header to admin code: `csrfToken` is undefined there and the line is dead. A
file in `common/` runs on both sides, so guard the lookup rather than assuming the global
exists:

```js
var headers = typeof csrfToken === 'undefined' ? {} : { 'K-CSRF': csrfToken };
```

## Polling a background task

The server half of this - starting the job, reporting progress, and honouring
cancellation - lives in the `kademi-server-js` skill, in its background-jobs reference. This
section covers only the browser half.

When an action starts an async job, have the server return the **job id** - not the task
name - and poll `/job-manager/` with that id:

```js
$('#myform').forms({
    onSuccess: function (result) {
        if (result.status && result.nextHref) {
            pollJob(result.nextHref);   // nextHref carries the job id
        }
    }
});

function pollJob(jobId) {
    $.ajax({ url: '/job-manager/', data: { jobId: jobId }, dataType: 'json' })
        .done(function (result) {
            var job = result.data;
            if (result.status && job) {
                Msg.info(job.statusMessage, 'jobstatus');
                if (job.cancelled) {
                    showStandardError('running that task');
                    return;
                }
                if (job.complete) {
                    $('#my-container').reloadFragment();
                    return;
                }
            }
            window.setTimeout(function () { pollJob(jobId); }, 1000);
        })
        .fail(function () { showStandardError('checking progress'); });
}
```

**Do not poll `/tasks/{taskName}`.** That resolves a job by task name, and every run of a given
task shares one name, so a poll made in the gap between submitting a run and it being picked up
is answered with the *previous* run - which is complete. The caller cannot tell the two apart,
concludes the task finished instantly, and acts on stale data. A job id identifies one run and
has no such ambiguity. Poll `/job-manager/` with the id, always.

`statusMessage` is whatever the task last reported, or null for a task that reports no
progress. It is refreshed by a background scanner every few seconds, so it lags slightly and
a task finishing in under a few seconds may only ever report its final message. There is no
value in polling faster than about once a second.

## Admin tables

- Prefer adding an icon button to the existing actions button group over adding a new column.
- Indicate state with an inline label next to the primary identifier in the name cell:
  `<span class="label label-warning">Hidden</span>`.
- Use FontAwesome icons for toggle actions - `fa-eye` / `fa-eye-slash` for visibility,
  `fa-lock` / `fa-unlock` for access.

## CSS and LESS

- Declare stylesheets in `dependencies.json`, never inline.
- Use Bootstrap's own classes and variables first. Customise and extend them before writing
  a new class.
- **No page-specific stylesheets.** If a layout need is genuinely new, it belongs in a shared
  class used by every page that has it.
- Use the semantic classes correctly - see [ux-standards.md](ux-standards.md) for which of
  `success`, `danger`, `warning`, `info` and `default` applies where.
- Name classes as generally as you can without being too broad, and keep layout logic in one
  place rather than duplicating it per page.

## When your change does not show up

Admin JavaScript is served in a combined bundle that the browser is told to cache for a week, so an
already-open tab keeps running the old code after a sync whatever version the app carries. Hard
refresh before concluding the change did not work, and look for your file's path inside one of the
combined `/theme/...` URLs in the page source to confirm the bundle picked it up.
