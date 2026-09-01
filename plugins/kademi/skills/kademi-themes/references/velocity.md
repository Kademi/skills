# Velocity in Kademi templates

Kademi renders HTML with the Java Velocity engine. Templates use the `.html` extension and live
under `admin/theme/`, `website/theme/` or `common/theme/` in an app, or in a website's own
`/theme/` folder.

`$name` is a reference. `#name` is a directive. The directives Kademi templates use are `#set`,
`#if` / `#elseif` / `#else`, `#foreach`, `#break`, `#macro`, `#parse`, plus a few Kademi-specific
ones listed at the end.

---

## Format these files by hand

Velocity directives are not HTML, and no general-purpose HTML formatter models them. Run one over
a template and it will:

- reflow `#if` / `#foreach` / `#end` lines as if they were text nodes, so a directive ends up
  inside a tag it was meant to wrap, or outside one it was meant to sit in;
- break `#macro` bodies apart, because the opening tag and closing tag of the markup a macro
  emits are frequently in different branches;
- collapse the significant whitespace between `#set` lines and the markup that follows;
- re-indent `#[[ ... ]]#` raw blocks, corrupting the client-side templates inside them.

The damage is silent - the file still parses, the page just renders wrong. Indent Velocity
templates manually and exclude `theme/**/*.html` from any automatic formatter you run.

---

## Every page template must be a complete HTML document

Templates rendered as pages - and any fragment `#parse`d into one - are loaded through a resource
loader that parses the file as an HTML document and hands Velocity **only the content of the
`<body>` element**. A file with no `<body>` yields nothing, and the request fails with:

```
IOException: Couldnt parse template file: <path>
```

The message names no cause. It almost always means a missing document wrapper.

So even a file that exists only to define macros needs the wrapper:

```html
<html>
    <head>
        <title>Blank</title>
    </head>
    <body>
        #macro( subtext $text )
            <small class="text-muted"><i>$!text</i></small>
        #end
    </body>
</html>
```

and is pulled in with `#parse("/theme/apps/myapp/my-macros.html")`.

**The exception:** KEditor component render and settings templates are rendered by a different
path that sends the file as-is. Those are plain fragments with no `<html>`/`<body>` wrapper - see
[components.md](components.md).

---

## Output escaping

Velocity does not escape anything. Whatever a reference evaluates to is written to the page byte
for byte.

```html
<!-- Wrong: raw, injectable -->
<input value="$name" />

<!-- Wrong: $! suppresses null, it does NOT escape -->
<div>$!userSuppliedContent</div>

<!-- Right -->
<input value="$formatter.htmlEncode($name)" />
<div>$formatter.htmlEncode($userSuppliedContent)</div>
```

Use `$!value` only for values you control. For a value going into an attribute, `htmlAttEncode`
is available; for a value going into a URL, `percentEncode`. All on
[Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md).

Never build a `href` or `src` from unencoded user input.

---

## Null and empty checks

Velocity's own truthiness is wrong for Java objects - an empty `List` is truthy. Use the
formatter helpers, which handle Java and Velocity types alike:

| Instead of | Use |
|---|---|
| `#if($x)` | `#if($formatter.isNotNull($x))` |
| `#if(!$x)` | `#if($formatter.isNull($x))` |
| `#if($x && $x != "")` | `#if($formatter.isNotEmpty($x))` |
| `#if(!$x \|\| $x == "")` | `#if($formatter.isEmpty($x))` |

`isEmpty` covers null **and** empty, and works on strings, collections and maps. `isNull` only
covers null.

---

## The #set null trap

In Velocity, `#set` with a right-hand side that evaluates to null **does nothing**. The variable
keeps whatever it had before. Inside a loop that means the previous iteration's value leaks into
this one:

```velocity
#foreach( $asset in $assets )
    ## WRONG - if this asset has no formats, $formats is still the last asset's formats
    #set( $formats = $formatMap.get($asset) )
    <td>$!formats.size()</td>
#end
```

Reset the variable to a known value first:

```velocity
#foreach( $asset in $assets )
    #set( $formats = false )
    #set( $formats = $formatMap.get($asset) )
    #if( $formats )
        <td>$formats.size()</td>
    #else
        <td>0</td>
    #end
#end
```

A `#foreach` is only the most obvious case. Any block that runs more than once on a page - a
macro called several times, a row of summary cards built from repeated markup - carries the
skipped variable over the same way, so one card ends up displaying the neighbouring card's
number. Initialise every such variable to a known empty value (`#set( $total = "" )`) before the
assignment that can be skipped, and test it with `$formatter.isNotEmpty($total)` rather than
trusting it was set.

---

## Operators only work as a whole right-hand side

Velocity's parser accepts `+ - * /` and `&& || !` only as the entire right-hand side of a plain
`#set`, or as the whole condition of an `#if`. Inside a method-call argument they are a lexical
error and the page fails to render:

```velocity
## WRONG - lexical error, not a runtime error
$formatter.toInteger($amount * 100)
$formatter.ifTrue($formatter.isNull($x) || $formatter.lt($x, 50), "low", "ok")
```

Hoist the expression into its own `#set`, or express it with formatter helpers:

```velocity
#set( $cents = $amount * 100 )
$formatter.toInteger($cents)

$formatter.lt($formatter.firstNotNull($x, 0), 50)
```

---

## Method calls print their return value

A bare `$list.add("x")` writes `true` into the page. `$map.put("k","v")` writes the previous
value. Wrap side-effecting calls:

```velocity
#set( $opts = $formatter.newMap() )
$formatter.call($opts.put("status", "open"))
$formatter.call($opts.put("applyFilters", true))
#set( $result = $services.myService.search($opts) )
```

`$formatter.newMap()` gives a `LinkedHashMap`, which server-side JavaScript reads with plain
property access (`opts.status`).

Pass typed values, not strings that look like lists. If a service does `list.contains(x)` and you
hand it the string `"alpha,beta"`, Java's `String.contains` substring-matches and
`"alpha,beta".contains("alph")` is true. Convert first with `$formatter.fromCsv($csv)`.

**A call Velocity cannot match to any method signature evaluates to null - silently.** There is
no error on the page and no log entry; the reference simply renders as nothing, or the `#set` it
feeds is skipped. Whenever a service call comes back null for no apparent reason, suspect the
argument types before you suspect the data: one argument too many, a string where the method
wants a number, or a Velocity list where it wants a Java one. Look the method up - the
**kademi-api-reference** skill, or
[Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md) directly - and match the
signature exactly.

**`.size()` needs a real Java collection.** Call `$formatter.toList($x).size()` unless you are
certain `$x` is already one - wrapping a list that is already a list is harmless, and calling
`.size()` on something that is not gets you the silent null above.

---

## Macros

```velocity
#macro( statusBadge $status )
    #if( $status == "open" )
        <span class="label label-success">Open</span>
    #else
        <span class="label label-default">$formatter.htmlEncode($status)</span>
    #end
#end

#statusBadge($item.status)
```

A macro that wraps a body is defined with `$bodyContent` and called with `#@name(...)` ... `#end`:

```velocity
#macro( panel $title )
    <div class="panel panel-default">
        <div class="panel-heading">$formatter.htmlEncode($title)</div>
        <div class="panel-body">$bodyContent</div>
    </div>
#end

#@panel("Recent orders")
    <p>Orders placed in the last 30 days.</p>
#end
```

**Macros have no scope of their own.** Every `#set` inside a macro body writes into the calling
template's context and stays there after the macro returns. Two consequences, both silent: a
macro can overwrite a variable the page was already using, and the same macro called twice on one
page starts its second call holding the first call's values - which, combined with the `#set` null
trap above, is how a macro renders the previous row's data. Give macro-internal variables a
distinctive prefix (`#set( $badge_label = ... )`) and reset every one of them at the top of the
macro body.

Write a macro when it has more than one call site. A macro called once is indirection for
nothing - the exception is a page that renders several alternative views, where one macro per
view reads better than a long `#if` chain.

Macros are resolved per template, so `#parse` the file that defines them before you call them.

---

## Escaping Velocity itself

Client-side template libraries use `${...}` and collide with Velocity. Wrap them in a raw block:

```velocity
#[[
<script type="text/html" class="rowTemplate">
    <tr><td>${name}</td><td>${total}</td></tr>
</script>
]]#
```

Everything between `#[[` and `]]#` is emitted verbatim.

---

## Values arriving from server-side JavaScript

Data prepared by an app's server-side JavaScript reaches the template as JavaScript values, and
two of them do not behave the way the template expects.

**Numbers arrive as doubles.** A counter incremented in JavaScript renders as `4.0`, not `4`.
Fix it where the value is produced, not at every call site: return
`formatter.toInteger(count)` from the server-side code, so every template that reads the value
gets an integer.

**A plain JavaScript object is not a map.** The template can read `$obj.propName`, but
`$obj.get($key)` - indexing by a key only known at render time - returns null. If a template will
look values up by a runtime key, build the value server side with `formatter.newMap()` and
`.put(key, value)` so it crosses over as a real Java map.

---

## Strings, quoting and the literal $

Velocity parses **double-quoted** string literals: `$references` are interpolated, and anything
starting with `#` is treated as a directive. So a URL fragment inside a double-quoted string is a
trap:

```velocity
## WRONG - #points-tab is parsed as a directive
#set( $link = "/points/?user=$userId#points-tab" )
```

**Single-quoted** literals are not parsed at all. Put the fragment in one and interpolate it:

```velocity
#set( $hash = '#points-tab' )
#set( $link = "/points/?user=$userId$hash" )
```

`$formatter.formatCurrency($x)` returns the formatted decimal number only - no currency symbol.
The convention is a literal `$` written immediately before a null-suppressed call, which renders
as `$1,250.00` and as `$` alone when the value is null:

```velocity
$$!formatter.formatCurrency($order.total)
```

The four-argument overload,
`$formatter.formatCurrency($order.total, "$", "before", 2)`, attaches the symbol itself when you
need the symbol to come from a setting rather than from the markup.

---

## Page titles

On admin pages the `<title>` tag is read out of the template **before** the body renders, so
`#set` variables and page attributes are not available inside it. Put a static title in the
template and set a dynamic one from the controller instead.

---

## Security

- Read request parameters through a
  [FormContext](https://docs.kademi.co/ref/templating/md/FormContext.md)
  (`$formatter.newFormContext()`, then `cleanedParam` / `dateParam`), never off the raw request.
- Never use global scope variables. An app instance is shared across accounts, so a global leaks
  data between them.
- Do authorisation checks in server-side code, not in the template. Hiding a link is not access
  control.
- Always handle the absent case explicitly. A missing value is the normal case, not an error.

---

## Performance

- Resolve services once, at the top: `#set( $dm = $services.dateManagerV1 )`. A lookup repeated
  per loop iteration is a lookup per row.
- Format dates with [DateManagerV1](https://docs.kademi.co/ref/templating/md/DateManagerV1.md),
  not with date functions on `$formatter`, so output follows the account's configured pattern.
- Page any list that can grow. `$formatter.paginator()` returns a
  [Paginator](https://docs.kademi.co/ref/templating/md/Paginator.md):

  ```velocity
  #set( $paginator = $formatter.paginator().pageSize(20).skipToStart(false).totalRecords($total) )
  #foreach( $row in $paginator.records($rows) )
      ...
  #end
  ```

---

## Kademi directives

Beyond standard Velocity, these are available in templates:

| Directive | What it does |
|---|---|
| `#renderComponent("compId")` | renders a registered KEditor component inline, outside the page builder |
| `#renderComponent("compId", "a=1; b=2")` | same, passing attributes as `name=value` pairs separated by `;` |
| `#portlets("sectionName")` | renders every portlet apps have contributed to that named section |
| `#appSettings($appId)` | renders an app's settings form; used by settings screens |

---

## Cross-references

- Server-side code that prepares the data, and the controllers a template's forms post to:
  **kademi-server-js**.
- Admin screen layout, tables and UX conventions: **kademi-admin-ui**.
- Any class or method you are about to call: **kademi-api-reference**, or
  <https://docs.kademi.co/ref/templating/md/Formatter.md> directly.
