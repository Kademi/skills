# Queries, search and reports

Four different things share the word "query" in Kademi. Pick the right one first.

| You want | Use |
|---|---|
| A saved search over a search index, shown in the query picker | `controllerMappings.addQuery(...)` |
| An extra field on a search index, computed at reindex time | `addAppIndexedField(...)`, from the account query repository |
| A tabular data source for reports and admin tables | `controllerMappings.addTableDef(...)` |
| An ad hoc database query from server JS | `services.criteriaBuilders` |
| A raw Elasticsearch query | `services.searchManager.search(...)` |

## Saved queries

Write the query definition as a JSON file in your app, then register it while the engine
initialises. The file name becomes the query's name in the picker.

```js
controllerMappings.addQuery(
    '/APP-INF/queries/registrationsOverTime.query.json',
    ['signuplog'],          // indexes this query may run against
    ['ReportsViewer']       // roles required to run it; null for no restriction
);
```

The file is read once at registration. A missing file logs a warning and registers nothing. See
[RepoAppQuery](https://docs.kademi.co/ref/templating/md/RepoAppQuery.md).

## Custom indexed fields

When a search index entry is rebuilt, you can run code to pull a value from anywhere else in the
account and store it on the entry. That turns a report that would need several lookups into a
single index query.

These are registered from the account's own query repository scripts, where the
[Queries](https://docs.kademi.co/ref/templating/md/Queries.md) object is bound as `queries` - not
from an app's `APP-INF`.

```js
queries.addAppIndexedField(
    'learning',                        // the app indexer to add the field to
    'mostRecentCertificationDate',     // field name
    'keyword',                         // mapping type
    false,                             // notAnalyzed
    'generateCurrentCertificationDate' // function that computes the value
);

function generateCurrentCertificationDate(contentItem, updatedObject) {
    var row = services.criteriaBuilders.get('learningLog')
        .eq('profile', updatedObject.profile)
        .eq('action', 'c')
        .eq('moduleStatusId', formatter.toLong(updatedObject.id))
        .sortDesc('id')
        .executeSingle();

    return formatter.isNotNull(row) ? row.reqDate : null;
}
```

The function returns the value to store, or null. The field is then available to any report or
query against that index. See
[AppIndexerField](https://docs.kademi.co/ref/templating/md/AppIndexerField.md) and
<https://docs.kademi.co/blogs/docs-kb/creating-custom-indexed-fields-on-the-search-index/>.

An app that owns its own search index registers the indexer itself, with
`controllerMappings.appIndexersFunction(fn)`, and its Elasticsearch mappings with
`controllerMappings.esMappingsController()`.

## Query tables

A query table is rows produced by code you write, registered under an id, and consumed by anything
in the account that shows a table: the `queryTable` page component, a report, an admin table view
and the CSV exporter. It has no aggregations, so it can never feed a pie chart, a date histogram or
a single value. If the answer is a number or a breakdown rather than rows, build an index query
instead.

### The two registration paths are not the same API

Both produce a table that behaves identically once registered. They are reached through different
globals, and **their loader functions take different arguments in a different order**. Nothing
anywhere warns you.

In an app, a lib or a website, the global is `controllerMappings`:

```js
controllerMappings.addTableDef('overdueClaims', 'Overdue claims', 'loadOverdueClaims')
    .addHeader('Partner')
    .addHeader('Claim')
    .addHeader('Days overdue');

function loadOverdueClaims(start, maxRows, rowsResult, rootFolder, status, params) {
}
```

In the account's `queries` repository the global is `queries`, and there is no `start` and no
`maxRows` at all:

```js
queries.addTableDef('overdueClaims', 'Overdue claims', 'loadOverdueClaims')
    .addHeader('Partner')
    .addHeader('Claim')
    .addHeader('Days overdue');

function loadOverdueClaims(rowsResult, rootFolder, status, params) {
}
```

Read that pair again before you write either one. Copying an app's loader into the `queries`
repository leaves `rowsResult` bound to the number `0`, and the failure that follows names a
property of a number rather than anything about tables. It is the single likeliest cause of the
difficulty developers report with this feature. Check which repository you are in first: the one
named `queries` is the second form, everything else is the first. See
[surfaces.md](surfaces.md) for the rest of what is different about that repository.

`addTableDef` registers only while the app is initialising. Called lazily from inside a function it
hands back a definition that was never registered, with no error anywhere. Register at the top level
of a source file, next to the function it names.

### Filling in the rows

`rowsResult` is a [RowsResult](https://docs.kademi.co/ref/templating/md/RowsResult.md), and its
contract has one shape that trips people up:

| Call | Does |
|---|---|
| `addCell(value)` | Appends a cell, **starting a row** if none is in progress |
| `addRow()` | Commits the row in progress and starts a new one |
| `flush()` | Commits the row in progress and starts nothing |

`addRow()`, then cells, then `flush()` on each iteration is the readable style and it is safe: it
does not produce empty rows, because `flush()` clears the row in progress and `addRow()` only
commits when there is one. The hazard is the opposite - a bare `addRow()` with nothing after it. A
trailing `addRow()` at the end of a loop leaves an empty row in progress and the platform commits
it. No trailing `flush()` is needed either; the platform flushes when your loader returns.

- **`setNumRows(total)` is what the pager and every "N results" count read.** Without it the total
  is whatever this page happened to hold, so a paged table reports its page size as its size. Set it
  from the count the query gives you, before you start adding rows. `rowsResult.numRows = total`
  does the same thing.
- Nothing checks a row has as many cells as there are headers. A row with too few or too many is
  accepted, the table renders, and the CSV export is silently shifted a column across.
- An empty or null cell value is stored as an empty string, so you do not have to guard for it.

### A loader that throws comes back as data, not as an error

Both paths catch `Throwable` around your function and return a result whose cells hold the exception
text. Nothing raises and nothing turns red: the app loads, the report renders, and the failure
arrives as the contents of the table.

So an app that initialises cleanly says nothing about whether its query tables work - the loader has
not run yet, and will not until somebody asks for rows. Run the table. The real stack trace, with
the file and the line, is in the account log under `Exception running QueryTable`.

### Parameters

The loader receives a `params` map, and the same values are reachable through a form context:

```js
var fc = formatter.newFormContext();
var partnerId = fc.longParam('partnerId');
var search = fc.cleanedParam('q');
```

`cleanedParam` is the one to use for anything that reaches a query. Treat every parameter as
optional and default it: the same table is called from a page component, from a report and from the
exporter, and they do not all pass the same things. See
[FormContext](https://docs.kademi.co/ref/templating/md/FormContext.md).

### Paging

An app or website table is handed `start` and `maxRows` and is expected to honour them, and to set
the true total with `setNumRows` so the pager knows there is more.

A `queries` repository table is not handed those arguments. It reads them off the result instead -
`rowsResult.getStart()` and `rowsResult.getMaxRows()` carry what the consumer asked for.

A table that cannot page, because it aggregates or pivots or has to see every row to produce any,
should say so rather than quietly ignoring the arguments. Both paths default to `true` and both take
the setter:

```js
controllerMappings.addTableDef(...).supportsPagination(false);
queries.addTableDef(...).supportsPagination(false);
```

Know what `false` costs before reaching for it. It does not merely hide the pager: the table's own
admin page stops rendering rows entirely and shows "This table doesnt support online viewing. Click
the export link above". For an export-only table that is the point. For an aggregating table you
still want to look at, it takes away the quickest way to see whether the loader works.

### Columns that depend on the account

Where the columns are not known until runtime - one per configured level, one per custom field - the
four-argument overload takes the name of a function that appends to the header list:

```js
controllerMappings.addTableDef('levelsMatrix', 'Levels matrix', 'loadLevelsMatrix', 'levelsMatrixHeaders');

function levelsMatrixHeaders(headers) {
    formatter.foreach(services.recognitionManager.levels, function (level) {
        headers.add(level.title);
    });
}
```

Two things to know. The `queries` repository has no equivalent; only the three-argument form exists
there. And the headers carried on the result the loader fills in are the **statically declared ones
only**, so a consumer reading headers off the result sees fewer columns than the rows have. Ask the
table for its headers instead. See
[RepoQueryTableDef](https://docs.kademi.co/ref/templating/md/RepoQueryTableDef.md).

### The join shape that decides whether it finishes

Most real query tables are a join, and the difference between one that returns and one that times
out is entirely in how the join is done:

1. Get the key set in **one** query - an aggregation, a `groupBy`, or a search - not a query per row.
2. Split it into batches and do **one lookup per batch**. `formatter.splitList(list, 50)` is the
   idiom, and the managers have batch methods built for exactly this.
3. Filter and shape in memory from what came back.

Reaching into a manager inside the row loop is the mistake, and it does not look like one: it works
on your own account with forty rows and takes minutes on the client's with forty thousand. If you
are unsure which side of that line a loader is on, run it under a debug session and read the SQL
section - a statement with a very high count is a query inside a loop.

When you search an index directly, two things are not optional. Put the query through
`preProcessQuery2` so the account's own parameters and organisation scoping are applied, then stream
the hits rather than materialising them:

```js
var queryStr = services.queryManager.preProcessQuery2(JSON.stringify(query));
var resp = services.searchManager.search(queryStr, pageSize, 'profile');

var cnt = 0;
resp.useHits(function (hit) {
    if (cnt++ >= start) {
        rowsResult.addRow();
        rowsResult.addCell(hit.source.userName);
        rowsResult.flush();
    }
    if (maxRows !== null && rowsResult.rows.size() >= maxRows) {
        resp.breakUseHits();
    }
}, null);
```

`breakUseHits` is how you stop early; without it a table asked for ten rows still walks every hit
the query matched.

**That search call has three arguments, and the middle one is why `useHits` works.** Two search
idioms are in circulation and they do not mix:

| Call | For | Read |
|---|---|---|
| `search(queryStr, indexName)` | aggregations | `resp.aggregations` |
| `search(queryStr, pageSize, indexName)` | hits | `resp.useHits(fn, null)` |

`useHits` throws on a response from the two-argument overload: with no page size there is no scroll
context to page through. The check is on the page size alone and never on how many hits matched, so
the call either always works or always fails, rather than passing on a small account and failing on
a large one. Crossing the two is easy to do, because the aggregation form is what most existing code
uses - and the crossed version loads fine and fails only through the swallowed-exception path above,
as cell text. Before you finish a loader that iterates hits, check the search call has a page size
in it.

If instead you page by putting `from` and `size` in the query body, you have already asked for
exactly the rows you want: read `resp.hits.hits` directly and leave `useHits` out of it. `from` is
rejected outright in a scrolled search. See
[SearchManager](https://docs.kademi.co/ref/templating/md/SearchManager.md) and
[QueryManager](https://docs.kademi.co/ref/templating/md/QueryManager.md).

### Consuming a table, and checking it works

On a page, as a component. `data-query` is the id you registered and `data-query-type` says which
kind of thing that id names:

```html
<section data-type="component-queryTable" data-query-type="queryTable" data-query="overdueClaims"
         data-title="Overdue claims" data-items-per-page="100"></section>
```

In an admin template, read the table directly:

```velocity
#set( $queryTable = $services.queryManager.getTable("overdueClaims") )
#set( $resp = $queryTable.getRows($startPos, $pageSize) )
#set( $paginator = $formatter.paginator().pageSize($pageSize).totalRecords($resp.numRows).start($startPos) )
#set( $records = $paginator.records($resp.rows) )
```

`getTable` returns null for an id that is not registered, so a typo is a blank area on the page
rather than an error. Guard it with `$formatter.isNull`.

Every account has an admin page per query table at `/queries/<tableId>/` on the admin domain; the
queries page it belongs to is linked from the index queries page under **Data & reports** rather than
listed in the menu. It runs the table, renders the rows and offers the CSV
(`?as=csv&startAsync=true`). That is how you and the administrator see what the table actually
returns, and it is the answer to "how do I know this works" - a query table you have written and not
run is a query table you have not checked. A loader that threw shows up there as a small table whose
cells are the exception text.

### Joining two tables

`controllerMappings.joinTableBuilder()` combines two already-registered tables on a matching key
column, then `addJoinTable(builder)` registers the result as a table in its own right:

```js
const jt = controllerMappings.joinTableBuilder()
    .id('ordersWithDealers')
    .description('Orders joined to their dealer organisation');
// configure leftTable(), rightTable() and addField() on the builder
controllerMappings.addJoinTable(jt);
```

Use it instead of doing the join inside a row function when both sides are already tables an
administrator can pick - the joined table then shows up as a data source everywhere the originals
do. See [JoinTableBuilder](https://docs.kademi.co/ref/templating/md/JoinTableBuilder.md).

### Turning a table into a report

```js
controllerMappings.addQueryTableReport(
    'dealerOrders',                       // report id
    'Dealer orders',                      // title
    'All orders grouped by dealer',       // description
    '/theme/apps/myapp/dealerOrders.html',// template that renders it
    'ordersWithDealers',                  // id of the query table supplying rows
    null, null                            // content type + extension, or null for on-screen
);
```

Pass a content type and extension to make it a downloadable attachment instead of an on-screen
report. This is the cheapest route to a custom report when the rows already come from a table -
no report function to write.

## Metric types

A metric is a single number an app contributes to reporting and dashboards - "total order value",
"courses completed". Register one with `controllerMappings.newMetricTypeBuilder()`:

```js
controllerMappings.newMetricTypeBuilder()
    .id('sum-of-orders')
    .title('Total order value')
    .description('Calculates the total value of orders')
    .fields(null)
    .applicableEntities(null)
    .calcFn('calcTotalOrderValue')
    .build();
```

`calcFn` names the function that computes the value. `applicableToOrg()` and `applicableToProfile()`
restrict which entity a metric can be measured against, and `additive(true)` declares that the
metric can be summed across entities - get that wrong and a rolled-up dashboard figure is
meaningless. See
[JsMetricTypeBuilder](https://docs.kademi.co/ref/templating/md/JsMetricTypeBuilder.md).

## Table uploader actions

When an administrator uploads a spreadsheet, a **table action handler** is what does something with
the rows. Register one with `controllerMappings.newTableActionHandlerBuilder()` and implement only
the lifecycle hooks you need:

| Hook | Called |
|---|---|
| `transformFileFn` | Once, on the whole uploaded file, before any row is read |
| `transformRowFn` | Per row, to reshape it |
| `validateRowFn` | Per row, to accept or reject it |
| `processRowFn` | Per row, to do the work |
| `afterRowFn` | Per row, after processing |
| `afterFileFn` | Once, when every row is done |

```js
controllerMappings.newTableActionHandlerBuilder()
    .id('importDealerTargets')
    .title('Import dealer targets')
    .description('Sets the annual target on each dealer organisation')
    .validateRowFn('validateTargetRow')
    .processRowFn('processTargetRow')
    .afterFileFn('afterTargetFile')
    .build();
```

Validate in `validateRowFn` and do the work in `processRowFn` - rejecting a row in the validate hook
reports it to the administrator against that row, which a throw from `processRowFn` does not. See
[JsTableActionHandlerBuilder](https://docs.kademi.co/ref/templating/md/JsTableActionHandlerBuilder.md),
and [kademi-integrations](../../kademi-integrations/SKILL.md) for the pipeline route to the same
job.

`indexQueryActionTypeBuilder` is a deprecated no-op; use the implementation builder instead.

## Criteria queries

`services.criteriaBuilders` is a registry of per-entity builders, scoped automatically to the
current admin organisation, so you do not construct Hibernate criteria or handle scoping yourself.

```js
const recent = services.criteriaBuilders.get('product')
    .eq('supplier', supplierOrg)
    .sortDesc('createdDate')
    .execute(50);

const total = services.criteriaBuilders.profile
    .eq('enabled', true)
    .rowCount('num')
    .executeSingle();
```

Look up an entity's builder by name with `.get(name)`, or use the `profile`, `points` and
`pointsDebit` shortcut properties. Restrictions, joins, projections (`count`, `sum`, `avg`,
`groupBy`) and paging are all on the returned criteria. See
[KCriteriaBuilders](https://docs.kademi.co/ref/templating/md/KCriteriaBuilders.md),
[KCriteriaBuilder](https://docs.kademi.co/ref/templating/md/KCriteriaBuilder.md) and
[KCriteria](https://docs.kademi.co/ref/templating/md/KCriteria.md).

`executeSingle()` returns one row or null, `execute(maxSize)` returns a list. Always null-check.

## Raw search

```js
const json = JSON.stringify({ query: { match: { accountNumber: 20 } } });
const response = services.searchManager.search(json, ['profile']);
```

[SearchManager](https://docs.kademi.co/ref/templating/md/SearchManager.md) also covers index
metadata, reindexing and discrepancy checks. Build request bodies with
[MapBuilder](https://docs.kademi.co/ref/templating/md/MapBuilder.md) and
[ArrayBuilder](https://docs.kademi.co/ref/templating/md/ArrayBuilder.md) if you would rather not
assemble nested JSON by hand. Never return a raw search response from a JS service.

## Reports and CSV

Four routes to a custom report, cheapest first
(<https://docs.kademi.co/blogs/docs-kb/custom-reports/>):

1. **A CSV template.** Put a placeholder file named `report1.dyn.csv` in your website repository
   whose single line is the path of a plain-text template, for example
   `/theme/reports/report1.vel`. The template emits comma-separated rows. No JS at all.
2. **Customise an existing report.** Some built-in reports let you choose and reorder the exported
   fields as expressions, from Add custom report in the admin console.
3. **A custom app route.** One controller for the admin screen and one for the CSV, both filling
   `page.attributes` from a shared loader function.
4. **The integration framework**, when the output has to be a real spreadsheet.

For option 3, generate rows in JS and render them with a text template:

```js
controllerMappings.adminController().path('/my-report/')
    .addMethod('GET', 'showReport').enabled(true).build();

controllerMappings.adminController().path('/my-report/data.csv')
    .addMethod('GET', 'reportCsv').enabled(true).build();

globalThis.reportCsv = (page, params) => {
    const rows = [['Name', 'Total'], ...loadRows().map((r) => [r.name, r.total])];
    page.attributes.csvValues = rows;
    return views.textTemplateView('/theme/apps/myapp/csv.html', 'text/csv');
};
```

```velocity
#foreach( $values in $page.attributes.csvValues )
$formatter.toCsv($values)
#end
```

`views.csvView(rows)` returns a CSV response directly when you do not need a template. Under
Nashorn build the row lists with `formatter.newArrayList()`.
