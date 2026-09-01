---
name: kademi-api-reference
description: Use whenever a Kademi platform class, service, manager, builder, entity or method needs to be confirmed before it is called or reviewed - services.*, formatter.*, controllerMappings.*, a manager or builder method, or a property on an entity. Kademi server-side JavaScript and Velocity dispatch dynamically into Java, so a method that does not exist fails only at runtime, when that line runs. Look it up first. Use when choosing which manager or builder does a job, when a call throws "is not a function", when a property comes back undefined or null for no clear reason, when checking argument order or return type, and when the task is known but the class name is not.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: api reference

## Why this matters

Kademi's server-side JS calls into Java objects dispatched dynamically. A method that does not
exist is not caught by any linter - it throws `TypeError: <name> is not a function` at runtime,
only when that code path runs. A property that does not exist is not an error at all: it is
`undefined`, and the bug surfaces later as an empty email or a blank column.

So: **confirm a member exists, and check its arguments and return type, before you call it.**
Do not guess a method name from the Java naming you would expect. Real signatures in this API
include `emailBuilder()` (not `newEmailBuilder`), `addAttachement(...)` (with that spelling),
and `surName(...)`. You will not get these right by inference.

## The reference

Public, no login, one plain-text Markdown file per class:

| What | URL |
|---|---|
| Index of every documented class | `https://docs.kademi.co/ref/templating/md/index.md` |
| One class | `https://docs.kademi.co/ref/templating/md/<ClassName>.md` |
| The same thing as HTML, for humans | `https://docs.kademi.co/ref/templating/` |
| A method, deep-linked for a human | `https://docs.kademi.co/ref/templating/<ClassName>.html#<methodName>` |

`<ClassName>` is case-sensitive and takes no package prefix: `Lead.md`, `UserManager.md`,
`EmailItemBuilder.md`. Overloads get numbered HTML anchors: `#toBool`, `#toBool-2`.

The index currently lists about 1350 classes in 38 sections, and is roughly 226KB. Class pages
range from a few KB to over 100KB (`Formatter.md` and `UserManager.md` are the big two).

Do this with your own fetch and read tools. There is nothing to install and no script to run.

## The lookup procedure

1. **Fetch the index once per session** and keep it. Do not re-fetch it for every class.
2. **Do not read the index end to end.** It is far larger than any answer you need. Search
   within it:
   - Known class name: look for `- [ThatName](ThatName.md)`.
   - Unknown class name: jump to the `## <Section>` heading that matches the task (see below)
     and read only that section's bullets. Each bullet is `- [Name](Name.md) - one line summary`,
     alphabetical within its section, and every name is unique across the whole index.
   - If your fetch tool takes a query or prompt, pass the task or the class name so only the
     relevant part of the index comes back.
3. **Fetch only the class pages you actually need**, by exact name. One or two, not ten.
4. **Read the page** (anatomy below) and confirm the exact spelling, the parameter list and the
   return type before you write the call.
5. **Follow the return type.** If it is a link, that class has its own page - fetch it when the
   next call in your chain lands on it.
6. **Follow `Extends:`** when the member you want is not on the page. See "Inherited from" below.

### If a class page 404s

The server returns an HTML error page whose title is `404 | Error page`, not a Markdown 404.
If what comes back is HTML, or does not start with `# ClassName`, that file does not exist.
Do not try three more spellings. Go back to the index and search it for the name - if it is
not in the index, it is not in the reference, and "What is not in the reference" applies.

## Finding the right class when you only know the task

This is the hard case, and the section grouping is what solves it. Pick the section that
matches the *shape* of the task, then scan that section's one-line summaries.

| The task sounds like | Section to scan |
|---|---|
| "do something" - send, create, find, award, charge, import | **Managers** |
| "construct something with lots of optional parts" | **Builders** |
| "what fields does this record have" | **Database Entities** |
| "react to something happening" | **Events**, **Journeys** |
| "step in a journey / funnel automation" | **Journeys** |
| "who is allowed to do this" | **Roles** |
| "run at sign-in, block or challenge a request" | **IDP Rules** |
| "return a response from a controller" | **Views** |
| "query or report on data" | **Queries**, **Tables**, **Reports**, **Search** |
| "import or export a file" | **Pipeline Steps**, **Pipelines**, **Database Table Providers**, **Table Uploads** |
| "register something from my app" | **App Definitions**, **Applications** |
| "a bean, a DTO, a result wrapper" | **Other** |

Read **[references/index-sections.md](references/index-sections.md)** when you know the task but
not the class name and the table above does not settle which section to scan. It lists every
section, what it covers and representative classes, which usually answers the question without
fetching the 226KB index at all.

Two shortcuts worth remembering:

- **Managers hold the verbs.** Almost every "how do I do X" answers to a class in Managers, and
  the class description names the variable it is reached by - `UserManager` says "Registered as
  'userManager'", `EmailManager` says "reached from server-side JS as services.emailManager".
  That is how you resolve a `services.*` name you half-remember, and how you find the name for
  a manager you have just found by task.
- **Builders are reached from managers.** A builder page says where it comes from in its first
  paragraph ("Obtained from userManager.newProfileBuilder"). If you have found a builder, you
  have also found the manager call that hands it to you.

## Reading a class page

A page carries: the class name, a one-line summary, prose documentation, a metadata block
(`Package:`, `Group:`, `Extends:`, `Implements:`), a `## Properties` table, a `## Methods` section
with one `###` heading per overload, and at most one `## Inherited from <Superclass>` block.

Things to actually use when you read it:

- **The prose is the contract.** The description says when a value is null, whether the call hits
  the database on every access, whether it soft-deletes, and which other call to prefer. Read it.
  `Lead.fields` says "use getFieldValue/setFieldValue rather than manipulating this directly".
- **Properties and Methods overlap.** A bean property `leadTeams` is the same thing as the method
  `getLeadTeams()`, and it may be listed in both places. From Velocity and JS you can use either
  form. If a name is missing from the Properties table, check the Methods list before concluding
  it is absent.
- **A linked type has its own page; a backticked type does not.** `[FunnelRepository](FunnelRepository.md)`
  is documented, `` `Organisation` `` is not. Inside generics the link is nested:
  `List<[LeadParticipant](LeadParticipant.md)>`, `Map<String,[Role](Role.md)>`. A fully plain
  generic like `` `List<Organisation>` `` means the element type is undocumented. Use this as a
  fast test for whether it is worth fetching the next page.
- **Overloads are separate headings.** Match the one whose parameter list you can actually supply.
  `checkValidPassword(String, Profile)` and `checkValidPassword(String, Profile, Narrative)` are
  two entries.
- **"Inherited from X" is one level.** A page shows the members it declares plus a single
  "Inherited from" block for its immediate superclass. If that superclass has its own `Extends:`,
  its inherited members are on *its* page, not yours - walk the chain. Small subclasses are
  mostly parent: `ForumReply` declares one property, everything else is on `Post`.
- **A builder method that returns the builder is chainable.** `EmailItemBuilder.toList(...)`
  returns `EmailItemBuilder`; the terminal call is the one that returns something else
  (`build()` returns `EmailItem`). Read the return type to find where a chain ends.

## What is not in the reference

The index states its own scope on line 3: *"Reference for classes annotated with `@Docs`."*
It is a curated surface for app developers, not a full javadoc dump. The following are
deliberately absent, and their absence is not evidence that the underlying thing does not exist.

- **Undocumented classes.** Some very common types have no page at all - as of writing,
  `Profile`, `Organisation`, `Group` and `Branch` are among them, even though they appear
  constantly as parameter and return types. All four 404, and none of them is in the index.
  This is the gap you will hit first; the recovery is the next subsection.
- **Static methods.** Entity pages carry instance members only. `Lead`'s own description
  mentions `Lead.create`, and there is no `create` entry on the page.
- **Overloads that take a persistence `Session`.** The internal Hibernate-session variants of
  manager and entity methods are stripped; you will not find a `Session` parameter anywhere.
  You are not expected to manage sessions.
- **Internals and engine plumbing.** Wiring, caches, schedulers, maintenance and lifecycle
  entry points that app code is not meant to touch.
- **Anything that hands back a credential or a secret.** Password *operations* are documented
  (`setPassword`, `verifyPassword`, `generatePasswordReset`); anything that would return a
  stored hash, key or token value is not.
- **Licensing and internal administration.**

### What to do when the thing you need is not there

In order:

1. **Search the index for near names before giving up.** The bean, the builder or the manager
   that wraps it is usually documented even when the entity is not. For `Profile`: no page, but
   `ProfileBean`, `ProfileBuilder`, `ProfileAndField`, `ProfileIdentifier` and `ProfileTab` all
   have pages, and `UserManager` documents the parameters and return types of nearly every
   profile operation you would want.
2. **Work from the documented caller.** If a manager method takes or returns an undocumented
   type, its parameter and return descriptions on the manager page tell you what that value is
   and what may be null. That is often the whole answer.
3. **Treat the gap as a boundary, not a dare.** An absent member is unverified. If you write the
   call anyway, say so explicitly in your output ("not in the public reference - verify at
   runtime"), keep it in one place, and guard it. Do not silently ship a guessed method name:
   that is exactly the call that throws in production six weeks later.
4. **Never invent a signature to fill the gap**, and never present an inferred method as if you
   had confirmed it.

## Worked example: finding a class when you only know the task

You know you need to send an email; you do not know the class. Fetch the index, jump to
`## Managers`, scan the summaries: `EmailManager` - "Owns creation, sending and tracking of
EmailItems, and is reached from server-side JS as `services.emailManager`." That one line gives
you both the class and the variable name.

Fetch `EmailManager.md`. There is no `sendEmail`. There is:

> `emailBuilder()` - Returns: [EmailItemBuilder](EmailItemBuilder.md) - Creates a new
> EmailItemBuilder ... used to set the recipient, sender, subject and body of an email before
> building and sending it.

The return type is a link, so follow it. `EmailItemBuilder.md` gives the chain:
`recipient(Profile)` / `recipientAddress(String)`, `fromAddress`, `subject`, `html`, `text`,
`toList(List)`, and `build()` returning `EmailItem` - "saves the composed message as an
EmailItem and queues it for sending".

The payoff for having looked: attachments are `addAttachement(String fileName, String fileHash,
String contentType)` - misspelled in the real API, and a spelling no amount of inference
produces. Note also that the builder's own description says it is obtained from
`applications.email.emailBuilder()`, so both routes are documented.

Read **[references/worked-lookups.md](references/worked-lookups.md)** when your question is a
different shape: reading an entity page and walking its `Extends:` chain (`Lead`, `Quote`),
resolving an unfamiliar `services.*` name back to its class, or working around a type that is
not in the reference at all (`Profile`).

## Rules

1. Fetch the index once; fetch class pages on demand; never read either whole when a search
   will do.
2. Exact case, no package prefix, `.md` suffix.
3. Confirm spelling, parameters and return type before writing a call.
4. Follow `Extends:` and the "Inherited from" block before deciding a member is missing.
5. Linked type means there is a page; backticked type means there is not.
6. Absent from the reference means unverified. Say so; do not invent it.

## Related skills

- **kademi-app-development** - orientation: project layout, and what the Kademi terms in these
  class descriptions actually mean.
- **kademi-server-js** - actually calling the method you just looked up, from server-side JS.
- **kademi-themes** - calling it from a Velocity template.
