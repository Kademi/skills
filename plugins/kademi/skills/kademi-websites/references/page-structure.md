# Building a website page

A Kademi website page is not free-form HTML. It is a stack of containers with a fixed shape, and
that shape is the file format, not a house style: the drag-and-drop content editor reads exactly
this structure, and the server only renders a component when its placeholder is present.

---

## A page file is a complete HTML document

A page in a website repository is a whole document. The `<head>` names the template that supplies
the chrome around it; the container stack goes in the `<body>`.

```html
<html>
    <head>
        <title>Rewards Dashboard</title>
        <link rel="template" href="theme/page" />
    </head>
    <body>
        ... containers ...
    </body>
</html>
```

`href` is a template path with no `.html`: `theme/page` means `/theme/page.html`, and a bare
`user/dashboard` means `/theme/apps/user/dashboard.html`. Omit the `<link>` and the site's default
template is used.

When an author edits the page in the browser the editor sends back only what was inside `<body>`,
so the document wrapper is yours to write once and the editor's to preserve. Other tooling that
writes pages may describe a page body as a fragment with no doctype, `html`, `head` or `body` tags.
Both descriptions are right: the fragment is what goes inside `<body>`, and the file on disk is the
whole document that wraps it.

---

## The container, column and component tree

Every container is these four nested elements, in this order, and all four matter:

```html
<div class="container-bg background-for">
    <div class="container-layout container">
        <div class="container-content-wrapper">
            <div class="row">
                <div class="col-sm-12 col-md-12 col-lg-12" data-type="container-content">
                    ... components go here ...
                </div>
            </div>
        </div>
    </div>
</div>
```

- `container-bg` carries the container's own settings: background colour and image, shadow,
  padding, and who can see it. The editor writes these as `data-` attributes alongside matching
  classes, for example `data-brand-bgcolor="bgcolor-info"` with `bgcolor-info` in the class list.
  Both are written together; setting only one leaves the editor and the page disagreeing.
- `container-layout` sets the width. Add `container` for the normal centred page width,
  `container-fluid` for full bleed, or leave it as `container-layout` alone for a container nested
  inside a column.
- `container-content-wrapper` is where padding is applied.
- `data-type="container-content"` is what makes a column a column, and it is the single attribute
  the editor looks for. A column without it is invisible to the editor (see the repair rule below).

Use one container per band of the page rather than one for the whole page. A hero, a row of stats
and a row of detail panels are three containers. That is what lets an author restyle or reorder
each band on its own.

Columns are Bootstrap 3.4 and must total 12. Set `col-sm`, `col-md` and `col-lg` to the same number
unless you have a reason not to, and stay within the splits the editor itself offers: 12; 6+6; 4+8
and 8+4; 4+4+4; 3+6+3; 3+3+3+3. A container may be nested inside a column, which is how a band gets
its own inner grid.

---

## Placing a component

A registered component is rendered on the server from a template in the app that provides it. It
goes in as a wrapper element carrying the settings, holding an empty placeholder that names the
component:

```html
<div data-type="component-htmlPanel" data-bg="bg-primary" data-icon="fa fas fa-star"
     data-icon-size="fa-2x"
     data-html="&lt;h3&gt;1,250&lt;/h3&gt;&lt;p&gt;Points earned&lt;/p&gt;">
    <div data-dynamic-href="_components/htmlPanel" id="panel-points"></div>
</div>
```

Both halves are load-bearing.

- `data-type="component-<compId>"` on the wrapper is what the editor selects, and what its settings
  form writes to.
- `data-dynamic-href="_components/<compId>"` on the inner element is what makes the server render
  the component at all. Without it the component's template never runs, nothing appears where the
  component should be, and there is no error anywhere. Give the inner element a short `id` that is
  unique within the page.

Every setting is a `data-` attribute on the **wrapper**, never on the inner placeholder. Author-set
attributes arrive in the component's render template as camel-cased variables, so `data-show-title`
is `$showTitle`.

To find a component's real attribute names, look at the `<compId>Settings.json` file beside the
component's settings form in the app that provides it. It is a JSON array of
`{dataAttribute, label, type, options, description}`, and it is the only place the attribute names
are written down as data. If there is none, read the settings form's JavaScript, which is what
actually writes the attributes. An invented attribute name is one the component ignores in silence.

### Components that carry their own content inline

A second, smaller set of components is built into the editor rather than registered by an app.
These hold their content as child markup and take no placeholder:

```html
<section data-type="component-text">
    <h1>Rewards Dashboard</h1>
    <p class="lead">Everything you have earned this quarter.</p>
</section>
```

`component-text` is the one you will use most: it is how every heading and paragraph gets onto a
page. The editor's own built-in set also includes `accordion`, `audio`, `carousel`, `form`,
`googlemap`, `jumbotron`, `ksvgmap`, `media`, `slider`, `text`, `threedcarousel`, `thumbnail`,
`vimeo` and `youtube`.

Do not go by name alone: several ids exist in both worlds. `photo` is in the editor's built-in list
**and** is registered as a server component by the content library, and the registered one is what
a current site uses, so it needs `data-dynamic-href` and its settings rather than an inline `<img>`.
The reliable test is whether some installed app or library registers the id with `addComponent` and
ships a `<compId>Component.html` under its `theme/apps/<appId>/` folder. If it does, that is what
the site renders, and it needs the placeholder.

### When the component you need does not exist

Every server-rendered component comes from an app or a library, so "there is no such component" and
"this site does not have that app" look identical and mean completely different things. Libraries
ship with the platform and are always present; only apps get installed, and only apps go missing.

Name the app rather than building the thing out of something else. A table of hand-written rows in
place of a module list produces a page that looks finished and is connected to nothing, and nobody
can tell by looking.

---

## The editor repairs anything that does not match, and it is not undoable

When a page is opened in the content editor, every top-level element of the body is checked for a
`[data-type="container-content"]` descendant. Anything without one is treated as legacy content:
all of it is swept into a single synthetic container, as one `component-text` rich-text block,
**appended at the end of the page**. Loose text nodes at the top level get the same treatment, in a
second container of their own.

So a page whose markup does not follow the structure above does not merely lose its styling on the
author's first save. Every component in the non-conforming part becomes inert markup inside one
text block, and the block moves to the bottom of the page. There is no undo for it in the editor.

This is the reason the structure is worth getting exactly right even for a page you expect nobody
to edit.

---

## Laying a page out well

Open with one wide band that says what the page is: a heading, a line of context, and at most one
call to action. No numbers in it.

Then the measures, three or four across in a single container of equal columns. One number and a
short label each, with icons and background colours drawn from the same family so the row reads as
one set rather than as unrelated boxes.

Then the detail, in wider columns, two across or one full width. A table, a list, a chart or a query
result belongs here, never in the row of measures.

Worth holding to:

- Three or four measures, not seven. A row of stats is scanned, and past four nobody scans it.
- One idea per container. If a hero and a stat row are going into the same container, that is two
  containers.
- Prefer a component over hand-written markup wherever one exists. A component the client can
  configure is worth more than HTML they have to come back and ask you to change.
- Do not set spacing, colour or width in a `style` attribute when a component setting or a Bootstrap
  3.4 class does it. Bootstrap 3.4 means `img-responsive`, `pull-left` and `pull-right`, `panel-*`
  and glyphicons, not the idioms of later Bootstrap versions.
- A section that asks the reader to do something needs a button component to do it with. A closing
  "ready to get started" with no button is a dead end.
- Match a column's text to the image beside it. A short column next to a tall image leaves a band of
  empty page under the words: give that column more to say, put the image in its own full width
  container, or pick a size that fits what is there.
- Placeholder copy is still copy. Write the real sentences the client will edit, not scaffolding
  with "Placeholder:" in front of every paragraph, which is something they have to delete from every
  one of them.
- Colours, fonts and sizes belong to the site, not the page. When something should look different
  everywhere, change the LESS parameter rather than styling one page. See
  [theming.md](theming.md).
- A new page is reachable only by its URL until it is in the navigation. See the menu section of
  [theming.md](theming.md).

---

## A band that stands on its own

Not everything you write is a whole page. A message for one audience, an empty state, a "coming
soon": each of these is a single container dropped into a page somebody else composed, and none of
the advice above about heroes and rows of measures reaches them. They still have to look like
somebody wrote them.

`htmlPanel` is the component for this. It comes from the content library rather than an app, so
every site has it, and it gives you a coloured panel with an icon beside a body:

```html
<div data-type="component-htmlPanel" data-bg="bg-info" data-icon-size="fa-2x" data-width="55"
     data-html="&lt;h3&gt;Rewards are for referral partners&lt;/h3&gt;&lt;p&gt;Ask your account manager about joining.&lt;/p&gt;">
    <div data-dynamic-href="_components/htmlPanel" id="panel-no-rewards"></div>
</div>
```

Two things about it are not guessable.

- **A panel with no `data-html` renders the words "This is sample content"** onto the live page.
  That is the default the component falls back to, and it is the most common way a hand-built
  dashboard goes out wrong.
- **`data-html` is decoded with `decodeURIComponent` before it is rendered.** Ordinary HTML written
  as an escaped attribute value passes through unchanged, so the example above works. But a stray
  `%` in the text makes the decode fail, so if the copy contains a percent sign, URI-encode the
  whole value instead.

`data-bg` takes `bg-info`, `bg-primary`, `bg-success`, `bg-warning`, `bg-danger`, `bg-default` or
`bg-transparent`. The icon defaults to `fa fa-info-circle`.

Three parts, and the middle one is the one that goes missing:

- a heading naming the situation in the reader's terms, not the system's
- a sentence saying why they are seeing this and what would change it
- a way forward where one exists, a button component under the panel pointing at the page that
  changes it

What to avoid is the request's own words dropped in as the copy. One bare line alone in a container
does not read as a message anybody wrote, it reads as a section that failed to load, and the reader
concludes the site is broken rather than that the content is not for them. Putting a heading of
"Rewards availability" above that same line is the same failure with a label on top of it.

---

## Images

An image goes on a page as the photo component, not as a bare `<img>`:

```html
<div class="col-md-6" data-type="container-content">
    <div data-type="component-photo"
         data-photo-src="/assets/0814454a-314e-46da-8c96-21872ed0449d"
         data-photo-alt="Two colleagues comparing results on a tablet">
        <div data-dynamic-href="_components/photo" id="photo-hero"></div>
    </div>
</div>
```

- `data-photo-src` takes a path on this site. An image uploaded to the **Assets** library in the
  admin console has a path of the form `/assets/<id>`, which the library shows for each file; an
  image file committed to the website repository is referenced by its own path, and a file placed
  through the editor gets a content-hash path.
- **Always set `data-photo-alt`.** You know what the image is meant to show, and it is what both a
  screen reader and a failed image fall back to. Leave it empty only for purely decorative images.
- The component builds responsive sources by appending `/alt-<w>-<h>.webp` to the image path, which
  only this site can answer. An image hotlinked from another host therefore renders broken unless
  you also set `data-webp="false"`, which falls back to a plain `<img>`. Prefer an image on the site.
- Give each slot its own image. The same picture repeated down a page reads as a page nobody
  finished, and it is the first thing anyone notices.

---

## Reporting components on a page

Reporting content goes on a page through components that take a data source in `data-query`:

| Component | Shows |
|---|---|
| `queryTable` | rows in a table |
| `pieChart` | a breakdown as a pie or donut, from a terms aggregation |
| `dateHistogram` | a value over time, from a date histogram |
| `singleValue` | one prominent figure |
| `numUsers` | how many people are in a group |
| `selectedOrganisation` | the name of the organisation currently filtered to |

Two more are controls rather than content, and they act on every reporting component on the same
page: `dateRange` lets the viewer change the period, and `orgSelector` filters to an organisation.
A page of figures with no `dateRange` reports a fixed period the viewer cannot question, so add one
unless the period is deliberately fixed.

`data-query-type` says what kind of thing `data-query` names:

- `indexQuery` searches an index, returns rows, and can carry aggregations, so it can feed any of
  the components. This is the one to reach for.
- `queryTable` is rows produced by code, so it can express any logic at all. It has **no
  aggregations**, which means it can only ever be a table. Never point a chart or a single value at
  one.
- `query` is legacy. Do not use it, even though some components still list it.

Never guess a query name or an aggregation name. Both come from the account, both are set up in the
admin under reporting, and neither can be worked out from the subject matter. `data-agg` names an
aggregation defined inside the query you chose, and **an aggregation that does not exist renders an
empty chart rather than reporting an error**, so the page looks built and is silently blank. A terms
aggregation produces the buckets a `pieChart` needs; `sum`, `avg`, `max`, `min` and `count` produce
the one number a `singleValue` needs. A query with no aggregations can only be shown as a table.

There is also `reportingDashboard`, which renders a whole dashboard someone has already assembled in
the admin, selected by name in `data-dashboard-name`. See
<https://docs.kademi.co/blogs/docs-kb/the-reporting-dashboard-component-how-to-add-it-to-website-pages/>.
Use it when the client asks for an existing dashboard on a page; build a page out of the individual
components when you are laying the page out yourself.

If there is no query for what is being asked, say so rather than inventing one. A query is a
reusable definition of how the business measures something, and one made up to fill a gap on a page
will quietly disagree with the numbers the client sees everywhere else.

---

## KCode in a page

In a page body a kcode goes in a span, and the class matters as much as the attribute:

```html
<span class="kcode" contenteditable="false" data-kcode="currentUser/firstName">First name</span>
```

The platform's selector is `.kcode[data-kcode]`, so a span carrying only the attribute is never
substituted and simply renders empty. The text inside is what a person sees while editing the page,
so use something that reads as a label, like "First name", not a fake value that could be mistaken
for real data.

A kcode can also go inside a component setting that holds markup, which is how a stat panel shows a
live figure. `htmlPanel`'s `data-html` is the usual place, and the whole span is written escaped as
an attribute value there.

Pages are not evaluated while they are open in the content editor, by design, so an author sees the
kcode rather than its value. That is not a fault.

**An unresolved kcode renders as nothing and the platform removes the whole span it was in**, so the
label, the icon and the layout around it disappear with it and the page looks like it lost a
section. Nothing errors. Two specific traps:

- A path copied from a solution recipe containing a bracketed name, such as
  `pts_acc_[pointsBucketName]`. Those brackets are recipe parameters filled in at install time, and
  on a page they never resolve.
- A field id assumed because the name seemed obvious. Field ids are globally unique and often not
  what you would guess.

The catalogue of paths differs per account, because it depends on which apps are installed and on
the account's own data: there is a field per points bucket, per data series, per group. Take the
path from the KCode picker in the editor for the site you are working on rather than from memory or
from another site. See <https://docs.kademi.co/blogs/docs-kb/using-kcode/>.

---

## A worked page

A hero, then a row of stats. Two containers, the second abridged to one stat:

```html
<html>
    <head>
        <title>Rewards Dashboard</title>
        <link rel="template" href="theme/page" />
    </head>
    <body>
        <div class="container-bg background-for">
            <div class="container-layout container">
                <div class="container-content-wrapper">
                    <div class="row">
                        <div class="col-sm-8 col-md-8 col-lg-8" data-type="container-content">
                            <section data-type="component-text">
                                <h1>Rewards Dashboard</h1>
                                <p class="lead">Everything you have earned this quarter.</p>
                            </section>
                        </div>
                        <div class="col-sm-4 col-md-4 col-lg-4" data-type="container-content">
                            <div data-type="component-button" data-button-text="Refer someone"
                                 data-button-link="/referrals/refer/" data-button-color="btn-primary"
                                 data-button-size="btn-lg">
                                <div data-dynamic-href="_components/button" id="btn-refer"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="container-bg background-for">
            <div class="container-layout container">
                <div class="container-content-wrapper">
                    <div class="row">
                        <div class="col-sm-4 col-md-4 col-lg-4" data-type="container-content">
                            <div data-type="component-htmlPanel" data-bg="bg-primary"
                                 data-icon="fa fas fa-star" data-icon-size="fa-2x"
                                 data-display-type="icon" data-width="50"
                                 data-html="&lt;h3&gt;1,250&lt;/h3&gt;&lt;p&gt;Points earned&lt;/p&gt;">
                                <div data-dynamic-href="_components/htmlPanel" id="panel-points"></div>
                            </div>
                        </div>
                        <!-- two more columns of the same shape -->
                    </div>
                </div>
            </div>
        </div>
    </body>
</html>
```

A layout worth reusing can be saved as a snippet rather than copied between pages:
<https://docs.kademi.co/blogs/docs-kb/reusing-content-layouts/>. The reference for containers and
components in the editor itself is
<https://docs.kademi.co/blogs/docs-kb/components-and-containers-in-keditor/>.
