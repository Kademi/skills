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
| `csrfToken` | theme | CSRF token string, on every page |
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

**Never call the six-argument form** `Kalert.confirm(title, message, type, btnClass, btnText,
callback)`. It hits a bug in the bundled dialog library: an unscoped reference throws
`ReferenceError` when the call is made synchronously from inside a jQuery click handler, so
the dialog never opens. This keeps recurring because the broken form gets copy-pasted. The
two and three argument forms already default to a warning icon and a red confirm button, so
the extra arguments buy nothing - if you need a custom title, fold it into the message.

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

When you replace a fragment, any handler bound **directly** to an element inside it dies with
the old markup. Either delegate from a stable ancestor, or re-apply the element-bound
initialisers scoped to the reloaded container so nothing outside it gets bound twice:

```js
// preferred: survives any number of fragment reloads
$(document).on('click', '#users-list .btn-remove', function () { ... });
```

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

With Fetch, send the `K-CSRF` header on any POST, and check **both** the HTTP status and the
`status` field in the JSON body - a validation failure comes back as HTTP 200 with
`status: false`.

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

`csrfToken` is a global on every page, so any file loaded through `dependencies.json` can
use it.

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

**Do not poll by task name.** A task name is shared by every run of that task, so a poll made
in the gap between submitting a run and it being picked up is answered with the *previous*
run - which is complete. The caller cannot tell the two apart, concludes the task finished
instantly, and acts on stale data. A job id identifies one run and has no such ambiguity.

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
