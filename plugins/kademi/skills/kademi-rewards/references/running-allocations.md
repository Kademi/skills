# Running, debugging and undoing allocations

## Running allocations

`services.dataSeriesManager`
([DataSeriesManager](https://docs.kademi.co/ref/templating/md/DataSeriesManager.md)) is the whole
surface:

```js
// test one record against one source, without persisting anything
var logs = formatter.newArrayList();
var points = services.dataSeriesManager.testPointsAllocation(pas, record, logs);

// which sources would pick this record up
var sources = services.dataSeriesManager.findMatchingSources(series, record);

// process a whole series
services.dataSeriesManager.processPointsAllocation(series, function (msg) {
    log.info('allocation progress: {}', msg);
});
```

`testPointsAllocation(pas, record, logs)` is the debugging tool: it runs the rule and fills `logs`
with what happened, without awarding anything. Reach for it before adding log lines to the rule.

In a pipeline, the `runPointsAllocation` step runs the configured sources for a series once the
pipeline finishes - see
[kademi-integrations/references/pipeline-steps.md](../../kademi-integrations/references/pipeline-steps.md).
That is the normal way a nightly sales import ends up awarding points.

### Undoing

`resetPointsAllocations(record, deleteSale, resetPointsBalance)` and its overloads reverse an
allocation. Points already spent are the complication: the four-argument overload takes
`createDebitForUsedPoints` to decide whether to raise a debit rather than silently leaving a
negative balance. Always run a reset inside a transaction opened by the controller.

## When points are not awarded

In order, because each step rules out the next:

1. Is the record actually in the series, and unprocessed?
   `services.dataSeriesManager.countUnprocessedSalesRecs()`.
2. Does any source match it? `findMatchingSources(series, record)`. If none, the PAS filter or the
   rule's `includeFn` is excluding it.
3. What does the rule return? `testPointsAllocation(pas, record, logs)` and read `logs`.
4. Did it error? `countPointsAllocationsWithErrors()` and
   `findPointsAllocationsWithErrors(searchProperties)`.
5. Is there a recipient? A record whose `salesBy` entity has no membership in the reward's
   participant group awards nothing.
6. Soft-deleted sources still exist in the database. Anything reading sources directly must skip
   rows with a `deletedDate`.

