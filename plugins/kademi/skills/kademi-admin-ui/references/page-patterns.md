# Admin page patterns

Copy-pasteable layouts for Kademi admin pages. These are the concrete shapes; the reasoning
behind them (prominence, semantic colour, list vs detail) is in
[ux-standards.md](ux-standards.md).

Every pattern below assumes you have pulled in the shared macro library first:

```velocity
#parse("/theme/apps/admin/common-macros.html")
```

## The page shell

An admin page template is a full HTML document. The theme supplies the menu, header, footer
and all styling around it, so you write only what goes inside `<body>`.

```velocity
<html>
<head>
    <title>Marketing Programs</title>
    <meta name="description" content="Create and manage Marketing Development Fund programs.">
</head>
<body>

#parse("/theme/apps/admin/common-macros.html")
#set( $dm = $services.dateManagerV1 )
#set( $fc = $formatter.newFormContext() )

<section id="managePrograms">
    ...
</section>

</body>
</html>
```

Do not add `<link rel="stylesheet">` or `<script src="">`. Register those in
`dependencies.json` instead.

## Page header

Eyebrow, title, optional inline status icon, subline, actions. Not a form-field-style
"Status" row buried in the body.

```velocity
<div class="pull-right">
    <button type="button" class="btn btn-default"><i class="fa fa-cog"></i> Modify configuration</button>
</div>
<p class="text-muted mg-bottom-0"><small>MARKETING PROGRAM</small></p>
<h2 class="mg-top-0">
    $formatter.htmlEncode($title)
    <i class="fa fa-check-circle text-success" title="Active" data-toggle="tooltip" data-placement="top"></i>
</h2>
<p class="text-muted">Submitted by Jane Smith &middot; 3 Feb 2026 &middot; 12 claims</p>
```

- Status is a plain **icon**, not a badge. Colour plus icon carries the meaning; the `title`
  attribute carries the text for the tooltip and for screen readers.
- Icon and colour by state: `fa-check-circle text-success` (active, approved),
  `fa-times-circle text-danger` (rejected), `fa-pencil text-info` (draft, editable),
  `fa-clock-o text-muted` (expired, ended). Pick the closest semantic colour; do not invent
  new ones.
- Leave the icon off when the page already states its status somewhere with room to say more.
  A status metric card ("Pending review / waiting 3 days") says more than a glyph can, and a
  pencil next to a record's name reads as "rename this", not "draft".
- Say each thing once. If the title is the person or organisation the record belongs to, the
  eyebrow and subline must not repeat it - give the eyebrow the parent context and the
  subline the dates.

## Metric tiles

Four or five stat cards in a `row`. **Do not hand-roll the card markup.** Two macros exist:

- `renderDataPanel` - the whole card: panel wrapper, optional drill-through link, body. The
  default choice.
- `renderStatPanel` - the body only, from `panel-body` inwards. Use when you must own the
  panel wrapper, for example to apply `panel-info` or `panel-warning`.

The caller owns the grid column either way.

```velocity
<div class="row">
    <div class="col-md-3 col-sm-6">
        #renderDataPanel({"title": "Claimed to date", "value": $claimedToDate,
                          "format": "currency", "link": $searchClaimsUrl,
                          "description": "67% of the approved budget"})
    </div>
    <div class="col-md-3 col-sm-6">
        <div class="panel panel-warning">
            #renderStatPanel("Awaiting approval", "Oldest has waited 3 days", false,
                             $pendingCount, 1, false, false, "")
        </div>
    </div>
</div>
```

`renderDataPanel` takes a single map because nearly every input is optional. Supply the
value one of two ways:

- `value` - a figure you already calculated, optionally with `prevValue` to get a computed
  trend sub-line.
- `metricType` - the id of an analytics rule, calculated over the page's common date range
  with the preceding equal-length period as the comparison. Rule inputs: `params`,
  `cProgram`, `cCourse`, `cModule`, `showValueChange`.

Presentation keys: `description` (free sub-line, emitted as-is so it may contain markup),
`descriptionClass`, `link`, `format` (`bytes`, `time`, `currency`, `text`, otherwise plain
decimal), `isPercentage`.

- `format=text` for a value that is already formatted or non-numeric - an age, a name,
  "1,234 pts". A text card must not pass `prevValue`; the trend block does arithmetic on the
  value.
- The single most important number gets `panel-info` - a mild highlight, not a hero block.
  That needs the caller to own the wrapper, so use `renderStatPanel` for it.
- A card that needs attention (a non-zero pending count) gets `panel-warning`.
- Inside a `panel-info` or `panel-warning` card pass `descriptionClass=""`. The empty string
  drops the class so the sub-line and the label inherit the panel's colour instead of staying
  muted grey, which would undercut the emphasis. Omitting the key gives the default
  `text-muted`.
- Never let a number stand alone without its unit of meaning. "$430" means nothing without
  "67% effective rate" or "1 payout record created" underneath it.
- A card that drills through to records takes `link`. That alone produces the hover lift and
  the tinted arrow after the label. Never hand-wrap a card in your own `<a>`. Links are
  suppressed automatically outside the admin console, since the targets are admin URLs.

Not every tile is this card. A panel with an action button, an embedded portlet, or several
stacked fields is a different component - leave it alone rather than forcing it through
the macro.

For a chart-driven summary on a *participant-facing* page rather than an admin one, there is
a ready-made component: see
[The reporting dashboard component](https://docs.kademi.co/blogs/docs-kb/the-reporting-dashboard-component-how-to-add-it-to-website-pages/).

## Notices and alerts - one shape

Every notice in the admin is the same row, whether it is a queue of them on a dashboard or a
single banner on a detail page. **Do not use Bootstrap's `.alert` for a page notice.**
`.alert-{severity}` floods the whole block with colour and recolours the heading, which
buries the message and makes the notice look nothing like the queue rows elsewhere in the
product. Severity belongs on the icon and the status label; the row stays white.

**A notice - title, detail, no action:**

```velocity
#renderActivityNotice("info" "fa-pencil" "This claim is in draft and awaiting review"
                      "Line items can be edited until it is approved or rejected.")
```

- `$severity`: `success`, `info`, `warning`, `danger`, `primary`. The first four are the
  Bootstrap states; `primary` is the account's brand colour, for an announcement that is
  neither good news nor bad.
- `$icon` overrides the glyph the severity would pick. Pass `""` (not `false`) to take the
  default.
- `$title` and `$subtitle` are plain text - the macro HTML-encodes them, so do not
  pre-encode and do not pass markup. Build a dynamic title with `#set` first.
- The macro emits its own `.list-group` wrapper.

**A row with a status label and/or an action** - the dashboard queue shape, "9 claims
awaiting approval" with a Review button:

```velocity
#set( $item = $formatter.newMap() )
$formatter.call( $item.put("title", "9 claims are awaiting approval") )
$formatter.call( $item.put("subtitle", "Review and approve or reject these claims.") )

#set( $status = $formatter.newMap() )
$formatter.call( $status.put("label", "Needs attention") )
$formatter.call( $status.put("severity", "warning") )
$formatter.call( $item.put("status", $status) )

#set( $cta = $formatter.newMap() )
$formatter.call( $cta.put("label", "Review claims") )
$formatter.call( $cta.put("href", "/kmarketing/managePrograms/") )
$formatter.call( $item.put("cta", $cta) )

<div class="list-group">
    #renderActivityItem($item)
</div>
```

- Keys: `title`, `subtitle`, `bodyHtml`, `status{label,severity}`, `cta{label,href}`,
  `dismissId`, `actionsHtml`, plus top-level `severity`/`icon` for a row with no status label
  to hang the colour on. Everything but `title` is optional.
- Wrap in `<div class="list-group">` even for a single row - that is what gives it the
  bordered row treatment.
- `bodyHtml` is the one key the macro does not encode. Pass only markup the account's own
  administrators authored (for example a message written in the HTML editor); never a raw
  user-supplied string. Everything else goes through `title`/`subtitle` and is encoded for
  you.
- `actionsHtml` is the escape hatch for a row needing more than one plain link. It is
  emitted as-is, so it is caller-built trusted markup, never user data. Prefer `cta`.
- `dismissId` adds a quiet clear-this-row control carrying that id in `data-dismiss-id`. The
  macro renders the control; your page's JS decides what dismissing means. Rows the server
  leaves without a `dismissId` have no control, which is what stops a "dismiss all" sweep
  clearing a notice the user must acknowledge.

Dashboard alerts can carry richer content, including generated QR codes - see
[Creating QR codes in dashboard alerts](https://docs.kademi.co/blogs/docs-kb/creating-qr-codes-in-dashboard-alerts/).

**`.alert` still has legitimate uses** that are not page notices: an inline form error
(`.form-message alert alert-danger`, hidden until the submit fails) and an explanatory note
inside a modal. Inside any of them, **never use `text-muted`**. An alert sets a colour on its
contents and each theme picks its own - admin themes tint the background and darken the text,
participant themes fill it solid and go white - while `text-muted` is a fixed grey that turns
unreadable on the solid version. Use `<small><em>` instead; it de-emphasises and inherits the
colour.

## List pages

Use `$formatter.newTable(...)` to describe the table and the `standardTable` macro to render
it. The macro gives you sorting, pagination, selection checkboxes, the remove button and
per-user column customisation for free.

```velocity
#set( $dm = $services.dateManagerV1 )
#set( $fc = $formatter.newFormContext() )
#set( $q        = $fc.cleanedParam('q') )
#set( $start    = $formatter.ifNull($fc.integerParam('startPos'), 0) )
#set( $pageSize = $formatter.ifNull($fc.integerParam('pageSize'), 20) )
#set( $sortField = $fc.cleanedParam('sortField') )
#set( $sortDir   = $fc.cleanedParam('sortDir') )

#set( $searchResult = $services.myAppService.search($start, $pageSize, $q, $sortField, $sortDir) )

<div class="row">
    <div class="col-md-4">
        <div class="input-group">
            <span class="input-group-addon"><i class="fa fa-search"></i></span>
            <input type="text" id="myAppQ" name="q" class="form-control filterField"
                   placeholder="Search claims..." value="$!formatter.htmlEncode($q)"/>
            <span class="input-group-addon clickable clear-search" title="Clear search"
                  data-target="#myAppQ"><i class="fa fa-times"></i></span>
        </div>
    </div>
</div>

#set( $paginator = $formatter.paginator($pageSize).skipToStart(false) )
#set( $paginator.pageSizeEditable = true )
#set( $paginator = $paginator.totalRecords($searchResult.totalRecords) )

#set( $table = $formatter.newTable("myapp-claims-table").title("Claims").paginator($paginator).records($formatter.toList($searchResult.records)) )
$table.bodyId("myapp-claims-body").addClasses("table-hover", "table-striped").selection(true)
$table.column("status").title("Status").width(100)
$table.column("submittedBy").title("Submitted by")
$table.column("enteredDate").title("Submitted").sortable(true).width(150)
$table.column("amount").title("Amount").sortable(true).width(120).addClasses("text-right")
$table.column("edit").title("").width(80).addClasses("text-right")

<div id="myapp-claims-div" class="table-responsive">
    #@standardTable($table.build(), "toRemoveIds", true, $sortField, $sortDir)
        #set( $tableRowId = $p.name )
        #if( $header.id == "status" )
            #if( $formatter.isEqual($p.status, 0) )
                <span class="label label-default">Pending</span>
            #elseif( $formatter.isEqual($p.status, 1) )
                <span class="label label-success">Approved</span>
            #else
                <span class="label label-danger">Rejected</span>
            #end
        #elseif( $header.id == "submittedBy" )
            $formatter.link($p.submittedBy)
        #elseif( $header.id == "enteredDate" )
            $!dm.formatDateTime($p.enteredDate)
        #elseif( $header.id == "amount" )
            $$!formatter.formatCurrency($p.amount)
        #elseif( $header.id == "edit" )
            <a href="/myapp/claims/$p.name" class="btn btn-sm btn-primary" title="View"><i class="fa fa-edit"></i></a>
        #end
    #end
</div>
```

Inside the macro body, `$p` is the current record and `$header` the current column, so one
`#if` chain renders every cell. Set `$tableRowId` to the record's identifier so selection and
the remove button know what they act on.

`standardTable` also accepts an options map instead of positional arguments, with keys
`tableMeta`, `selectionName`, `showTablePaginator`, `currentSortField`, `currentSortDir`,
`bootstrapTab`, `nativeSorting`, `showSelection`, `liftColsTrigger`, `hideColsTrigger`.

Reference: [Table](https://docs.kademi.co/ref/templating/md/Table.md),
[Column](https://docs.kademi.co/ref/templating/md/Column.md),
[Paginator](https://docs.kademi.co/ref/templating/md/Paginator.md),
[FormContext](https://docs.kademi.co/ref/templating/md/FormContext.md).

## Panel-wrapped tables

Never render a bare `<table>` on a detail page. Wrap it in a panel whose heading states what
the numbers mean:

```velocity
<div class="panel panel-default">
    <div class="panel-heading">
        Line items
        <span class="text-muted">&middot; payout is calculated from the plan's agreed rate and cap per expense type</span>
    </div>
    <div class="table-responsive">
        <table class="table table-striped mg-bottom-0">
            <thead><tr><th>Expense type</th><th class="text-right">Amount</th></tr></thead>
            <tbody>
                #foreach( $line in $lines )
                <tr>
                    <td>$formatter.htmlEncode($line.title)</td>
                    <td class="text-right">
                        <b class="text-info">$$!formatter.formatCurrency($line.payout)</b>
                        <br><small class="text-muted">$line.rate% rate#if($line.capped) &middot; capped#end</small>
                    </td>
                </tr>
                #end
            </tbody>
            <tfoot><tr><td>Total</td><td class="text-right">$$!formatter.formatCurrency($total)</td></tr></tfoot>
        </table>
    </div>
</div>
```

- Numeric columns right-aligned, including the header cell. Everything else left.
- A computed value that is not self-evident gets a one-line explanation directly under it.
  The reader should never have to guess how a number was derived.
- A per-row proportion gets a small inline progress bar, not just a percentage:
  `<div class="progress mg-bottom-0" style="height:8px;"><div class="progress-bar progress-bar-success" style="width: ${pct}%"></div></div>`.

## Budget / usage bar

A segmented Bootstrap progress bar plus a text legend, for anything that is "spent versus
remaining":

```velocity
<div class="panel panel-default">
    <div class="panel-heading">Budget utilization <span class="text-muted">&middot; program to date</span></div>
    <div class="panel-body">
        <div class="progress mg-bottom-10" style="height: 14px;">
            <div class="progress-bar progress-bar-success" style="width: ${approvedPercent}%"></div>
            <div class="progress-bar progress-bar-warning" style="width: ${pendingPercent}%"></div>
        </div>
        <p class="text-muted mg-bottom-0">
            <span class="label label-success">&nbsp;</span> $$!formatter.formatCurrency($approved) approved &middot;
            <span class="label label-warning">&nbsp;</span> $$!formatter.formatCurrency($pending) pending review &middot;
            <span class="label label-default">&nbsp;</span> $$!formatter.formatCurrency($available) available
        </p>
    </div>
</div>
```

Only include as many segments as you can back with real, distinctly tracked data.

## Read-only configuration summary

For "settings at a glance" on a detail page - current values, not a form - use a Bootstrap
description list with the shared `config-summary` class, grouped into sub-sections:

```velocity
<div class="panel panel-default">
    <div class="panel-heading">
        Program configuration
        <button type="button" class="btn btn-link btn-xs pull-right js-modify-config">Modify configuration</button>
    </div>
    <div class="panel-body">
        <div class="row">
            <div class="col-md-6">
                <p class="text-muted"><small><b>CLAIMS</b></small></p>
                <dl class="row config-summary">
                    <dt class="col-md-5">Claim mode</dt>
                    <dd class="col-md-7">
                        <span class="label label-info">Advanced</span>
                        <br>#subtext("Itemized claims funded at different rates and caps per expense category")
                    </dd>
                </dl>
            </div>
        </div>
    </div>
</div>
```

- `config-summary` adds vertical rhythm between pairs. Without it Bootstrap's `dl.row` bunches
  every row into one block. Reuse the class rather than adding a page-local stylesheet for
  the same spacing fix.
- An on/off or enum setting renders as a `label`, not raw text - pick the closest semantic
  colour.
- Any value that is a real entity (a product, a user, a data series) renders as
  `$formatter.link($entity)`, not a name or code string. Resolve the stored identifier to the
  entity first.

## Read-only view versus editable form

When a record has an editable phase and a locked phase (draft then approved, pending then
processed), build **two** render branches, not one form with fields disabled by status:

- A read-only macro: panels, metrics, tables. No `<form>`, no inputs.
- An editable macro: the real `<form>`, shown only while the record is genuinely editable.
- Switch with a query parameter (`$formatter.newFormContext().cleanedParam("configEdit")`)
  and a "Modify" button that reloads just that fragment, not the whole page.
- Once locked, only show actions that are still possible. Do not leave a button visible that
  no longer does anything.

## Mutually exclusive option picker

When a setting has several mutually exclusive modes, each with its own parameters (an expiry
mode: none / fixed period / fixed date / calculated), do not expose them as several
independently editable fields with ad-hoc show-hide logic. Build a stack of option cards:
one radio per mode, each card's parameters visible only while that card is selected. The
control enforces exclusivity instead of validation, and there is no ambiguous
"everything is blank" state distinct from a deliberate "none" - make "none" one of the cards.

`.option-card`, `.option-card-header` and `.option-card-body` are shared theme classes,
already loaded on every admin page.

```velocity
<div id="expiry-options" role="radiogroup" aria-label="Expiry">
    <div class="panel panel-default option-card #if($effectiveMode == 'none')selected#end" data-mode="none">
        <div class="panel-heading option-card-header">
            <input type="radio" name="expiryMode" value="none" id="mode-none" #if($effectiveMode == 'none')checked#end/>
            <label for="mode-none" style="margin: 0; cursor: pointer;">
                <b>Never expires</b>
                <br/><small class="text-muted">Vouchers stay valid until they are used.</small>
            </label>
        </div>
    </div>

    <div class="panel panel-default option-card #if($effectiveMode == 'days')selected#end" data-mode="days">
        <div class="panel-heading option-card-header">
            <input type="radio" name="expiryMode" value="days" id="mode-days" #if($effectiveMode == 'days')checked#end/>
            <label for="mode-days" style="margin: 0; cursor: pointer;"><b>Expires after a fixed period</b></label>
        </div>
        <div class="option-card-body">
            <label for="expiryDays" style="display: block; font-size: 12px; font-weight: 500;">Days</label>
            <input type="text" class="form-control" id="expiryDays" name="expiryDays" value="$!page.expiryDays"/>
            #subtext("Counted from the day the voucher is issued.")
        </div>
    </div>
</div>
```

```js
var container = $('#expiry-options');
container.on('change', 'input[name=expiryMode]', function () {
    container.find('.option-card').removeClass('selected');
    $(this).closest('.option-card').addClass('selected');
});
container.on('click', '.option-card', function () {
    var radio = $(this).find('input[name=expiryMode]');
    if (!radio.prop('checked')) {
        radio.prop('checked', true).trigger('change');
    }
});
```

Compute the *effective* mode server-side even for older records with no value stored, so
existing data lands on the right card rather than defaulting to the first one. Delegate the
JS off the stable container so it keeps working after any fragment inside a card reloads.

Where the effect of a choice is not obvious from its raw parameters, pair the stack with a
live plain-English summary rebuilt in JS on every change.

## Right-rail companion panels

- Context that should survive switching tabs (for example "other records by this
  participant") belongs in a page-level column *outside* the tab content: a `col-md-3` rail
  beside a `col-md-9` tab container.
- Context specific to what is on screen right now stays inside that tab, as a `col-md-4`
  beside the `col-md-8` main content.

## Empty states

Every list or table panel needs an explicit empty state. Never let a real page render as a
bare, broken-looking table with no rows and no explanation.

```velocity
#if( $formatter.isEmpty($claims) )
    <div class="panel-body"><p>No claims have been submitted yet.</p></div>
#end
```

The message is a plain paragraph. Not `text-muted` - an empty state is the only content on
screen at that moment, so it is primary content.

## Self-contained macros

Velocity macros share the calling template's variable scope, so a macro that relies on the
caller having already set `$dm`, `$um` and friends "just works" by accident. Have each macro
`#set` its own `$services.*` shortcuts, so it does not silently break when called from a
different context or in a different order.

## Do not fabricate a metric

If a design asks for something the data model cannot back precisely (a settlement status the
app does not record, an SLA that is not configured anywhere), either compute the closest real
proxy and label it honestly - "Approved claims" rather than "Paid out" when there is no
separate settlement state - or omit it. Never render a plausible-looking number that is not
backed by anything.

## Resolve identifiers before displaying them

Resolve a stored slug, code or id to its human title before rendering it. An administrator
must never see an internal identifier.

For Velocity syntax itself, and the engine traps that silently break a template, use the
`kademi-themes` skill.

Reference: [Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md),
[DateManagerV1](https://docs.kademi.co/ref/templating/md/DateManagerV1.md).
