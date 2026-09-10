# Showing content to some people and not others

Targeting restricts who sees a **container** on a page. It is written on the `container-bg`
element, the outermost of the four divs every container is made of, and the server evaluates it when
the page is served and **removes** the container when it does not match. Everything nested inside
goes with it: components, and any container nested in a column.

Nothing about this is visible in the content editor, because pages are not evaluated while they are
being edited. A rule you get wrong is not something anybody sees until the page is live and someone
is looking at it, or more often until somebody reports that a section is missing.

---

## The audience attributes

```html
<div class="container-bg background-for"
     data-groups="goldPartners,platinumPartners"
     data-excluded-orgtypes="internal">
```

| Attribute | Effect |
|---|---|
| `data-groups` | comma separated group **names**. The container is removed unless the viewer is in one of them |
| `data-excluded-groups` | removed if the viewer is in one of them |
| `data-orgtypes` | the same as `data-groups`, by organisation type |
| `data-excluded-orgtypes` | the same as `data-excluded-groups`, by organisation type |
| `data-visibility="Anonymous"` | shown only to logged out visitors |
| `data-visibility="hidden"` | hidden from everyone, which is how an author parks a section without deleting it |

An empty attribute means no rule. Pages written by the editor carry all of them with empty values,
which is normal.

### How they combine

The editor presents these as one flat list and the server does not evaluate them that way.

- **Exclude beats include.** The excluded checks run separately and remove the container regardless
  of what the include rules said.
- **Includes are ANDed across the two dimensions.** Within `data-groups`, any one group matching is
  enough. But `data-groups` and `data-orgtypes` are separate passes, so a container carrying both is
  shown only to someone who is in one of the groups **and** in one of the org types. If you mean
  "gold partners or any dealer", this is not what writes it.

### Names come from the account, never from memory

Group and organisation type names are per account, and the **name** is not the title shown in the
UI. "Gold Partners" is a title; the name is whatever that account happens to use. Read the name off
the group's own record in the admin console, or set the audience once through the editor's audience panel on
a throwaway container and copy the attributes it writes.

### One legacy attribute worth recognising

`data-availability="notavailable"` **inverts** `data-groups`, from "only these groups see it" into
"these groups do not see it". The editor drops the attribute whenever an audience is edited, so you
will only meet it on older pages. If you read `data-groups` on a page that has it and take it at
face value, you have the audience exactly backwards. Prefer `data-excluded-groups`, which is what is
written now.

You may also see `data-visibility-mode`. That is the editor remembering which card the author
clicked; the server never reads it. Do not write it, and the editor works out the right card from
the rules themselves.

---

## Advanced visibility: a rule built on a kcode

Three attributes on the same `container-bg`:

```html
<div class="container-bg background-for"
     data-vis-kcode="currentUser/pts_acc_points/pts_bal"
     data-vis-comparator="isNotEmpty">
```

- `data-vis-kcode` is a kcode path. The `*|...|*` markers are tolerated but add nothing.
- `data-vis-comparator` is one of exactly these, and the spacing and casing are not guessable, so
  copy them:

  ```
  equals        not equals        matches        not matches        empty        isNotEmpty
  ```

- `data-vis-value` is what to compare against. Required for every comparator **except** `empty` and
  `isNotEmpty`, which test the kcode on its own.

`matches` is not a strict regular expression test: the server tries the value as a regex and also
accepts a plain substring, so `matches` with a value of `gold` is true for `goldPartner`.

The kcode is evaluated exactly as one on a page is, so it comes from the KCode picker for this site
and it resolves against the same context. See the KCode section of
[page-structure.md](page-structure.md).

---

## The two silent failures, which run in opposite directions

This is the part worth remembering, because the failure is invisible either way and the two are not
equally bad.

**A wrong group or org type name fails closed.** Nothing matches, the container is removed, and
every visitor sees a page with a section missing. It looks like the page lost something rather than
like a rule being wrong, and there is no error anywhere.

**A malformed kcode rule fails open.** The server applies the rule only when the comparator matches
one of the six spellings above and, unless it is `empty` or `isNotEmpty`, a value is present. Get
either wrong - a typo in the comparator, a missing value - and the rule is skipped entirely and the
container is shown to **everyone**. Content that was meant to be restricted is then public, and the
page looks completely normal.

So check the comparator spelling and the value against the list above every time, and never target
content on a kcode you have not seen resolve.

Targeting a container is also not a security boundary for anything that matters. It decides what is
rendered, not what a person may reach. Page-level access control is a separate thing:
<https://docs.kademi.co/blogs/docs-kb/web-page-permissions/> and
<https://docs.kademi.co/blogs/docs-kb/managing-website-access/>.

---

## Hiding a container on some screen sizes

A separate axis, and the only thing here that is not about who the viewer is. The editor's device
visibility panel toggles the four Bootstrap 3.4 breakpoints - `xs` phones, `sm` tablets, `md`
laptops, `lg` desktops - and writes the state in two places at once:

```html
<div class="container-bg background-for hidden-xs hidden-sm" data-br-rules="hidden-xs,hidden-sm">
```

- the `hidden-{bp}` **class** is what actually hides it
- `data-br-rules` is the same list as a comma separated attribute, and is what the editor reads back

Write both, and keep them identical. The class on its own hides the container correctly but the
panel shows it as visible on every size, and it also lands in the container's extra classes field
where the next author to edit that field can drop it. The attribute on its own does nothing at all.
Older content states the same thing the other way round, as `visible-{bp}` classes with a matching
`data-br-rules`; either form works as long as the class list and the attribute agree.

Unlike everything else on this page this is CSS, so the container is still in the page: hidden by a
media query, not removed by the server. It is not a boundary of any kind. The content is in the
source for anyone to read, and a component inside it still runs and still loads its data. Use it for
layout, for the wide table or the decorative band that does not work on a phone. Anything that must
not **reach** someone needs an audience rule.

Turning all four off is a container that displays nowhere. The editor says so; nothing else will.

---

## Writing a page that is partly targeted

Put the targeted material in its own container. One container per audience, rather than one
container carrying a mix and a rule that can only be right for some of it. That is also what lets an
author see the audience in the editor, which shows a badge on each container that has one.

Restricting a container almost always creates a second job: the version for the people outside the
audience. That is its own container carrying the opposite rule, `data-excluded-groups` where the
first had `data-groups`, and it is a real part of the page rather than a footnote to the rule.

It is the half that gets done badly, because the request describes it in one breath and it sounds
like configuration. "Show everyone else a message saying rewards are not available" is a sentence
about the rule; taken at its word it produces one line of text alone in a band, which on a page
built out of components does not read as a message anybody wrote. It reads as a section that failed
to load, so the reader concludes the site is broken rather than that the content is not for them.
Build it like content: a heading, a sentence saying what would change it, and a link when there is
somewhere to send them. See the panel section of [page-structure.md](page-structure.md).

When a page is targeted at all, say so when you hand it over: which container, which audience, and
what someone outside that audience sees instead. A page that renders differently for different
people is the kind of thing an administrator needs to know they now have.
