# Map-reduce: processing large datasets

**Use [MapReduceStep](https://docs.kademi.co/ref/templating/md/MapReduceStep.md). Do not write your
own batching.**

Every hand-rolled version of this ends the same way: a loop in a script, a request that times out
at row 40,000, a transaction that holds locks for six minutes, and no way to tell which rows were
written before it died. The platform already has the batching, the queue, the parallelism, the
retry behaviour and the progress reporting. Use it.

## What the step actually does

`MapReduce` is not a step that processes data. It is a step that **queues a job** and gets out of
the way.

1. It takes its input, which is either a table hash string (normally produced by a
   `PersistAsTable` step) or an `InputStream` of CSV or Excel. A stream is saved as a table first,
   and for Excel only the first worksheet is read.
2. It puts a job on the asynchronous job queue, carrying a small map of parameters: `fileHash`,
   `fileName`, `pipelinePath`, `sourceAddress`, `destinationAddress`, `executionRecordId` and the
   endpoint mapping.
3. It records an info message on the pipeline naming the job id, with a link to the job details.
4. It passes its incoming arguments through to `next`, unchanged, **immediately**. `next` runs when
   the job is queued, not when the work is done.
5. The pipeline run then finishes and is recorded as successful, while the job is still running.

The job itself is where the work happens:

- The **map function** runs once, on the root job. Its purpose is to decide how the work should be
  split, and to add one sub-task per batch. It should do no real work itself.
- Each sub-task becomes its own job, with the root as its parent, and runs the **reduce function**
  with that sub-task's properties. Sub-tasks run in parallel on the shared worker pool.
- Once every sub-task has completed, the reduce function runs once more on the root job, this time
  with no sub-task properties. That final call is where you write a summary.

Only one level of splitting is supported. A sub-task cannot itself map into more sub-tasks.

## Where the functions live

`mapFn` and `reduceFn` name global functions in the **server-side JavaScript of the website the
endpoint belongs to**, that is, functions your installed apps define there. They are not looked up
in the file a [`JsRowStep`](https://docs.kademi.co/ref/templating/md/JsRowStep.md) names with `jsPath`, and the two runtimes are separate: a map or reduce
function has no `pipeline`, no `rowWriter` and no `nextStep`. It runs later, in a background job,
long after the pipeline finished.

## Function signatures

```js
// mapFn
function myMap(job, props, params, subTaskList, jobContext) { }

// reduceFn
function myReduce(job, props, params, jobContext) { }
```

| Argument | Meaning |
|---|---|
| `job` | The [AsyncJob](https://docs.kademi.co/ref/templating/md/AsyncJob.md) being run |
| `props` | For a sub-task, the properties that sub-task was created with. Empty or null on the root call |
| `params` | The parameters the job was created with. From a pipeline this is `fileHash` and friends |
| `subTaskList` | A [SubTaskList](https://docs.kademi.co/ref/templating/md/SubTaskList.md) to add batches to. Map only |
| `jobContext` | A [JobContext](https://docs.kademi.co/ref/templating/md/JobContext.md) for cancellation checks and status reporting |

Adding batches, via [SubTaskList](https://docs.kademi.co/ref/templating/md/SubTaskList.md):

| Call | Use it for |
|---|---|
| `addIdsListTask(title, ids)` | An explicit list of ids. Arrives in the sub-task as `props.get("listOfIds")` |
| `addRangeTask(title, start, finish)` | A numeric range, for example rows 0 to 999. Arrives as `props.get("start")` and `props.get("finish")` |
| `addSinglePropertyTask(title, name, value)` | One named value, your choice of name |
| `addTask(title, props)` | An arbitrary map of properties |
| `size()` | How many batches have been added so far |

Each batch is described by a [MapReduceSubTask](https://docs.kademi.co/ref/templating/md/MapReduceSubTask.md).
Its properties must be **serializable**: ids, numbers, strings, lists of those. Never put a profile,
an organisation or any other entity in a sub-task's properties. Put the id, and load it again in
the reduce.

Returning a string from a reduce call stores it as the job's output, which is visible on the job.

## When you need it, and when you do not

A plain pipeline is one thread, one pass, usually one transaction, and when it was triggered over
HTTP it is also bounded by the request. That is fine for a lot of real feeds.

| Situation | Answer |
|---|---|
| A few thousand rows, seconds to run | Plain pipeline. Nothing to gain here |
| A nightly file of tens of thousands of rows | Map-reduce |
| Per-row work that calls a remote service | Map-reduce, so slow rows run in parallel and a failure retries a batch, not the file |
| The run must be atomic: all rows or none | Plain pipeline under a [`TransactionStep`](https://docs.kademi.co/ref/templating/md/TransactionStep.md). Map-reduce cannot give you this |
| The caller needs the result in the HTTP response | Plain pipeline. A map-reduce job outlives the response |
| Rewriting or recalculating every profile, order or record in the account | Map-reduce, driven from ids rather than from a file |
| It works today but is getting slower every month | Move to map-reduce before it starts timing out |

## Batch sizing

Aim for **tens to low hundreds of batches**, each covering hundreds to a couple of thousand rows.

- Too few batches, for example four batches of 50,000, and you have not gained much: each one is
  still a long single-threaded transaction that can fail near the end.
- Too many batches, for example 10,000 batches of five rows, and the scheduling overhead dominates.
  Every sub-task is a queued job with its own record and its own transaction.
- 500 to 1000 items per batch is a good default. Start there and adjust on measured runtime.
- Jobs with more than ten sub-tasks are flagged for monitoring, which is normal and expected. It is
  worth knowing that a run producing thousands of sub-tasks is visible as an outlier.

Sub-task priority is derived from the parent's priority and the number of batches, so a single very
large job does not starve everything else in the queue.

## Parallelism

Sub-tasks run on a shared worker pool, with a cap on how many jobs one account may run
concurrently. You do not choose the thread count, and you should not assume any particular degree
of parallelism. Write each batch so it is correct whether it runs alone or alongside fifty others.

In practice that means: no shared mutable state between batches, no assumption about ordering, and
no batch that depends on another batch having already run.

## Transaction boundaries

Each sub-task runs in **its own transaction**. Nothing spans batches.

- A failure inside a batch rolls back that batch only. The batches that already committed stay
  committed.
- The root job's final reduce call is a separate transaction again, after everything else.
- There is no all-or-nothing across the whole dataset. If you need that, you need a plain pipeline
  under a `TransactionStep`, and you need the dataset to be small enough to justify it.

## Idempotency: batches can run twice

Treat every batch as something that may be retried.

- A job that is restarted after already creating its sub-tasks exits without mapping again, so the
  split itself will not be duplicated. Individual sub-tasks are a different matter.
- Write with upserts keyed on something in the source data, not with blind inserts.
- Never derive a value by incrementing what is already stored: `points = points + 10` is wrong if
  the batch runs twice. Set the value, or key the award to a source record id so a repeat is a
  no-op.
- Make the map function deterministic. Given the same input it should produce the same batches.
- Do not rely on the reduce of one batch seeing the writes of another.

## Cancellation

Long batches must check for cancellation, otherwise a cancelled job keeps burning through work:

```js
function checkCancelled(name, jobContext) {
    if (formatter.isNotEmpty(jobContext) && jobContext.cancelled) {
        log.error("{} : job is cancelled", name);
        throw new Error("Cancelled");
    }
}
```

Call it inside your per-item loop. `jobContext.setStatus("...")` reports live progress back to the
job so an administrator watching it can see movement.

## How failures surface

Map-reduce failures do **not** appear on the pipeline execution record, because the pipeline
finished long before the job did. Two separate places to look:

- **The pipeline run**, in Data > Integration > Integration history, tells you the job was queued.
  The info message `MAPRED-STARTED-JOB` carries the job id and a link to it. If input was missing
  or of an unusable type you instead get a failure recorded on the run itself
  (`MAPRED-NO_DATA`, `MAPRED-INCOMPATIBLE_DATA`), and no job at all.
- **The job**, under the tasks view the link points at, is where progress, per-sub-task state,
  warnings and any exception live.

Design accordingly: put anything an operator must be told into the job's own output and status,
and do not expect a `ResultEmail` step in the pipeline to say anything useful about work that had
not started yet when the email was built.

## Worked example: a nightly file of order lines

Pipeline: save the uploaded file as a table, then queue the job.

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

[`CsvInput`](https://docs.kademi.co/ref/templating/md/CsvInput.md) with `passAsList` is required here: `PersistAsTable` takes a list of rows or a stream,
not one row at a time.

The map and reduce functions, in the website's server JavaScript:

```js
var BATCH_SIZE = 500;

function mapOrderImport(job, props, params, subTaskList, jobContext) {
    // Only split on the root call.
    if (formatter.isNotEmpty(props)) {
        return;
    }

    var fileHash = params.get("fileHash");
    var rowCount = countRowsFor(fileHash);   // your own helper

    var batch = 0;
    for (var start = 0; start < rowCount; start += BATCH_SIZE) {
        checkCancelled("mapOrderImport", jobContext);
        var finish = Math.min(start + BATCH_SIZE, rowCount) - 1;
        var task = formatter.newMap();
        task.put("fileHash", fileHash);
        task.put("start", start);
        task.put("finish", finish);
        subTaskList.addTask("Rows " + start + " to " + finish, task);
        batch++;
    }

    log.info("mapOrderImport: split {} rows into {} batches", rowCount, batch);
}

function reduceOrderImport(job, props, params, jobContext) {
    if (formatter.isEmpty(props)) {
        // Root call, after every batch has finished.
        log.info("reduceOrderImport: all batches complete");
        return "Order import complete";
    }

    var start = props.get("start");
    var finish = props.get("finish");
    jobContext.setStatus("Importing rows " + start + " to " + finish);

    var rows = loadRowsFor(props.get("fileHash"), start, finish);  // your own helper
    formatter.foreach(rows, function (row) {
        checkCancelled("reduceOrderImport", jobContext);
        upsertOrderLine(row);            // an upsert, so a retry is harmless
    });

    return null;
}
```

The same shape works without a file at all, driven by ids. That is the usual form for a
recalculation across the whole account:

```js
function mapRecalc(job, props, params, subTaskList, jobContext) {
    if (formatter.isNotEmpty(props)) {
        return;
    }
    var um = services.userManager;
    var pmr = um.newProfileMatchRequest();
    pmr.enabled(true);
    var profiles = um.findMatchingProfiles(pmr);

    var n = 0;
    formatter.foreach(formatter.splitList(profiles, 500), function (batch) {
        checkCancelled("mapRecalc", jobContext);
        var ids = formatter.newArrayList();
        formatter.foreach(batch, function (p) {
            ids.add(p.id);
        });
        subTaskList.addIdsListTask("Batch " + (n++), ids);
    });
}

function reduceRecalc(job, props, params, jobContext) {
    if (formatter.isEmpty(props)) {
        return "Recalculation complete";
    }
    var um = services.userManager;
    var pmr = um.newProfileMatchRequest();
    pmr.userIds(props.get("listOfIds"));
    formatter.foreach(um.findMatchingProfiles(pmr), function (p) {
        checkCancelled("reduceRecalc", jobContext);
        recalcFor(p);
    });
    return null;
}
```

Note what the map collects: **ids**, not entities. It loads a list to split it, then throws the
objects away.

## Starting a map-reduce job without a pipeline

You do not need an endpoint to use map-reduce. From an app's server JavaScript, submit the job
directly with [AsyncJobManager](https://docs.kademi.co/ref/templating/md/AsyncJobManager.md):

```js
var taskParams = formatter.newMap();
taskParams.put("sourceGroupId", sourceGroup.id);

var job = services.asyncJobManager.newMapReduceTask(
    "my-app",                    // the app submitting the job
    "mapRecalc",                 // map function name
    "reduceRecalc",              // reduce function name
    taskParams,                  // parameters, serializable values only
    controllerMappings.hash,     // the app build the functions run in
    null,                        // run by: defaults to the current user
    null);                       // run as: defaults to the current user

return views.jsonResult(true, "Job started", job.taskName);
```

Same map and reduce contract, same batching rules, same idempotency requirements. Use this for
admin actions ("recalculate all", "copy these members", "reindex this set") and use the pipeline
step when the work is driven by an inbound file.

## What not to do

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| A loop in a `JsRowStep` that walks the whole dataset | One thread, one transaction, and a request timeout waiting to happen | `MapReduce` |
| Your own chunking, with a cursor stored in an attribute | You have rebuilt the queue, badly, without retries or visibility | `SubTaskList` |
| Loading every entity in the map function | Memory, and none of it survives to the reduce anyway | Load ids, batch the ids |
| An unbounded query with no paging | Fine on the test account, fatal on the biggest one | Page by id range or id list |
| A transaction per row | Commit overhead per row, and no useful rollback unit | One transaction per batch, which you get for free |
| Entities in sub-task properties | Properties must be serializable, and a stale entity is worse than no entity | Ids, re-loaded in the reduce |
| Blind inserts, or `x = x + n` updates | A retried batch double-writes | Upserts keyed on source data |
| Batches that must run in order | Sub-tasks run in parallel, in no guaranteed order | Make each batch independent, and do ordering-sensitive work in the final root reduce |
| Waiting for the job in the pipeline | The step returns as soon as the job is queued | Report through the job, not the pipeline run |
