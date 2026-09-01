---
name: kademi-coding-standards
description: Kademi's house coding standards, and the review that checks code against them. Use before finishing any change to a Kademi app, lib or theme, and whenever asked to review, check, audit, lint or sanity-check Kademi code, or asked "is this the right way to do it on Kademi". Names every house rule and where it is documented - service and manager API design, controller versus service separation, transactions, error handling, Nashorn versus GraalJS, logging, client-side JavaScript, LESS and CSS - and carries the runnable review to run over changed files before handing work back.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: coding standards

**To review code, go straight to [references/review.md](references/review.md).** It is the runnable
checklist: searches that find each violation, plus the read-the-code checks no search can do. Run it
over the files you changed before handing work back.

This page is the index of the standards themselves. Each one is documented where the code gets
written, so that a developer working on a theme is not reading service-design rules - follow the
link rather than working from a summary.

## The rule everything else follows from

**Controllers are coupled to the UI. Services are not.** A controller takes a request, checks the
permission, opens the transaction, validates the parameters, calls a service with plain arguments,
and returns a `JsonResult`. A service takes plain arguments, throws on failure, and returns plain
data. Business logic left in a controller cannot be called from a journey node, a pipeline step, an
AI prompt function or another app.

Everything below is downstream of that split.

## Where each standard lives

### Server-side JavaScript

| Standard | Documented in |
|---|---|
| Controller/service separation, transactions in the controller, POST handling, `JsonResult` | [kademi-server-js/SKILL.md](../kademi-server-js/SKILL.md) |
| Every platform call through `services.*`; no direct `application.*`, no `application.call` | [kademi-server-js/SKILL.md](../kademi-server-js/SKILL.md) |
| Sandbox: no `Java.type`, no `java.*`, use `formatter.newMap()` / `newArrayList()` | [kademi-server-js/SKILL.md](../kademi-server-js/SKILL.md) |
| Service API design: hide internals, own return shape, never leak a search response | [services.md](../kademi-server-js/references/services.md) |
| Nashorn: `formatter.foreach`, `formatter.eq`, `var`, `log.*`, `formatter.toJson` | [nashorn.md](../kademi-server-js/references/nashorn.md) |
| GraalJS: ES modules, `globalThis`, `console.*`, native JS, `securityManager.yield()` | [graaljs.md](../kademi-server-js/references/graaljs.md) |
| Which engine: new work is GraalJS `2.0`; existing apps stay on Nashorn | [kademi-server-js/SKILL.md](../kademi-server-js/SKILL.md) |
| Confirm a method exists before calling it | [kademi-api-reference](../kademi-api-reference/SKILL.md) |

### Templating and UI

| Standard | Documented in |
|---|---|
| Velocity: single service lookup, macros, escaping | [velocity.md](../kademi-themes/references/velocity.md) |
| Paginator for long lists, `standardTable`, `subtext` | [page-patterns.md](../kademi-admin-ui/references/page-patterns.md) |
| No inline JavaScript; declare assets in `dependencies.json` | [client-side.md](../kademi-admin-ui/references/client-side.md) |
| `pageInitFunctions`, `Msg`, `reloadFragment`, the forms plugin, `.done()`/`.fail()`, fetch | [client-side.md](../kademi-admin-ui/references/client-side.md) |
| Bootstrap first, semantic colours, no single-purpose styles | [ux-standards.md](../kademi-admin-ui/references/ux-standards.md) |

### Cross-cutting

| Standard | Documented in |
|---|---|
| Credentials, request input, authorisation, multi-tenant state, logging | [kademi-security](../kademi-security/SKILL.md) |
| Versioning and publishing an app | [publishing.md](../kademi-app-development/references/publishing.md) |

## The few that live nowhere else

**API design**, for any JS API you expose to other apps:

- Hide complexity; guide the caller through the problem domain.
- Initialisation is the API's job. Hide settings lookups and setup inside it.
- Past three or four parameters, use a fluent builder with sensible defaults.
- **Throw on failure. Never signal failure through a return value.** Put ids and names in the
  message.
- No UI types in a service signature - no `JsonResult`, no `FormContext`.
- Every code path returns the same shape.

**Errors.** Throw with context. Catch in the controller, log, and return a message the administrator
can act on. Always decide the negative case: when you check a value is present, decide what happens
when it is not.

**Logging.** Log the entry points with their identifying parameters. Not inside tight loops, not
whole result sets, never a credential.

**Dates.** Never use the date formatting functions on `formatter`; they are replaced by the
`dateManagerV1` service.

**Money.** `BigDecimal` via `formatter.toBigDecimal(...)`, then `.multiply(...)` / `.add(...)`.
Native JS arithmetic on a Java `BigDecimal` silently converts to a float.
