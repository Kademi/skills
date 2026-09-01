# JsRowStep: writing code inside a pipeline

[JsRowStep](https://docs.kademi.co/ref/templating/md/JsRowStep.md) runs a JavaScript function for
each row a pipeline step emits. It is the escape hatch for anything the declarative steps cannot
express: matching a row to a profile, splitting one row into several, filtering, reformatting,
calling a remote service.

## This is not the same runtime as app server JS

If you write Kademi apps, you already write server-side JavaScript. Pipeline scripts run in a
different environment with different rules. Read this section before assuming anything carries
over.

| | App server JS | Pipeline `JsRowStep` |
|---|---|---|
| Where the file lives | Inside your app's server folder | A plain `.js` file in the **website's own files**, for example `/integration/import.js`, addressed by `jsPath` |
| How it is wired up | Controller mappings, routes, page and portlet bindings | Not wired up at all. The step names one file and one function |
| What calls it | An HTTP request, an event, a scheduled task | The previous pipeline step, once per row |
| Arguments | Request objects such as page, params, form | The row's values, spread as positional arguments |
| Return value | A view, a JSON result | Ignored. You emit rows by calling `rowWriter` or `nextStep` |
| Module system | The app's loader and controller registration | None. One file, top-level functions. Use `importScripts` to pull in another file |
| Engine | Depends on the app file type | A single engine built fresh for the run, with ES6 syntax such as `let`, `const`, arrow functions and template strings, plus polyfills |

Things that are **not** available: `controllerMappings`, `cm`, `page`, `params`, `form`, `files`,
`req`, `resp`, the current request, and anything registered through controller mappings such as
custom services or table definitions. There is no request in scope: a scheduled run has no user
agent, no session and no URL.

## What is in scope

Bound by the step itself:

| Name | What it is |
|---|---|
| `pipeline` | The running [Pipeline](https://docs.kademi.co/ref/templating/md/Pipeline.md) |
| `nextStep` | A [NextStep](https://docs.kademi.co/ref/templating/md/NextStep.md) wrapping the configured `next` |
| `rowWriter` | A [RowWriter](https://docs.kademi.co/ref/templating/md/RowWriter.md) that forwards a row to `next` |
| `thisStep` | This step |
| `log` | A logger for this step, using the `{}` placeholder style |

Also bound, the same platform objects available to server JS generally: `formatter`, `services`,
`userManager`, `queryManager`, `securityManager`, `eventManager`, `applications`, `fileManager`,
`views` and `http`.

## The three functions

```xml
<JsRowStep>
    <jsPath>/integration/import.js</jsPath>
    <prepareFn>startImport</prepareFn>
    <execFn>importRow</execFn>
    <finishFn>endImport</finishFn>
    <next class="DatabaseUpdateStep" providerId="profile" mode="updateOrInsert">
        <column field="email" column="0"/>
        <column field="firstName" column="1"/>
        <column field="surName" column="2"/>
    </next>
</JsRowStep>
```

```js
// /integration/import.js

var stats;

// prepareFn: no arguments, called once before any rows
function startImport() {
    stats = { seen: 0, skipped: 0, written: 0 };
    log.info("startImport for {}", pipeline.pipelinePath);
}

// execFn: one argument per column of the incoming row
function importRow(email, firstName, surName, costCentre) {
    stats.seen++;

    if (!email) {
        pipeline.addWarning("NO-EMAIL", "Row has no email address, skipping");
        stats.skipped++;
        return;                       // emitting nothing filters the row out
    }

    stats.written++;
    rowWriter.write(email.trim().toLowerCase(), firstName, surName);
}

// finishFn: no arguments, called once after the last row
function endImport() {
    pipeline.addInfo("SUMMARY",
        stats.seen + " rows read, " + stats.written + " written, " + stats.skipped + " skipped");
}
```

Notes on the shape:

- The function names are yours. The step calls whatever `execFn`, `prepareFn` and `finishFn` name.
- Arguments are positional and come from the previous step. A CSV row of five columns arrives as
  five arguments. Declare as many as you need and ignore the rest.
- A missing function is not fatal for `execFn` (it is logged and the row is dropped), but a missing
  `prepareFn` or `finishFn` fails the run. Keep the names in step with the file.
- Top-level `var` state survives across rows within one run, which is what makes the counter above
  work. It does not survive between runs.
- Returning a value does nothing. Emit rows explicitly.

## Emitting rows

Two ways, both landing at the step configured as `next`:

```js
rowWriter.write(profile, amount, salesDate);   // forwards a row
nextStep.exec(profile, amount, salesDate);     // runs the next step immediately
```

`nextStep.exec` additionally checks whether the run has been cancelled and records an info message
instead of running when it has, so prefer it inside anything long-running.

Call either one as many times as you like, including zero:

```js
// one row in, several rows out
function explodeQuantities(sku, qty, email) {
    for (var i = 0; i < qty; i++) {
        nextStep.exec(sku, 1, email);
    }
}
```

If the step has no `jsPath` at all, rows pass straight through to `next` untouched.

## The pipeline object

`pipeline` is shared state for the whole run.

```js
// Attributes: name/value pairs every step can see. Named capture groups from the endpoint
// address land here, and Column mappings can read them with attribute="...".
var month = pipeline.attributes.month;
pipeline.attributes.periodStart = "2026-01-01";

// Cache: for lookups you do not want to repeat per row.
var cache = pipeline.cache;

// Messages: what the run reports when it finishes.
pipeline.addInfo("MATCHED", "Matched existing profile " + userName);
pipeline.addWarning("NO-ORG", "Unknown dealer code " + code);
pipeline.addFailure("BAD-AMOUNT", "Amount is not a number: " + raw);

// Where we are, attached to any message recorded after it.
pipeline.setCurrentPosition("Sheet 1, row " + rowNum);

// The organisation this run belongs to, as an OrgData.
var org = pipeline.thisOrg;

// Stop the run.
pipeline.stop();
```

Full property and method list:
[Pipeline](https://docs.kademi.co/ref/templating/md/Pipeline.md) and
[OrgData](https://docs.kademi.co/ref/templating/md/OrgData.md).

## Worked example: match, merge, then import

A common import problem: the incoming feed does not carry your user ids, so each row has to be
resolved to an existing profile, and rows may turn out to be duplicates of each other. This is the
pattern from
[Profile matching and merging in integration scripts](https://docs.kademi.co/blogs/docs-kb/profile-matching-and-merging-in-integration-scripts/).

```js
// /integration/check-custs.js
function checkCusts(firstName, surName, phone, email) {
    var matchReq = userManager.newProfileMatchRequest().or();

    if (email) {
        matchReq.newSubCriteria().and()
            .firstName(firstName)
            .email(email);
    }
    if (phone) {
        matchReq.newSubCriteria().and()
            .firstName(firstName)
            .phone(phone);
    }

    var matched = userManager.findMatching(matchReq);
    log.info("Matched {} profiles", matched.size());

    if (matched.size() === 0) {
        nextStep.exec(firstName, surName, phone, email, null);
    } else if (matched.size() === 1) {
        nextStep.exec(firstName, surName, phone, email, matched.get(0).userName);
    } else {
        // Several matches means the new data has identified duplicates.
        // Merge into the first, then carry on with it.
        var mergeDest = matched.get(0);
        matched.remove(0);
        userManager.mergeProfiles(mergeDest, matched);
        nextStep.exec(firstName, surName, phone, email, mergeDest.userName);
    }
}
```

The extra fifth argument is the resolved user name, which the following [`DatabaseUpdateStep`](https://docs.kademi.co/ref/templating/md/DatabaseUpdateStep.md) maps
with `<column field="userId" column="4"/>` so `updateOrInsert` updates rather than inserts.

## Creating profiles and organisations as you go

```js
function checkCreateProfile(salesId, salesPersonName, dealership, dealershipCode, amount) {
    var profile = pipeline.thisOrg.findProfile(salesId);
    if (profile === null) {
        var org = pipeline.thisOrg.getOrCreateChildOrg(dealershipCode, dealership, "dealership");
        var member = pipeline.thisOrg.createMembership(salesId, null, org, "car-sales");
        profile = member.profile();
    }
    nextStep.exec(profile, amount);
}
```

## Sharing code between scripts

One `jsPath` loads one file. To share helpers, keep them in another file in the same website and
pull it in from the top of your script:

```js
importScripts("/integration/shared.js");
```

## Rules of thumb

- **Do not query per row if you can query once.** Build a lookup in `prepareFn` and keep it in a
  top-level variable, use `pipeline.cache`, or use a [`MapStep`](https://docs.kademi.co/ref/templating/md/MapStep.md) in front of the script.
- **Do not manage transactions.** Put a [`TransactionStep`](https://docs.kademi.co/ref/templating/md/TransactionStep.md) at the root of the pipeline and let it
  own the boundary. Opening a transaction per row is slow and defeats the rollback.
- **Throwing aborts the run.** The exception is logged, recorded as a failure and rethrown, which
  rolls the enclosing transaction back. Throw when the data is unusable; call `addWarning` and
  return when a single row is bad but the rest of the file is fine.
- **Log sparingly.** A log line per row on a 200,000 row file is a real cost. Log every hundredth
  row, or log a summary in `finishFn`.
- **Do not hand-roll batching.** If the file is big enough that you are thinking about chunking it
  yourself, use [MapReduce](map-reduce.md) instead.
- **Positional arguments are fragile.** When a source file gains a column, every script and every
  [`column`](https://docs.kademi.co/ref/templating/md/Column.md) index shifts. Keep the script's argument list and the pipeline XML in one commit, and
  prefer `columnName` over `column` for spreadsheet sources that people edit by hand.
