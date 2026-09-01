# Worked lookups

Three worked lookups, each a different shape of question. The fourth shape - "I know the task but
not the class name" - is in SKILL.md, because you cannot run the procedure without it.

Fetch a class as `https://docs.kademi.co/ref/templating/md/<ClassName>.md`.

## 1. "What can I call on a Lead?"

Fetch `https://docs.kademi.co/ref/templating/md/Lead.md`.

Read the metadata block first: `Group: Database Entities`, no `Extends:`, so everything on the
lead is on this one page - about 60 properties and 85 methods, no chain to walk.

Now answer the actual question rather than dumping the page. For "is this deal still open":
the Properties table has `closedDate` ("Null while the lead is still active") and `cancelled`,
and the Methods list has `isStatus(LeadStatusType type)`. The method's prose is the deciding
detail: "a cancelled lead which has not been closed matches both CANCELLED and ACTIVE". That
warning is the reason to read the page instead of guessing at `lead.isActive()`, which does
not exist.

Contrast with `Quote.md`: `Extends: [PaymentItemList](PaymentItemList.md)`, four own properties,
and an `## Inherited from PaymentItemList` block holding the rest. If the member you want is on
neither, open `PaymentItemList.md` and check *its* `Extends:` line.

## 2. "What does this builder method return?"

You are reading unfamiliar code: `services.criteriaBuilders.get("product")`.

`criteriaBuilders` is not a class name, so search the index for the manager. `## Managers` has
`KCriteriaBuilders` - "exposed to server-side JS and Velocity as `services.criteriaBuilders`".

`KCriteriaBuilders.md` shows `get(...)` returning `[KCriteria](KCriteria.md)`, and Properties
shortcuts like `profile` and `points` that return a `KCriteria` directly. So the code is
equivalent to a `KCriteria` for products, scoped to the current organisation.

Fetch `KCriteria.md` for what you can chain next - and note its
`## Inherited from BaseCriteriaBuilder` block, which is where methods like
`likeStartsWith(String propertyName, Object value)` live. Miss the inherited block and you will
wrongly conclude that half the query API does not exist.

## 3. "It is not in the reference"

You want the display name of a profile and reach for `Profile.md`. It 404s - an HTML error page
titled `404 | Error page`.

Do not retry `Profiles.md`, `ProfileEntity.md`, `User.md`. Search the index for `Profile`: no
`Profile` entry, but `ProfileBean`, `ProfileBuilder` and `ProfileAndField` are all there, and
`UserManager` is the documented owner of profile operations. `UserManager.md` gives you
`currentProfile` (returns `Profile`, "or null when the request is anonymous") plus a documented
method for nearly everything you would want to do with it.

So: the *operations* are verified even though the *type* is not. Use the manager's documented
signature, and if you still need a bare property on the returned `Profile` object, flag it as
unverified rather than asserting it exists.
