# UX standards

Kademi's UX standards. They apply to any screen you build - admin, website or shared.

The only principle anyone really needs: **do not build software that sucks.** As you build or
test something, stop and ask "does this suck?" If yes, change it until it does not.
Everything below is that idea made specific.

## The four hard rules

These are not style preferences. Breaking any of them is visible to every administrator who
uses your app.

### 1. Plain language, never a schema dump

An admin UI translates the domain into sentences and purpose-built editors. An administrator
must never see:

- an internal alias, key or slug
- a fully-qualified class name
- type jargon ("string", "enum", "boolean field")
- a raw JSON or tree view of a domain object where a form belongs

If a value is stored as an identifier, resolve it to the thing it names before displaying it,
and render it as a link to that thing where one exists. If a setting has three modes, build
three labelled options that say what each one does - do not expose the raw discriminator
field.

Bad: `expiryMode: CALC_PLUGIN` in a text input.
Good: a radio labelled **Calculated by a rule**, with the rule picker underneath and a line
of subtext explaining when the rule runs.

### 2. No page-specific stylesheets

Use Bootstrap and the shared theme classes. Do not add a CSS or LESS file per page. If a
layout need is genuinely new, it belongs in a shared class used by every page that has that
need - one fix then applies everywhere, and the product stays visually consistent.

### 3. Muted text is for subtext only

`text-muted` de-emphasises something that sits *beside* real content: a caption under an
input, a timestamp beside a name, a hint under a heading.

It is never correct for:

- **an empty state.** "No claims yet." is the only content on screen at that moment, so it is
  primary content. Use a plain `<p>`.
- **primary content** of any kind - a value, a title, a message the user must read.
- **anything inside a Bootstrap `.alert`.** An alert sets a colour on its contents and each
  theme picks its own; `text-muted` is a fixed grey that turns unreadable on themes that fill
  the alert solid. Use `<small><em>` instead - it de-emphasises and inherits the colour.

### 4. Confirm destructive actions, with context

A confirmation must say what is affected, not just ask. "Delete 137 users?" or "Delete sales
record 4471?" - never a bare "Are you sure?".

## Principles

- **UX0 - Be consistent.** Software is easiest to use when the same things are done the same
  way on different screens. Users learn something once and reuse it. Without consistency they
  relearn every screen.
- **UX1 - More important things are more prominent than less important things.** On landing,
  a user should immediately see what the page is for. On a page of users, the list and the
  search controls are obvious; secondary functions are less prominent.
- **UX1b - More commonly used things are more prominent than less commonly used things.**
  Prominence is a signal about what the user should do.
- **UX2 - Elements are aligned with the things they act on.** A delete button that deletes
  checked rows sits vertically aligned with the checkboxes, so it is obvious what it affects.
- **UX3 - Only show elements when it is reasonable to show them.** Hide a rarely used
  advanced section behind a link, and expand it only on request or when it already has
  values.
- **UX4 - Clutter is bad.** Too many elements on one page makes eyes glaze over. This is what
  UX3 prevents.
- **UX5 - Screens explain what things are and what they do.** Short explanatory text for the
  screen, for each section or panel, and for individual inputs. Use the `subtext` macro on
  elements, an intro panel for the screen, and paragraphs inside panels. For a complex area,
  include a prominent link to a tutorial.
- **UX6 - Use semantic colours** so users intuitively know what is dangerous, informational
  or positive. Apply it with UX1 in mind: a red button is very prominent, which is usually
  wrong for an infrequent action like delete.
- **UX7 - Use icons and/or text on buttons as appropriate.** Sometimes an icon alone is
  enough (a plus button to add a list item). Sometimes there is no commonly understood icon,
  so text is required ("Refresh points balances"). Both can make sense when there is room,
  but avoid clutter - per-row toolbar buttons in a table are icon-only.
- **UX8 - Confirm dangerous or destructive actions**, with context. See hard rule 4.

## Prominence

Prominence comes from a combination of:

- **Placement** - higher on the page is more prominent; top-left is highest.
- **Size** - larger is more prominent.
- **Colour** - bright colours like red and green are more prominent. This can conflict with
  UX6; see semantic colours below.
- **Hiding** - to *reduce* prominence, put content behind a muted "Show advanced" link.

## Semantic colours

| Colour | Meaning |
|---|---|
| **success** (green) | Positive, constructive actions - "Add user", "Send email" |
| **danger** (red) | Dangerous or destructive. Use rarely; it commands high prominence |
| **warning** (orange) | Something possibly problematic or unusual - a value unusually high, low or missing. Looks dodgy but is not necessarily wrong |
| **info** (blue) | Informational, neither good nor bad. Often used for tools |
| **default** (white with a dark border) | Nothing special; also used to make an infrequent action less prominent |
| **primary** (dark grey, white text) | An alternative to default |

Common cases:

- create or add: **success**, plus icon
- delete or remove: **default** - the *confirm dialog's* OK button carries the red
- tools: **info**

## Delete buttons

A red delete button has high prominence, which conflicts with UX1 because deleting is usually
neither common nor important. But a delete is almost always followed by a confirmation, and
it is the confirm button that actually performs the destructive act. So:

- **default** style on the initial delete button, **danger** on the confirmation's confirm
  button. (The two and three argument `Kalert.confirm` forms already default to a red confirm
  button, so you get this for free.)
- In admin pages, per-row delete buttons hidden and shown on hover are acceptable when the
  page would otherwise be messy.
- On list pages it is usually best to have row checkboxes plus a single delete button at the
  top - also default, given it has a confirmation.

## Buttons versus links

- **Button** style for actions (add a user, delete). Plain **link** style, no border, when
  simply linking to related data. There are exceptions.
- When using button style, always include an icon - it strongly signals the element is a
  button.

## Buttons: text, icon, or both

- Buttons always have an icon.
- Major actions for primary use cases get icon **and** text - prominence is justified, for
  example "Add user" on the manage-users page.
- If a button's purpose is not clear from its icon alone, it must also have text.
- Buttons inside a table are normally icon only.

## Button sizes

- Default size normally.
- `btn-lg` to add prominence, typically for the one main action on a page ("Send email" on
  the send-email page).
- `btn-sm` in specific situations - to match the surrounding page when copying its pattern,
  such as list-page tools buttons.

## Common buttons

| Action | Style | Icon | Text |
|---|---|---|---|
| add / create | success | `fa-plus` (or a plus-with-subject icon) | normally yes |
| delete / remove | default | `fa-times` | normally yes, unless per-row in a table |
| audit (link to audit records) | info | clock | no |
| save | success | `fa-save` | - |
| export | info | `fa-download` | if appropriate |
| import | info | `fa-upload` | if appropriate |
| help | - | use the `renderHelp` macro | - |
| settings | info | `fa-cog` | context dependent |
| refresh | info | `fa-refresh` | - |
| start | success | `fa-play` | - |
| approve | success | `fa-check` | - |
| decline / reject | danger | `fa-times` | - |

## Shared elements

These appear across many pages and must look identical everywhere, so render them with the
shared macro rather than by hand:

| Element | Macro |
|---|---|
| tables | `standardTable` |
| intro text panel | `renderIntroPanel` |
| time ago | `dateTimeAgo`, `timeAgo` |
| explanatory subtext | `subtext` |
| help link | `renderHelp` |
| pagination | `renderPaginator` |
| metric card | `renderDataPanel`, `renderStatPanel` |
| page notice | `renderActivityNotice`, `renderActivityItem` |
| search box | `standardSearchBox` |
| link to a core object | `$formatter.link($ob)` |

Also standardised: website selection, version selection, the read-only warning panel for a
repository, and the copy button for coded values.

Markup for each is in [page-patterns.md](page-patterns.md).

## Two kinds of page

Kademi has broadly two page types, and many rules apply to one or the other:

- **List pages** show a list of items to manage - users, organisations, products, points
  buckets.
- **Detail pages** show one specific item - a user, an organisation, a product.

### Data lists versus configuration lists

Do not use the same layout for both.

| | Data list (users, products, sales) | Configuration list (stores, groups, org types) |
|---|---|---|
| Volume | large | a handful, mostly permanent |
| Paging | pagination | simple scrollable list, no pagination |
| Search | search fields | optional inline client-side search |
| Bulk operations | yes - delete selected | no; each item has its own delete button |
| Panel | none, to maximise space | yes, usually a tabs container with the page title in the first tab heading |
| Item shape | one row per item | may span multiple rows, or be its own panel |

## Layout rules for list pages

Many elements are optional and depend on the page. Normally use the `standardTable` macro.

1. **Search input** - usually auto-searches after a short typing delay of about 400ms. Must
   have placeholder text and a clear button that re-executes the search when clicked.
2. **Filters** - where applicable, an easy way to filter on two or three main types. Semantic
   colours for enabled/disabled; default colour when no semantics apply; icon and text if
   there is a good icon.
3. **Page-level tools** - tools that do not apply to selected items, such as "Add user". At
   most one directly visible tool, in a semantic colour; put any others in a dropdown
   labelled "Tools". Dropdown items are text only, no icon.
4. **Summary stats** - icon, value, description. Only on some screens.
5. **Table content** - numeric values right-aligned including the column heading; everything
   else left. Use `table-striped`. When a column holds multiple values, use `label-*` so each
   is clearly separated. Informational links use plain link style, not buttons.
6. **Remove button**, **select-all checkbox**, **edit button column** and **row checkboxes**
   are all rendered by the macro.

## Layout rules for detail pages

Context dependent - many pages will not use tabs or every element here.

1. **Image** - show an applicable image for the product, user and so on. If there is none,
   consider an icon.
2. **Item title** - the item's title if it has one; otherwise construct one from its most
   significant properties.
3. **Tags** - informational elements: user-added tags, or high-level facts about the item.
4. **Tabs** - where a page has clearly differentiated sections, a tab layout can make sense.
   The first tab is often best as a summary of key stats.
