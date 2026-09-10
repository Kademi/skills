# Multi-language websites

An organisation makes a set of languages available. Every request then resolves to one active
language code, and two independent mechanisms turn that into translated output:

- **Marked-up text.** Any element in the rendered page carrying `class="trans-lookup"` has its
  text replaced with the stored translation for the active language, server-side, as the page
  renders.
- **Per-language page files.** A sibling file named `<page>-<langCode>.html` is rendered in place
  of the page when that language is active.

Stored text is managed by
[TranslationService](https://docs.kademi.co/ref/templating/md/TranslationService.md), registered
as `translationService`. A language is a
[Language](https://docs.kademi.co/ref/templating/md/Language.md) (a code and a title); one
translated string is a
[Translation](https://docs.kademi.co/ref/templating/md/Translation.md) (source type, source id,
source field, language code, translated text).

## Making languages available

**In the admin console**, at **Content > Translations**, then **Tools > Manage Languages** (the
page at `/languages` on the admin domain). A language is a **Title** shown to users and a
**Code** used for matching. Use the standard two-letter code: machine translation and
`Accept-Language` matching both key off it. This is account configuration, not a file, so there
is nothing to sync and nothing to declare in a theme.

Two other places set language, both also in the admin console and both also not files:

| Setting | Where | What it does |
|---|---|---|
| Website default language | the website's branch page, **Default language** panel | the language used when the visitor has expressed no preference |
| A person's language | the profile's `language` field, which the profile-details component also exposes on the website | the preference used for a logged in visitor |

## Which language a request is in

`$services.translationService.selectedLangCode` (also `$rootFolder.selectedLangCode`, and
`$rootFolder.selectedLanguage` for the [Language](https://docs.kademi.co/ref/templating/md/Language.md)
itself) resolves the active code once per request, in this order. The first non-blank one wins:

1. a `selectedLangCode` **query parameter**
2. a `selectedLangCode` **cookie** - this is what the language switcher sets
3. the logged in **profile's** language preference
4. the **website's default language**
5. the browser's **`Accept-Language`** header, matched against the organisation's configured
   languages

**If all five are blank the code is null and no translation happens anywhere.** Every page
renders its source text, no `.trans-lookup` element is touched, no page variant is looked for and
no rows are created. A site that appears not to translate at all, on every page, has usually
resolved no language rather than lost its translations: check that the website has a default
language set, or select one explicitly with `?selectedLangCode=fr`.

The order also explains a support report that a person "cannot change language": a
`selectedLangCode` query parameter left in a bookmarked URL outranks both the cookie and their
profile preference on every visit.

## Marking text for translation

Put the class on the element holding the text:

```html
<span class="trans-lookup" data-transcode="page-size">Page size</span>
<h4 class="modal-title trans-lookup" data-transcode="resend-verification">Resend verification link</h4>
```

The class is what triggers the lookup; the element can be anything. Three attributes control the
key, and only the first is normally worth setting:

| Attribute | Default | Meaning |
|---|---|---|
| `data-transcode` | the element's `for` attribute | the field key for this string |
| `data-transtype` | `label` | the source type |
| `data-transid` | `labels` | the source id |

So a plain `data-transcode="page-size"` stores and looks up the translation of source type
`label`, source id `labels`, field `page-size`. Keep the code stable and descriptive: it is the
identity of the string, and changing it orphans every translation already written against it.

With no `data-transcode` and no `for`, the element's own text is hashed and looked up by content
instead, so identical wording anywhere on the site shares one translation. That is convenient for
prose and wrong for short words that translate differently in different contexts. Prefer an
explicit code.

**A `<select>` marked `trans-lookup` translates each `<option>` individually**, using each
option's own `data-transcode`. `$formatter.option(...)` already emits options with the class and a
generated code, so selects built with it translate without any extra markup - see
[Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md).

**`placeholder` and `alt` are translated too** on any element already marked `trans-lookup`. A
form control's placeholder is keyed `<input name>-placeholder`; an image's `alt` is keyed by its
`src` under the source id `alt-tags`. An input with no `name` gets no placeholder translation.

### What happens when there is no translation yet

The element is left showing its source text. Nothing is logged and nothing breaks.

Additionally, **if the person viewing the page can author content on that website's branch, the
missing row is created for them**, with the source text copied into the translated field. This is
the intended authoring loop: select a language, browse the site as a content author, and the
strings you passed through appear in **Content > Translations** ready to be edited. A visitor who
cannot author creates nothing, so a string nobody with authoring rights has ever viewed in that
language will not be in the list.

## Per-language page files

When a language is active, the page resource looks for a sibling file with the code inserted
before the extension, and renders that file's body instead if it exists:

```
/about.html        the source page
/about-fr.html     rendered instead whenever fr is the active language
```

The **template comes from the page that was requested**, not from the variant, so the variant only
needs the body. There is no error and no notice when a variant is absent: the original page is
rendered, which is the correct behaviour but also means a typo in the file name looks exactly like
"no translation for this page yet".

Use this for pages whose whole layout differs by language. For pages that are the same layout with
different words, marked-up text is far less to maintain.

## The language switcher

The menu components ship one. It is a component setting, `data-show-lang-selector` on the menu
component ("Language selector" in the settings panel). It renders the configured languages and,
via a script the content library already declares, writes the chosen code into the
`selectedLangCode` cookie and reloads. There is nothing to declare in a theme for it to work.

To build your own, the whole contract is that cookie:

```html
<ul class="navbar-lang-selector">
    <li><a class="select-lang" href="">Default</a></li>
    #foreach( $lang in $rootFolder.languages )
        <li><a class="select-lang" href="$lang.code">$formatter.htmlEncode($lang.title)</a></li>
    #end
</ul>
```

The stock script binds `.select-lang` inside `.navbar-lang-selector`, takes the code from `href`,
sets the cookie for a year at path `/`, and reloads. An empty code clears the selection and falls
back to the profile preference or the website default. A plain link to `?selectedLangCode=fr`
also works and is useful for testing, but remember it then outranks the cookie for as long as it
stays in the URL.

## Translating data your app renders

Marked-up text covers static wording. For a record's own fields, ask the service, giving it a
source type and the record's id:

```velocity
#set( $ts = $services.translationService )
$ts.translateWithDefault("Product", $product.id, "notes", $!product.notes)
```

The methods worth knowing, all on
[TranslationService](https://docs.kademi.co/ref/templating/md/TranslationService.md):

| Call | Returns |
|---|---|
| `translateWithDefault(type, id, field, defaultText)` | the translation, or `defaultText` when there is none. **Use this one in templates.** |
| `translate(type, id, field)` | the translation in the active language, or **null** |
| `translate(type, id, field, langCode)` | the translation in a named language, or null |
| `translateText(sourceText)` | the translation matched by content hash, or `sourceText` unchanged |
| `setTranslation(langCode, sourceText, type, id, field, translation)` | stores or updates one translation |
| `searchTranslations(langCode, type, id, field)` | every matching translation; blank filters match anything |
| `getLanguages()` | the organisation's languages |
| `isTranslationAuthor()` | whether this profile may author translations here |

The source type is a plain string chosen by whoever wrote the translation, not a validated class
name, so it has to match exactly what created the row. Pick one for your app and use it
consistently.

`translate` returning null is the reason to prefer `translateWithDefault`: an unguarded
`$ts.translate(...)` in a template prints the literal expression, and `$!ts.translate(...)` prints
nothing at all, so a missing translation blanks the field instead of falling back to the original.

## Strings built in browser JavaScript

Text a script builds at runtime is not in the HTML when the server translates it. The content
library provides a client-side dictionary for that case:

```javascript
var label = $.jsTranslation.translate('save-changes', 'Save changes');
```

It reads from a dictionary of source type `jsLabel` that the page either inlines or fetches from
`/translation-manager/load-translations` and caches in `localStorage` for 24 hours. Two
consequences: a translation edited in the admin console can take up to a day to appear for a
visitor who has already loaded the site, and a script that registers new keys only does so while a
translation author is browsing.

Server-rendered markup is always the better option when you have the choice. Reach for this only
for strings that genuinely do not exist until the browser builds them.

## AI translate and correct

The page editor has an **AI translate & correct** action. It queues a background job that reads
the page's HTML, identifies the translatable text, optionally corrects spelling and grammar, wraps
newly-found text in `.trans-lookup` spans keyed by content hash, and generates translations into
the configured languages using the account's configured model. Track it under background tasks;
the page is rewritten in place when it finishes, and the website's version history can revert it.

What it will not do, which is what makes it safe to re-run: component structure and attributes are
never modified, anything inside a component placeholder or component data element is skipped
entirely, and text already wrapped as a `.trans-lookup` span is neither re-corrected nor
re-wrapped. A second run only backfills languages that have no translation yet, so a translator's
manual edits survive it.

## Bulk editing

**Content > Translations** in the admin console lists every translation for the organisation,
filtered by language and source type, with export to CSV and import back. That page is also where
a missing translation is fixed once the string has appeared in it.

## Gotchas

- **No resolved language means nothing translates, anywhere.** With no query parameter, cookie,
  profile preference, website default or matching `Accept-Language`, the active code is null and
  the whole mechanism is inert. See the resolution order above.
- **`trans-lookup` on an element with child elements destroys them.** The lookup replaces the
  element's entire text content, so a `<div class="trans-lookup">` wrapping a heading and a
  paragraph collapses to one string. Put the class on the leaf element that holds the words.
- **The lookup pass needs at least one component on the page.** Translation of marked-up text
  happens during the same render pass that expands components, and that pass exits early when the
  rendered HTML contains no element with `data-dynamic-href`. A page built entirely from
  hand-written markup, with no component anywhere in it or in its theme template, silently renders
  its source text however it is marked up. Most sites are unaffected because the menu is a
  component.
- **Changing a `data-transcode` orphans its translations.** The code is the identity of the
  string. Renaming one leaves the old rows in the list against a key nothing renders, and the new
  key starts empty.
- **A missing per-language page file looks exactly like a missing translation.** No error is
  raised; the original page renders. Check the file name against `<page>-<langCode>.html`.
- **A stale `selectedLangCode` query parameter beats the cookie and the profile.** It is first in
  the resolution order, so a bookmarked or shared URL pins the language.
- **Client-side labels are cached in the browser for 24 hours.** An edit made in the admin console
  will not appear immediately for a visitor who already has the dictionary.
- **Only content authors seed missing rows.** If a string never appears in the Translations list,
  the likely reason is that nobody with authoring rights has viewed the page with that language
  selected.

## Not covered here

Translated **emails** and **product** catalogue text use the same service and the same rows, but
the code that reads them lives in server-side app code rather than in a theme. The service is the
same object under the same name; only the source type and id differ.
