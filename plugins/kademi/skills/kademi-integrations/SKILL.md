---
name: kademi-integrations
description: Use for any task that moves data into or out of a Kademi account in bulk - imports, exports, feeds, ETL, CRM sync, or processing a large number of rows, records, profiles or orders. Covers pipelines and their step catalogue, CSV, Excel and fixed-width input, query and database exports, JsRowStep for per-row scripting, MapReduceStep for batched parallel processing, inbound endpoints over HTTP, FTP, SFTP and email, table uploaders, and running a pipeline on a schedule. Use when a nightly feed is failing or timing out, when work needs to happen on a recurring schedule, or when asked the best way to process a large dataset on Kademi - this skill is the answer to how map-reduce is done here.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: integrations

Kademi's integration framework moves data in and out of an account. Three pieces:

- A **pipeline** is a tree of steps that processes data. Defined as XML, edited in the admin UI.
- An **endpoint** connects a pipeline to the outside world: an address over HTTP, FTP, SFTP or
  email, inbound or outbound.
- A **schedule** fires work on a recurring interval: either an endpoint's pipeline, or a function
  in your own app.

Everything lives under **Data > Integration** on a website with the integration app enabled. Kademi
recommends a dedicated integration website, separate from the one your users browse.

## What a pipeline is

A pipeline is a **tree of steps, not a list**. One input step sits at the root. Each step processes
what it is given and hands rows to its `next`; a step can have several children, so the tree can
fan out.

The pipeline runs each step through three phases: `prepare` once before any data, `exec` once per
row (or once per file, depending on the step), and `finished` once at the end. Steps that summarise,
email or trigger follow-up work do it in the `finished` phase, which is why they usually appear at
the bottom of the tree.

A run is triggered by an endpoint receiving data, by a schedule, or by a person clicking Run.

Here is a complete import: a CSV of car sales arrives, each row is resolved to a salesperson, the
sales records are written to a series, then points are allocated and a summary is emailed.

```xml
<TransactionStep>
    <next class="CsvInput" startRow="1" charsetName="UTF-8">
        <skipIfBlankColumns>
            <int>0</int>
        </skipIfBlankColumns>

        <next class="JsRowStep">
            <jsPath>/integration/sales-import.js</jsPath>
            <execFn>resolveSalesPerson</execFn>

            <next class="SalesDataInserter" mode="updateOrInsert" ignoreMissingEntity="false">
                <seriesName>car-sales</seriesName>
                <column field="attributedTo" column="0"/>
                <column field="amount" column="1"/>
                <column field="fromDate" attribute="periodStart"/>
                <column field="toDate" attribute="periodEnd"/>

                <next class="MultiStep">
                    <nextSteps>
                        <runPointsAllocation>
                            <seriesName>car-sales</seriesName>
                        </runPointsAllocation>
                        <ResultEmail onlySendOnFailure="true">
                            <recipients>
                                <string>integrations@example.com</string>
                            </recipients>
                            <subject>Car sales import</subject>
                        </ResultEmail>
                    </nextSteps>
                </next>
            </next>
        </next>
    </next>
</TransactionStep>
```

Reading it:

- `TransactionStep` at the root makes the whole run atomic: commit at the end, roll back on failure.
- `CsvInput` turns the uploaded stream into rows, skipping the header and any row with a blank
  first column.
- `JsRowStep` runs one function per row and forwards what it chooses to forward.
- `SalesDataInserter` maps row positions onto series fields. `attribute="periodStart"` pulls a value
  out of the pipeline's attributes rather than the row.
- `MultiStep` fans out to two terminal steps that both do their work in the `finished` phase.

Two XML details that catch people out: **some properties are attributes and some are child
elements** (`mode` is an attribute, `seriesName` is an element), and **the XML element name is not
always the class name** (`ResultEmail`, `MapReduce`, `QueryExport`, `TableUploader`). Both are
tabulated in [references/pipeline-steps.md](references/pipeline-steps.md).

The admin UI renders a form per step and writes the XML for you, which is the easiest way to get
this right. Steps with no dedicated form fall back to the raw XML editor.

## Choosing steps

| Role | Steps |
|---|---|
| **Input** (the root; produces rows) | [`CsvInput`](https://docs.kademi.co/ref/templating/md/CsvInput.md), [`ExcelInputStep`](https://docs.kademi.co/ref/templating/md/ExcelInputStep.md) with [`NextSheetStep`](https://docs.kademi.co/ref/templating/md/NextSheetStep.md), [`FixedWidthInput`](https://docs.kademi.co/ref/templating/md/FixedWidthInput.md), [`DatabaseSourceStep`](https://docs.kademi.co/ref/templating/md/DatabaseSourceStep.md), [`QueryExport`](https://docs.kademi.co/ref/templating/md/QueryExportStep.md) |
| **Transform** (rows in, rows out) | [`JsRowStep`](https://docs.kademi.co/ref/templating/md/JsRowStep.md), [`MapStep`](https://docs.kademi.co/ref/templating/md/MapStep.md), [`SetAttributesStep`](https://docs.kademi.co/ref/templating/md/SetAttributesStep.md), [`column`](https://docs.kademi.co/ref/templating/md/Column.md) mappings |
| **Branch** (fan out or route) | [`MultiStep`](https://docs.kademi.co/ref/templating/md/MultiStep.md), [`DecisionStep`](https://docs.kademi.co/ref/templating/md/DecisionStep.md) |
| **Persist** (writes to the account) | [`DatabaseUpdateStep`](https://docs.kademi.co/ref/templating/md/DatabaseUpdateStep.md), [`SalesDataInserter`](https://docs.kademi.co/ref/templating/md/SalesDataInserter.md), [`TableUploader`](https://docs.kademi.co/ref/templating/md/TableUploaderStep.md), [`PersistAsTable`](https://docs.kademi.co/ref/templating/md/PersistAsTableStep.md) |
| **Output** (produces a response or file) | [`CsvOutput`](https://docs.kademi.co/ref/templating/md/CsvOutput.md), [`ExcelOutputStep`](https://docs.kademi.co/ref/templating/md/ExcelOutputStep.md), [`TemplateOutput`](https://docs.kademi.co/ref/templating/md/TemplateOutput.md), [`VelocityOutput`](https://docs.kademi.co/ref/templating/md/VelocityOutputStep.md) |
| **Control and lifecycle** | [`TransactionStep`](https://docs.kademi.co/ref/templating/md/TransactionStep.md), [`RecordExecutionStep`](https://docs.kademi.co/ref/templating/md/RecordExecutionStep.md), [`Reindex`](https://docs.kademi.co/ref/templating/md/ReIndexPipelineStep.md), [`runPointsAllocation`](https://docs.kademi.co/ref/templating/md/RunPointsAllocationSourcesPipelineStep.md), [`ResultEmail`](https://docs.kademi.co/ref/templating/md/ResultEmailPipelineStep.md), [`MapReduce`](https://docs.kademi.co/ref/templating/md/MapReduceStep.md) |

Quick answers:

- Import a file: `TransactionStep` > an input step > `JsRowStep` if you need logic > a persist step.
- Export a saved query or index query: `TransactionStep` > `QueryExport` > `CsvOutput`.
- Export from a platform table: `DatabaseSourceStep` with a `providerId` > `CsvOutput`.
- Do two things with the same rows: `MultiStep`.
- Very large dataset: `PersistAsTable` > `MapReduce`.

Read [references/pipeline-steps.md](references/pipeline-steps.md) when you are choosing a step or
configuring one. It catalogues every step - what it consumes, what it emits, its full configuration,
its XML element name - plus the table provider ids that `DatabaseSourceStep` and
`DatabaseUpdateStep` accept. It is long, so load it at that point rather than up front.

## Writing code in a pipeline: JsRowStep

[JsRowStep](https://docs.kademi.co/ref/templating/md/JsRowStep.md) runs a JavaScript function per
row. It is the escape hatch for matching, filtering, reshaping and calling out to other systems.

**This is a different runtime from an app's server JavaScript, and the rules are not the same.**
The script is a plain `.js` file in the website's own files, named by `jsPath`. It is not wired up
through controller mappings, there is no `controllerMappings`, no `cm`, no `page`, no `params`, no
request in scope, and no module system: one file, top-level functions, called by name. Use
`importScripts("/integration/shared.js")` to pull in another file.

```xml
<JsRowStep>
    <jsPath>/integration/sales-import.js</jsPath>
    <prepareFn>startImport</prepareFn>
    <execFn>resolveSalesPerson</execFn>
    <finishFn>endImport</finishFn>
    <next class="SalesDataInserter">...</next>
</JsRowStep>
```

```js
// /integration/sales-import.js
var stats;

function startImport() {                       // prepareFn: no arguments, once, before any rows
    stats = { seen: 0, skipped: 0 };
    pipeline.attributes.periodStart = "2026-01-01";
    pipeline.attributes.periodEnd = "2026-01-31";
}

function resolveSalesPerson(salesId, amount) { // execFn: one argument per incoming column
    stats.seen++;
    var profile = pipeline.thisOrg.findProfile(salesId);
    if (profile === null) {
        pipeline.addWarning("NO-PROFILE", "Unknown sales id " + salesId);
        stats.skipped++;
        return;                                // emitting nothing filters the row out
    }
    nextStep.exec(profile, amount);            // or rowWriter.write(profile, amount)
}

function endImport() {                         // finishFn: no arguments, once, after the last row
    pipeline.addInfo("SUMMARY", stats.seen + " rows, " + stats.skipped + " skipped");
}
```

What is in scope:

- `pipeline` - the running [Pipeline](https://docs.kademi.co/ref/templating/md/Pipeline.md):
  `attributes`, `cache`, `thisOrg`, `addInfo`, `addWarning`, `addFailure`, `setCurrentPosition`,
  `stop`.
- `rowWriter` - a [RowWriter](https://docs.kademi.co/ref/templating/md/RowWriter.md); `write(...)`
  forwards a row to `next`.
- `nextStep` - a [NextStep](https://docs.kademi.co/ref/templating/md/NextStep.md); `exec(...)` runs
  `next` immediately and no-ops if the run has been cancelled.
- `thisStep`, `log`, and the usual platform objects: `formatter`, `services`, `userManager`,
  `queryManager`, `securityManager`, `eventManager`, `applications`, `fileManager`, `views`, `http`.

Call `write` or `exec` as many times as you like, including zero: no call filters the row out,
several calls split one row into many.

Read [references/js-row-step.md](references/js-row-step.md) when you are writing or debugging the
script a `JsRowStep` runs: the full binding list, more examples, and the profile matching and
merging pattern.

## Processing a lot of rows: MapReduceStep

**Use [MapReduceStep](https://docs.kademi.co/ref/templating/md/MapReduceStep.md). Do not write your
own batching.**

A plain pipeline is one thread, one pass, usually one transaction, and when triggered over HTTP it
is bounded by the request. Fine for thousands of rows. Not fine for a nightly file of tens of
thousands, or a recalculation across every profile in the account.

`MapReduce` does not process data itself. It **queues a job**, records the job id on the run, and
passes its arguments straight through to `next`. The work happens afterwards:

- The **map function** runs once and splits the work into batches by adding sub-tasks to a
  [SubTaskList](https://docs.kademi.co/ref/templating/md/SubTaskList.md). It should do no real work.
- Each batch becomes its own job and runs the **reduce function** in parallel, in its own
  transaction.
- When every batch is done, the reduce function runs once more on the root job, where you write a
  summary.

```xml
<TransactionStep>
    <next class="CsvInput" startRow="1" passAsList="true">
        <next class="PersistAsTable">
            <next class="MapReduce">
                <mapFn>mapOrderImport</mapFn>
                <reduceFn>reduceOrderImport</reduceFn>
            </next>
        </next>
    </next>
</TransactionStep>
```

```js
function mapOrderImport(job, props, params, subTaskList, jobContext) { }
function reduceOrderImport(job, props, params, jobContext) { }
```

Read [references/map-reduce.md](references/map-reduce.md) when you are writing a map or reduce
function or sizing its batches. Four things to get right, all covered there:

- **Batch size.** Aim for tens to low hundreds of batches of a few hundred to a couple of thousand
  items. Not four huge ones, not ten thousand tiny ones.
- **Idempotency.** Batches can be retried. Use upserts keyed on the source data, never
  `value = value + n`.
- **Transaction boundaries.** One transaction per batch. There is no all-or-nothing across the
  dataset; if you need that, you need a plain pipeline and a small dataset.
- **Where failures show up.** On the job, not on the pipeline run. The run completes as soon as the
  job is queued.

`mapFn` and `reduceFn` are global functions in the **website's server JavaScript**, not in the
`JsRowStep` file. You can also start the same kind of job with no pipeline at all, using
[AsyncJobManager](https://docs.kademi.co/ref/templating/md/AsyncJobManager.md) from app code - that
is written up in the `kademi-server-js` skill, in its `references/background-jobs.md`.

## Getting data in: endpoints

An [EndPointMapping](https://docs.kademi.co/ref/templating/md/EndPointMapping.md) is one route: an
id, a type, a direction, an address pattern and a pipeline path.

```xml
<integration>
    <endpoint id="inbound-sales"
              type="http"
              direction="in"
              address="/inbound\/sales (?&lt;month&gt;.*)\.xlsx"
              pipelinePath="/integration/sales-import.xml"
              enabled="true"/>
</integration>
```

- **`address` is a regular expression.** Named capture groups become pipeline attributes, so
  `(?&lt;month&gt;.*)` gives you `pipeline.attributes.month` and `attribute="month"` in a `column`
  mapping. The `&lt;` escaping is XML, not a typo.
- **HTTP inbound** takes a multipart POST; the head step receives the file as an `InputStream`, form
  parameters become attributes, and the response is JSON reporting failures, warnings and infos.
  **HTTP outbound** streams the pipeline output to a GET, or posts the export to a remote URL.
- **SFTP** is the recommended transport for scheduled batch files; use `username` with either
  `password` or a PEM `privateKey`. **FTP/S** is supported but legacy.
- **Email inbound** matches the pattern against the local part of the recipient address, and
  requires the sender's address to resolve to an existing profile in the account. **Email outbound**
  sends the export as an attachment to addresses and to groups.
- **Upload only** has no listener: files are uploaded by hand in the admin.
- Credentials and addresses can reference environment variables and secrets as `${my.variable}` or
  `${secret.name}`. Keep secrets out of the XML.

Endpoints are created with the **Create Import / Create Export** wizard, or by editing the config
XML. They can only be edited on a **draft** version of the website, and only the live version runs,
so publish the draft.

Read [references/endpoints.md](references/endpoints.md) when you are creating, configuring or
debugging an endpoint: every setting per transport, duplicate prevention, the two integration roles,
and the [IntegrationManager](https://docs.kademi.co/ref/templating/md/IntegrationManager.md) API for
creating endpoints from code. Also
[Creating and Editing Integration Endpoints in Kademi](https://docs.kademi.co/blogs/docs-kb/creating-and-editing-integration-endpoints-in-kademi/).

## Table uploaders

A **table uploader** is a ready-made importer for a standard record type. An administrator uploads
a spreadsheet, maps its columns to the uploader's fields, and runs it as a background job with
progress and per-row errors. The mapping can be saved by name and reused. Uploaders exist for the
common record types the installed apps provide: profiles and group memberships, organisations,
products, product SKUs and categories, points, sales data, vouchers, leads, learning records and
more. Sanity checks and before and after actions can be configured per uploader.

**Use a table uploader instead of a pipeline when:**

- The target is a standard record type an uploader already covers.
- The load is human-driven and occasional. There is nothing to build.
- The source column layout varies between senders. A saved mapping is chosen per column, so it
  copes with reordering in a way that positional `column="3"` indexes do not.
- You want per-row validation and error reporting without writing it.

**Use a pipeline when:**

- Rows need transformation, matching, merging or lookups before they can be written.
- One file feeds several destinations, or the tree needs to branch.
- The target is not a record type any uploader covers.
- The data arrives over a transport and must be processed unattended.

**Or use both.** [TableUploaderStep](https://docs.kademi.co/ref/templating/md/TableUploaderStep.md)
runs incoming pipeline data through a saved uploader and a saved field mapping, so a scheduled SFTP
endpoint can reuse the uploader an administrator already configured and tested by hand:

```xml
<TransactionStep>
    <next class="TableUploader">
        <tableUploaderName>Profiles</tableUploaderName>
        <fieldMappingName>weekly-hr-feed</fieldMappingName>
    </next>
</TransactionStep>
```

Both names are looked up when the step runs, and either one missing fails the pipeline. The step
hands the resulting async job to `next`, so the pipeline finishes before the import does.
The API behind this is
[TableUploadManager](https://docs.kademi.co/ref/templating/md/TableUploadManager.md), and a saved
mapping is a [FieldMapping](https://docs.kademi.co/ref/templating/md/FieldMapping.md).

## Running something on a schedule

There is no cron expression anywhere in Kademi, and there are two separate scheduling mechanisms.
Pick by what has to run: **your app's own function, or an endpoint's pipeline.**

### A job in your own app: the `scheduler` binding

For recurring work that is not a file feed - a nightly reconciliation, a token refresh, a scan of
pending orders - an app schedules one of its own functions with
[JsScheduler](https://docs.kademi.co/ref/templating/md/JsScheduler.md), bound into the app's server
JavaScript as `scheduler`. No pipeline and no endpoint involved. Every night at 2am:

```js
// server JavaScript
function initMyApp() {
    if (formatter.isNull(scheduler.find("myapp-nightly"))) {
        scheduler.schedule("myapp-nightly", "runNightly", 1, "DAYS", "2:00 am");
    }
}

function runNightly() {   // called with no arguments, unless funcArgs was given
    // ...
}
```

Create the schedule from the app's init function, so it exists as soon as the app is turned on:

```xml
<controllers onAppEnabled="initMyApp" onAppUpdated="initMyApp">
```

- Units are `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `ANNUAL`. `MINUTES` has a floor of 30;
  anything smaller is treated as 30.
- The fifth argument is the time of day, `"2:00 am"` or `"02:00"`, read in the account's timezone.
  Without it the schedule fires relative to when it was created.
- Schedule names are unique per account and `schedule(...)` **throws if the name already exists**.
  To change the timing: `find(name)`, `deleteSchedule(id)`, then schedule again. That is why the
  init function above checks first, and why it is safe to re-run on every app update.
- A scheduled run has no request and no logged-in user. Pass a `runAs` profile to the seven-argument
  overload if the function needs one.
- Keep the function itself short. For real work, queue a job - `scheduler.executeAsyncTask(...)`,
  or a map-reduce job - and let the schedule just start it. See the `kademi-server-js` skill.
- `getSchedules()`, `getSchedule(id)`, `find(name)` and `clearSchedules()` manage the app's own
  schedules; they return
  [JsScheduleBean](https://docs.kademi.co/ref/templating/md/JsScheduleBean.md)s.

### A file feed: PipelineSchedule

A [PipelineSchedule](https://docs.kademi.co/ref/templating/md/PipelineSchedule.md) fires one
endpoint's pipeline on a recurring interval: every day, every three weeks, the first of the month,
every Monday. It is **bound to an endpoint** - it cannot run arbitrary code, only that endpoint's
pipeline. Add one in the Schedule step of the export or import wizard.

- Units are days, weeks, months and annual. **Hourly is not supported** and is rejected. If a
  pipeline genuinely has to run more often than daily, drive it from an app schedule on `HOURS`
  instead, or split the work out of the pipeline.
- The start date's **time of day** fixes the time of every later run, which is what stops runs
  drifting.
- Only schedules on the **live** branch of a website are picked up.
- A run happens as a chosen profile, and has no request and no logged-in user. Its permissions are
  that profile's permissions.

### A CRM sync job

CRM apps such as Dynamics 365 and Salesforce have their own **sync jobs**, which sync objects rather
than files: leads, contacts to profiles, and accounts to organisations, in either direction or both.
Extend one with a **sync job action provider** (`onLocalObjectUpdated`, `beforeRemoteObjectUpdated`,
`transformRemoteObject`) to move custom fields, or register a whole **sync provider** to integrate a
system that has no app yet.

Read [references/sync-jobs.md](references/sync-jobs.md) when you are configuring a CRM sync job or
writing a sync job action provider or sync provider - both, with code.

## Reporting outcomes

A run reports in four places. Know which one your users will actually look at.

**Messages on the run.** Any step, and any script, can record a coded message against the current
position in the data:

```js
pipeline.addInfo("MATCHED", "Matched existing profile " + userName);
pipeline.addWarning("NO-ORG", "Unknown dealer code " + code);
pipeline.addFailure("BAD-AMOUNT", "Amount is not a number: " + raw);
```

A failure is a definite problem needing resolution; a warning is something to review; info is
context. None of them stop the run by themselves. Whatever `pipeline.setCurrentPosition(...)` was
last set to is attached to each message, which is how a message ends up saying which sheet and row
it came from. **Throwing** from a script is what stops a run: it is recorded as a failure and rolls
the enclosing transaction back.

**The execution record.** When the endpoint has execution recording on, each run writes a
[PipelineExecution](https://docs.kademi.co/ref/templating/md/PipelineExecution.md) holding the
execution id, start and finish times, source, destination, output file and every message. These are
listed under **Data > Integration > Integration history**, with status, duration and a
**Re-process** action on each one. Execution records are also what makes duplicate prevention
possible: give the endpoint an `execIdTemplate` that identifies the *data* rather than the run, turn
on `preventDuplicates`, and the same file cannot be loaded twice.

**The result email.**
[ResultEmail](https://docs.kademi.co/ref/templating/md/ResultEmailPipelineStep.md) emails the
failures, warnings and infos to a list of recipients when the run finishes. Set
`onlySendOnFailure="true"` so a nightly feed stays silent until something breaks. This step is
terminal and does its work in the `finished` phase, so hang it off a `MultiStep` rather than
burying it mid-chain.

**The HTTP response.** An inbound HTTP POST gets a JSON result carrying success plus the failures,
warnings and infos, so the calling system can react without a human reading anything.

**And for anything asynchronous, the job.** `MapReduce`, `TableUploader` and `Reindex` with
`async="true"` all queue work that outlives the run. The run will be recorded as successful while
the job is still going, and a job failure never appears on the execution record. Report through the
job's own status and output, and watch it in the tasks view.
[PipelineProcessEvent](https://docs.kademi.co/ref/templating/md/PipelineProcessEvent.md) fires on
start, completion and failure if an app needs to react programmatically.

## Gotchas

- **Terminal steps.** `ResultEmail`, `runPointsAllocation`, `TemplateOutput` and the output steps do
  not forward to a `next`. Anything configured below them never runs. Fan out with `MultiStep`.
- **DecisionStep does not currently route.** It resolves its selector value but does not select a
  branch, so nothing downstream of it runs. Branch with a `JsRowStep` that calls `nextStep.exec`
  conditionally, or with `MultiStep`.
- **`RecordExecutionStep` does not enforce anything.** It is currently a pass-through: it holds an
  `execIdTemplate` and `preventDuplicates` but applies neither. Duplicate prevention is an
  **endpoint** setting - configure `execIdTemplate` and `preventDuplicates` there.
- **Attribute versus element.** Putting an element-valued property in an attribute silently drops
  it. Putting an attribute-valued property in an element fails the parse. Check the catalogue.
- **Positional arguments are fragile.** A new column in the source file shifts every `column="n"`
  index and every script argument. Prefer `columnName="C"` for spreadsheets people edit by hand.
- **[`WebServiceStep`](https://docs.kademi.co/ref/templating/md/WebServiceStep.md) is a placeholder** and does nothing. To call a remote service, use a
  `JsRowStep` and the `http` binding.
- **`jsText` on `JsRowStep` is not read.** Always use `jsPath`.
- **Publish the draft.** Endpoints and pipeline schedules only take effect on the live version of
  the website.

## Related skills

- `kademi-server-js` - the map and reduce functions, the `JsRowStep` script and scheduled functions
  are all server-side JavaScript; also background jobs with no pipeline.
- `kademi-api-reference` - confirming a step class, a manager or an entity method.
- `kademi-admin-ui` - a screen that triggers an import and shows its progress.
- `kademi-app-development` - project layout, the app's init function and publishing.
- `kademi-journeys` - reacting to imported data with an automation.
