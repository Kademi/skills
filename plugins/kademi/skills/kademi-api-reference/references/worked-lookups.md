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

A manager method hands you a `Credential` and you reach for `Credential.md`. It 404s - an HTML
error page titled `404 | Error page`, not a Markdown 404.

Do not retry `Credentials.md`, `UserCredential.md`, `Login.md`. Guessing name variants is the
wrong move: the linked-versus-backticked test on the page you came from already told you there
was no page, because the type was written in backticks rather than as a link.

Search the index for near names instead, then work from the documented caller. The manager method
that returned the value documents what it is and when it is null, and that is usually the whole
answer. Credentials are a case where the absence is deliberate - the reference documents password
*operations* such as `setPassword` and `verifyPassword` but never a type that hands back a stored
hash - so the operations are verified even though the type is not.

Use the manager's documented signature. If you still need a bare property on the returned object,
flag it as unverified rather than asserting it exists.
