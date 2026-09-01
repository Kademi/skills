# Pipeline step catalogue

Every step a pipeline can contain, grouped by the job it does. Each entry gives the XML element
name, what the step consumes, what it emits, and its configuration.

## How steps are written in XML

A pipeline definition is one XML document. The root element is the head step. Every step is
named by its XML element name, which is **not always the class name** (see the table below).

Four shapes appear:

```xml
<!-- 1. A single child step: the "next" element with a class attribute -->
<TransactionStep>
    <next class="CsvInput">
        ...
    </next>
</TransactionStep>

<!-- 2. A list of child steps: a named list element, children named by element name -->
<MultiStep>
    <nextSteps>
        <CsvOutput/>
        <ResultEmail>...</ResultEmail>
    </nextSteps>
</MultiStep>

<!-- 3. A map of child steps, keyed by string -->
<DecisionStep selectorColumn="0">
    <nextSteps>
        <entry>
            <string>P</string>
            <DatabaseUpdateStep providerId="products" mode="updateOrInsert"/>
        </entry>
    </nextSteps>
</DecisionStep>

<!-- 4. Column mappings: repeated <column> elements, all attributes -->
<SalesDataInserter>
    <seriesName>car-sales</seriesName>
    <column field="amount" column="10"/>
    <column field="attributedTo" column="6"/>
</SalesDataInserter>
```

Some properties are XML **attributes**, others are **child elements**. This is fixed per property
and getting it wrong silently drops the value (attributes) or fails the parse (elements). The
tables below mark each one `attr` or `elem`. Lists of plain values are child elements containing
typed items, for example:

```xml
<columnNames>
    <string>Email</string>
    <string>Points</string>
</columnNames>
<columnWidths>
    <int>10</int>
    <int>25</int>
</columnWidths>
```

The safest way to author a pipeline is the admin UI (Data > Integration > Endpoints, then the
Pipeline tab): it renders a form per step and writes the XML for you. Steps with no dedicated form
fall back to the raw XML editor, which is also reachable from Edit Pipeline XML file.

### Element name vs class name

| XML element | Class |
|---|---|
| `MapReduce` | [MapReduceStep](https://docs.kademi.co/ref/templating/md/MapReduceStep.md) |
| `PersistAsTable` | [PersistAsTableStep](https://docs.kademi.co/ref/templating/md/PersistAsTableStep.md) |
| `QueryExport` | [QueryExportStep](https://docs.kademi.co/ref/templating/md/QueryExportStep.md) |
| `Reindex` | [ReIndexPipelineStep](https://docs.kademi.co/ref/templating/md/ReIndexPipelineStep.md) |
| `ResultEmail` | [ResultEmailPipelineStep](https://docs.kademi.co/ref/templating/md/ResultEmailPipelineStep.md) |
| `runPointsAllocation` | [RunPointsAllocationSourcesPipelineStep](https://docs.kademi.co/ref/templating/md/RunPointsAllocationSourcesPipelineStep.md) |
| `TableUploader` | [TableUploaderStep](https://docs.kademi.co/ref/templating/md/TableUploaderStep.md) |
| `VelocityOutput` | [VelocityOutputStep](https://docs.kademi.co/ref/templating/md/VelocityOutputStep.md) |
| `column` | [Column](https://docs.kademi.co/ref/templating/md/Column.md) |

Every other step uses its class name as the element name.

### The three lifecycle calls

Each step gets `prepare` once before any data, `exec` once per unit of data, and `finished` once at
the end. A step that has a `next` normally forwards all three. Steps that do not forward are
terminal, and anything configured after them never runs. This is called out per step below.

---

## Input steps

An input step is the root of the tree. It receives whatever the trigger supplied (an `InputStream`
for an uploaded or fetched file, nothing at all for an export) and turns it into rows.

### CsvInput

[Reference](https://docs.kademi.co/ref/templating/md/CsvInput.md)

- **Consumes** an `InputStream` of CSV as its first argument.
- **Emits** one call to `next` per data row, with one string argument per column. With
  `passAsList` it emits a single call carrying a list of rows.

| Property | Kind | Notes |
|---|---|---|
| `startRow` | attr | Zero-indexed count of leading rows to skip. Use `1` to skip a header. |
| `maxRows` | attr | Stop after this many data rows. |
| `separator`, `quoteChar`, `escapeChar` | attr | Single characters. An empty `quoteChar` disables quoting. |
| `charsetName` | attr | For example `UTF-8`. |
| `skipIfBlankColumns` | elem | List of `<int>` column indexes; a row blank in any of them is skipped and logged as info. |
| `passAsList` | attr | Pass all rows at once instead of row by row. |
| `clearSession` | attr | Clear the session every 100 rows to hold memory down on big files. |
| `disabled` | attr | Make the step a no-op without deleting it. |
| `next` | elem | The step each row goes to. |

```xml
<CsvInput startRow="1" separator="," charsetName="UTF-8">
    <skipIfBlankColumns>
        <int>0</int>
    </skipIfBlankColumns>
    <next class="JsRowStep">
        <jsPath>/integration/import.js</jsPath>
        <execFn>importRow</execFn>
    </next>
</CsvInput>
```

### ExcelInputStep

[Reference](https://docs.kademi.co/ref/templating/md/ExcelInputStep.md)

- **Consumes** an `InputStream` of an xls or xlsx workbook. The format is detected automatically.
- **Emits** either the whole workbook to a single `next`, or per-sheet output through
  `nextSheetSteps`.

| Property | Kind | Notes |
|---|---|---|
| `processRows` | elem | `true` to parse each row of the resolved sheet and pass it on as cell values. `false` passes the sheet object itself. |
| `nextSheetSteps` | elem | List of [NextSheetStep](https://docs.kademi.co/ref/templating/md/NextSheetStep.md) entries, one per sheet you want to process. |
| `next` | elem | Used only when `nextSheetSteps` is absent; receives the whole workbook. |

Reading stops early if the pipeline is cancelled, a sheet's `maxRows` is reached, or ten
consecutive blank rows are seen. A password-protected or unreadable workbook fails the run.

`NextSheetStep` properties: `sheetNum` (attr, zero-based), `sheetName` (attr), `startRow` (attr,
zero-indexed), `maxRows` (attr), `skipIfBlankColumns` (elem), `disabled` (attr), `next` (elem).

```xml
<ExcelInputStep>
    <processRows>true</processRows>
    <nextSheetSteps>
        <NextSheetStep sheetNum="0" startRow="1">
            <next class="JsRowStep">
                <jsPath>/integration/import.js</jsPath>
                <execFn>importRow</execFn>
            </next>
        </NextSheetStep>
    </nextSheetSteps>
</ExcelInputStep>
```

### FixedWidthInput

[Reference](https://docs.kademi.co/ref/templating/md/FixedWidthInput.md)

- **Consumes** an `InputStream` of fixed-width text.
- **Emits** one call to `next` per line, with one argument per configured field.

| Property | Kind | Notes |
|---|---|---|
| `columnWidths` | elem | List of `<int>` field lengths, applied in order to split each line. |
| `startRow` | attr | Zero-indexed start line. Any non-zero value also skips the first line as a header. |
| `skipIfBlankColumns` | elem | List of `<int>`; a row is skipped when all of them are blank. |
| `disabled` | attr | No-op switch. |
| `next` | elem | |

### DatabaseSourceStep

[Reference](https://docs.kademi.co/ref/templating/md/DatabaseSourceStep.md)

- **Consumes** nothing. This is the root of an export pipeline.
- **Emits** one call to `next` per query result row, or one call with the whole list under
  `passAsList`.

| Property | Kind | Notes |
|---|---|---|
| `providerId` | attr | Which registered table provider builds and runs the query. See the provider table below. |
| `passAsList` | attr | |
| `column` | attr-only elements | [Column](https://docs.kademi.co/ref/templating/md/Column.md) mappings from query result onto the emitted row. |
| `next` | elem | |

### QueryExport

[Reference](https://docs.kademi.co/ref/templating/md/QueryExportStep.md)

- **Consumes** nothing.
- **Emits** one header row of column names, then one call per data row.

| Property | Kind | Notes |
|---|---|---|
| `queryName` | elem | A plain name runs a saved query. Prefix with `iq:` to run an index query, which is bounded by the pipeline's `fromDate` and `toDate` attributes. |
| `next` | elem | |

This is the step the Create Export wizard uses. Pair it with `CsvOutput` or `ExcelOutputStep`.

```xml
<TransactionStep>
    <next class="QueryExport">
        <queryName>iq:Active Deals Individual</queryName>
        <next class="CsvOutput">
            <writeHeaderRow>false</writeHeaderRow>
        </next>
    </next>
</TransactionStep>
```

Note: a query export already emits its own header row, so leave `writeHeaderRow` off.

---

## Transform steps

### JsRowStep

[Reference](https://docs.kademi.co/ref/templating/md/JsRowStep.md) and
[js-row-step.md](js-row-step.md).

- **Consumes** whatever the previous step emitted; the row's values become the function arguments.
- **Emits** only what the script forwards, through `rowWriter.write(...)` or `nextStep.exec(...)`.

| Property | Kind | Notes |
|---|---|---|
| `jsPath` | elem | Path to a JavaScript file in the website's files. |
| `execFn` | elem | Function called once per row. |
| `prepareFn` | elem | Function called once before any rows. |
| `finishFn` | elem | Function called once after all rows. |
| `next` | elem | The step `rowWriter` and `nextStep` forward to. With no `jsPath` configured, rows pass straight through to it. |

`jsText` exists as a property but is not read at run time. Always use `jsPath`.

### MapStep

[Reference](https://docs.kademi.co/ref/templating/md/MapStep.md)

Builds an in-memory lookup so a later step can correlate two sources that share a key.

- **Consumes** rows.
- **Emits** every row unchanged to `next`, and leaves a map in the pipeline attributes.

| Property | Kind | Notes |
|---|---|---|
| `keyColumn` | elem | A `Column` whose value becomes the map key. |
| `valueColumn` | elem | A `Column` whose value is stored. Omit to store the whole row. |
| `keyAttribute` | elem | Name of the pipeline attribute the map is stored under. |
| `next` | elem | |

```xml
<MapStep>
    <keyColumn field="key" column="0"/>
    <valueColumn field="val" column="3"/>
    <keyAttribute>costCentres</keyAttribute>
    <next class="CsvOutput"/>
</MapStep>
```

### SetAttributesStep

[Reference](https://docs.kademi.co/ref/templating/md/SetAttributesStep.md)

- **Consumes** a row.
- **Emits** the same row, unchanged, to `next`, after copying values into pipeline attributes.

Configured with `column` elements whose `field` is the attribute name. Use this to lift a period,
a batch id or a supplier code out of the first row so downstream `Column` mappings can reference it
with `attribute="..."`.

### Column

[Reference](https://docs.kademi.co/ref/templating/md/Column.md)

Not a step. A `<column>` element inside a step that reads or writes named fields.

| Attribute | Meaning |
|---|---|
| `field` | The name of the field on the target row. Required. |
| `column` | Zero-indexed source column number. |
| `columnName` | Spreadsheet-style column letter, for example `A` or `AB`. |
| `attribute` | Read the value from a pipeline attribute instead of the row. |
| `valueString` | A fixed constant. |

`expr` is a child element, not an attribute: an MVEL expression evaluated over the raw value, with
`value`, `row`, `columns`, `formatter` and `pipeline` in scope. `columns` is a
[ColumnsHelper](https://docs.kademi.co/ref/templating/md/ColumnsHelper.md), giving typed null-safe
access to the row.

```xml
<column field="amount" column="10">
    <expr>value == null ? 0 : value</expr>
</column>
<column field="fromDate" attribute="periodStart"/>
<column field="source">
    <value class="string">weekly-feed</value>
</column>
```

---

## Branch steps

### MultiStep

[Reference](https://docs.kademi.co/ref/templating/md/MultiStep.md)

Runs several steps against the same input, in order. The normal way to fan out: write the same rows
to two destinations, or attach a `ResultEmail` alongside a real chain.

| Property | Kind | Notes |
|---|---|---|
| `nextSteps` | elem | List of steps, each named by its element name. |
| `disableEvents` | attr | Suppress platform events for everything under this step. Useful for bulk loads that would otherwise fire a notification per row. |

`prepare`, `exec` and `finished` all propagate to every child.

```xml
<MultiStep disableEvents="true">
    <nextSteps>
        <DatabaseUpdateStep providerId="profile" mode="updateOrInsert">
            <column field="email" column="0"/>
            <column field="firstName" column="1"/>
        </DatabaseUpdateStep>
        <CsvOutput/>
    </nextSteps>
</MultiStep>
```

### DecisionStep

[Reference](https://docs.kademi.co/ref/templating/md/DecisionStep.md)

Selects a branch by matching a value against the keys of `nextSteps`. `selectorColumn` (attr) reads
a zero-indexed column from the row, `selectorAttribute` (attr) reads a pipeline attribute.

**As currently implemented this step resolves the selector value but does not route to a branch, so
nothing downstream of it runs.** Until that changes, branch on a value with a `JsRowStep` that
inspects the row and calls `nextStep.exec(...)` only for the rows you want, or fan out with
`MultiStep` and let each branch filter.

---

## Persist steps

### DatabaseUpdateStep

[Reference](https://docs.kademi.co/ref/templating/md/DatabaseUpdateStep.md)

- **Consumes** a row.
- **Emits** the row to `next` after the write.

| Property | Kind | Notes |
|---|---|---|
| `providerId` | attr | Which table provider does the write. |
| `mode` | attr | `insert`, `update`, `delete` or `updateOrInsert`. Everything except `insert` needs the row to carry an identifier. |
| `column` | attr-only elements | Maps row values onto the fields the provider expects. |
| `setIntoAttribute` | attr | Store the created or updated entity under this pipeline attribute. |
| `skipIfBlankColumns` | elem | List of `<int>`. |
| `autoFlush` | attr | Refresh the session every 100 rows on large imports. |
| `next` | elem | |

Do not use this for sales data. Use `SalesDataInserter`.

### SalesDataInserter

[Reference](https://docs.kademi.co/ref/templating/md/SalesDataInserter.md)

Writes one sales data record per row into a named series.

| Property | Kind | Notes |
|---|---|---|
| `seriesName` | elem | The series, looked up in the pipeline's organisation. |
| `mode` | attr | `insert` (default), `update`, `updateOrInsert`. |
| `column` | attr-only elements | Required fields are `amount`, `attributedTo`, `fromDate` and `toDate`, plus any extra fields defined on the series. |
| `ignoreMissingEntity` | attr | Skip rows whose `attributedTo` does not resolve, instead of raising a warning. |
| `ignoreEvents` | attr | Suppress the events an insert would fire. |
| `logInserts`, `logUpdates` | attr | Record each write as an info message. Leave off for large loads. |
| `disabled` | attr | Rows still pass through to `next`. |

`attributedTo` is an organisation id for an org-scoped series, or an email address or user id for a
profile-scoped one. `toDate` defaults to `fromDate` when the record is a point in time.

### PersistAsTable

[Reference](https://docs.kademi.co/ref/templating/md/PersistAsTableStep.md)

Saves incoming data as a saved spreadsheet and passes the resulting table hash plus the table on to
`next`. The input must be a **list of rows or an `InputStream`**, not individual rows, so put it
directly under an input step configured with `passAsList`, or under an input stream source.

The usual reason to use it is to hand a stable file hash to a `MapReduce` step.

### TableUploader

[Reference](https://docs.kademi.co/ref/templating/md/TableUploaderStep.md)

Runs incoming tabular data through a saved table uploader and a saved field mapping, and passes the
resulting async job to `next`.

| Property | Kind | Notes |
|---|---|---|
| `tableUploaderName` | elem | Name of the registered uploader. |
| `fieldMappingName` | elem | Name of a saved mapping scoped to that uploader. |

Both names are resolved when the step runs; either one missing fails the pipeline. See the table
uploader section of the main skill for when this beats hand-building an import chain.

---

## Output steps

### CsvOutput

[Reference](https://docs.kademi.co/ref/templating/md/CsvOutput.md)

Writes each incoming row to the pipeline output as one CSV line. Terminal in practice.

| Property | Kind | Notes |
|---|---|---|
| `separator`, `quoteChar`, `escapeChar` | attr | |
| `writeHeaderRow` | elem | |
| `columnNames` | elem | List of `<string>` written as the header when `writeHeaderRow` is true. |

### ExcelOutputStep

[Reference](https://docs.kademi.co/ref/templating/md/ExcelOutputStep.md)

Builds a workbook from incoming rows and writes it to the pipeline output.

| Property | Kind | Notes |
|---|---|---|
| `type` | attr | `xlsx`, `xlsm`, or anything else (including unset) for legacy `xls`. |
| `password` | attr | Encrypts the output. xlsx only. |
| `headers` | elem | List of `<string>`, written as the first row and used to place values by name. |
| `firstSheetTitle` | elem | |
| `column` | attr-only elements | Explicit placement, as an alternative to positional. |
| `next` | elem | |

### TemplateOutput

[Reference](https://docs.kademi.co/ref/templating/md/TemplateOutput.md)

Renders a Velocity template into the pipeline output, with the pipeline attributes and the incoming
arguments in the data model. Configured with `templatePath` (elem). Typically the last step of an
interactive import, producing a result page. Terminal.

### VelocityOutput

[Reference](https://docs.kademi.co/ref/templating/md/VelocityOutputStep.md)

Renders a Velocity template to HTML and sets the response content type to `text/html`. The data
model gets the pipeline, the website and the step's arguments. Output is buffered and only written
when the pipeline finishes, so it is safe to render a summary that includes messages recorded during
the run. Configured with `template` (attr).

### ResultEmail

[Reference](https://docs.kademi.co/ref/templating/md/ResultEmailPipelineStep.md)

Emails a summary of the run's failures, warnings and info messages when the pipeline finishes.

| Property | Kind | Notes |
|---|---|---|
| `recipients` | elem | List of `<string>`: user names or email addresses. An address with no profile gets one created. |
| `subject` | elem | The pipeline path, and a failure count if any, are appended. |
| `fromAddress` | elem | Defaults to the website's no-reply address if blank. |
| `onlySendOnFailure` | attr | |

**Terminal.** Its `exec` does nothing and it never forwards to a `next`, so put it last in a chain
or hang it off a `MultiStep`.

---

## Control and lifecycle steps

### TransactionStep

[Reference](https://docs.kademi.co/ref/templating/md/TransactionStep.md)

Wraps everything below it in one database transaction, committed when the pipeline finishes and
rolled back on failure. Almost every import pipeline starts with this.

| Property | Kind | Notes |
|---|---|---|
| `isolated` | attr | Start and commit a transaction around each `exec` instead, so one per row. Also what you use to avoid "nested transactions not supported" when transaction steps are nested. |
| `alwaysRollback` | attr | Roll back regardless of outcome. For testing a pipeline without persisting anything. |
| `next` | elem | |

### RecordExecutionStep

[Reference](https://docs.kademi.co/ref/templating/md/RecordExecutionStep.md)

Wraps processing in a transaction and tags the run with an execution id, so the same data cannot be
imported twice.

| Property | Kind | Notes |
|---|---|---|
| `execIdTemplate` | elem | MVEL template evaluated against the run to build the id, for example one that resolves to `points-31012015`. |
| `preventDuplicates` | attr | Refuse to run when an execution with that id already exists. |
| `next` | elem | |

In the current implementation this step forwards all three lifecycle calls and the settings that
actually take effect are the endpoint's own `recordExecution`, `execIdTemplate` and
`preventDuplicates`. Configure duplicate prevention on the endpoint. See
[endpoints.md](endpoints.md).

### Reindex

[Reference](https://docs.kademi.co/ref/templating/md/ReIndexPipelineStep.md)

Re-indexes one or more search indexers for the pipeline's organisation, so imported records show up
in searches and index queries.

| Property | Kind | Notes |
|---|---|---|
| `index` | repeated elem | One element per indexer id. |
| `async` | attr | `true` queues it as a background job and lets the pipeline finish. |

```xml
<Reindex async="true">
    <index>profile</index>
    <index>organisation</index>
</Reindex>
```

### runPointsAllocation

[Reference](https://docs.kademi.co/ref/templating/md/RunPointsAllocationSourcesPipelineStep.md)

Runs the points allocation sources configured for a sales data series once the pipeline finishes.
The natural tail of a sales import: load the sales rows, then award the points. Configured with
`seriesName` (elem). A blank or unknown series logs a warning rather than failing the run.

**Terminal.** Like `ResultEmail`, it does its work in the `finished` phase and does not forward, so
put it last or hang it off a `MultiStep`.

### MapReduce

[Reference](https://docs.kademi.co/ref/templating/md/MapReduceStep.md) and
[map-reduce.md](map-reduce.md).

Splits incoming data into batches and processes them in parallel as an asynchronous job.
Configured with `mapFn` (elem) and `reduceFn` (elem). Incoming arguments pass through unchanged to
`next` as soon as the job is queued, so `next` runs immediately and not when the work finishes.

### WebServiceStep

[Reference](https://docs.kademi.co/ref/templating/md/WebServiceStep.md)

A placeholder reserved for a future web service call. It currently does nothing but hold a `next`.
Do not build on it. To call a remote service from a pipeline, use a `JsRowStep` and the `http`
binding.

---

## Database table providers

`DatabaseSourceStep` and `DatabaseUpdateStep` name a provider by id. Each provider defines the field
names its `column` mappings can target.

| `providerId` | What it reads or writes |
|---|---|
| `profile` | [ProfileTableProvider](https://docs.kademi.co/ref/templating/md/ProfileTableProvider.md): profiles and their group memberships |
| `membership` | [GroupMembershipTableProvider](https://docs.kademi.co/ref/templating/md/GroupMembershipTableProvider.md): group memberships and their owning profile |
| `organisation` | [OrganisationTableProvider](https://docs.kademi.co/ref/templating/md/OrganisationTableProvider.md): child organisations of the current account |
| `fastOrganisation` | Same as `organisation`, tuned for large loads |
| `points` | [PointsRowProvider](https://docs.kademi.co/ref/templating/md/PointsRowProvider.md): points awarded against a reward bucket |
| `pointsFast` | [FastPointsRowProvider](https://docs.kademi.co/ref/templating/md/FastPointsRowProvider.md): the bulk-insert form of the above |
| `pointsDebit` | Points debits from a profile or organisation |
| `pointsDebitFast` | [FastPointsDebitRowProvider](https://docs.kademi.co/ref/templating/md/FastPointsDebitRowProvider.md): the bulk-insert form |
| `products` | [ProductsTable](https://docs.kademi.co/ref/templating/md/ProductsTable.md): products, including soft delete |
| `productOptions` | [ProductOptionsTable](https://docs.kademi.co/ref/templating/md/ProductOptionsTable.md): product parameter options, commonly called variants |
| `category` | [CategoryTableProvider](https://docs.kademi.co/ref/templating/md/CategoryTableProvider.md): product categories |
| `productCategory` | [ProductInCategoryTableProvider](https://docs.kademi.co/ref/templating/md/ProductInCategoryTableProvider.md): links products to categories |
| `dataSeries` | [DataSeriesProvider](https://docs.kademi.co/ref/templating/md/DataSeriesProvider.md): reads sales data records for a named series, as an export source |
| `survey` | [SurveyRowProvider](https://docs.kademi.co/ref/templating/md/SurveyRowProvider.md): reads survey submissions, as an export source |
| `shoppingCart` | Shopping carts |

Prefer the `Fast` variants for bulk inserts of points and organisations; prefer the plain ones when
you need the full entity lifecycle.

---

## Choosing quickly

| I need to | Use |
|---|---|
| Read an uploaded CSV | `CsvInput` |
| Read a spreadsheet, one sheet | `ExcelInputStep` with one `NextSheetStep` |
| Read a spreadsheet, several sheets differently | `ExcelInputStep` with several `NextSheetStep` entries |
| Read a legacy fixed-width feed | `FixedWidthInput` |
| Export a saved query or index query | `QueryExport` |
| Export from a platform table | `DatabaseSourceStep` |
| Run my own logic per row | `JsRowStep` |
| Look up values from a second source | `MapStep` |
| Carry a period or batch id to later steps | `SetAttributesStep` |
| Write profiles, orgs, products, points | `DatabaseUpdateStep` |
| Write sales data | `SalesDataInserter` |
| Reuse an existing import mapping | `TableUploader` |
| Process a very large file | `PersistAsTable` then `MapReduce` |
| Send the result as CSV or Excel | `CsvOutput`, `ExcelOutputStep` |
| Show a result page | `TemplateOutput` or `VelocityOutput` |
| Email a run summary | `ResultEmail` |
| Make the whole run atomic | `TransactionStep` at the root |
| Refuse a repeat import of the same file | `RecordExecutionStep` |
| Refresh search after an import | `Reindex` |
| Award points after loading sales | `runPointsAllocation` |
| Do two things with the same rows | `MultiStep` |
