---
name: kademi-security
description: Securing a Kademi account and the apps in it. Use whenever a task involves an API key, password, token, client secret, private key or webhook signature - storing one, reading one, rotating one, or deciding where it should live - and whenever code takes input from a request, a cookie, a header, an uploaded file or an external system. Also covers Kademi's intrusion detection and prevention (IDP) engine - policies, rules, conditions, actions and metrics that rate-limit, block, geofence, whitelist IPs or abort requests. Use before exposing any public or unauthenticated endpoint, when an app needs an authorisation check, when a site is being scraped, brute-forced or hit by bots, and when reviewing an app for security.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: security

Kademi is multi-tenant. One app instance is shared across accounts, and everything under `admin/`,
`website/` and `common/` is served to browsers. Both facts drive most of what follows.

## Where to go

| The task | Read |
|---|---|
| An API key, token, client secret or private key - storing, reading, rotating, or deciding where it lives | [references/secrets.md](references/secrets.md) |
| Reading request data, authorisation checks, multi-tenant state, what the browser can see, logging | [references/input-and-authorisation.md](references/input-and-authorisation.md) |
| Rate limiting, blocking, geofencing, IP whitelists, bot and scraper mitigation, "abort this request" | [references/idp-rules.md](references/idp-rules.md) |
| OAuth 2 sign-in, CSRF tokens, brute-force and credential-stuffing protection | [kademi-server-js/references/auth.md](../kademi-server-js/references/auth.md) |

## The rules, in one place

Non-negotiable. Each links to where it is explained.

1. **No credential in an app's files.** Not in JS, XML, templates, `dependencies.json`, or a
   commented-out line. App source is versioned, synced and published.
   → [secrets.md](references/secrets.md)
2. **Credentials live in account secrets**, referenced from an app setting as `${secret.name}`, and
   read with `getSetting` - never `getRawSetting`, which returns the placeholder unresolved.
   → [secrets.md](references/secrets.md)
3. **Never read a request parameter directly.** Always the form context: `cleanedParam`,
   `dateParam`, or a validation context in POST handlers.
   → [input-and-authorisation.md](references/input-and-authorisation.md)
4. **Every controller checks the current user may do this, before doing it** - role *and*
   ownership. A route under `admin/` is not an authorisation check.
   → [input-and-authorisation.md](references/input-and-authorisation.md)
5. **No mutable state in global or module scope.** App instances are shared across accounts, so a
   value cached for account A is served to account B.
   → [input-and-authorisation.md](references/input-and-authorisation.md)
6. **Nothing untrusted reaches the page unescaped** - cookies and headers included.
   → [input-and-authorisation.md](references/input-and-authorisation.md)
7. **Never log a credential, token, session id, password or full request body.** Account
   administrators can read the server logs.
   → [input-and-authorisation.md](references/input-and-authorisation.md)

## Find committed credentials

Run this over any app before shipping it:

```bash
rg -n --pcre2 -i '(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*.[A-Za-z0-9+/_-]{16,}' .
```

Anything it returns is an incident, not a cleanup: **rotate the credential at the provider first**,
then move the new one to a secret. Deleting the line does not help - it stays in history.

This search is part of the standard review in
[kademi-coding-standards](../kademi-coding-standards/SKILL.md).

## Before shipping

- [ ] The credential search above is clean.
- [ ] Credentials come from `${secret.…}`, read with `getSetting`.
- [ ] Every controller checks a permission, and ownership where the data is scoped.
- [ ] Every parameter comes through the validation context or `cleanedParam` / `dateParam`.
- [ ] `rawParam` values are parsed and validated before use.
- [ ] Nothing user-supplied is rendered unescaped.
- [ ] No mutable state at module or global scope.
- [ ] Public endpoints validate everything and run as a purpose-made user, not an administrator.
- [ ] Nothing sensitive in `admin/`, `website/`, `common/` or the logs.
