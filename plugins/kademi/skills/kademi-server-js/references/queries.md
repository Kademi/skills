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

`controllerMappings.addTableDef(id, description, rowFunctionName)` registers a JS-backed table
that reports and admin table views can select as a data source. Chain `addHeader` on the returned
[RepoQueryTableDef](https://docs.kademi.co/ref/templating/md/RepoQueryTableDef.md) to declare the
columns, or use the four-argument overload
`addTableDef(id, desc, rowFn, headersFn)` to supply the headings from a second function when the
columns depend on account configuration.

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
   fields as expressions, from Add custom report in the admin UI.
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
