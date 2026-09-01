# Untrusted input, authorisation and multi-tenancy

## Everything from outside is untrusted

Request parameters, cookies, headers, uploaded files, webhook bodies, and anything an integration
imported from another system.

### Read parameters through the form context, always

```js
globalThis.saveThing = (page, params, files, fc) => {
    const vc = fc.newValidationContext();
    const name = vc.validateString('name', true, 100);
    const qty = vc.validateInteger('qty', true);
    const due = vc.validateDate('dueDate', false);
    if (!vc.isValid()) {
        return vc.toJsonResult();
    }
    // ...
};
```

Never touch the raw request. Use `fc.cleanedParam(name)` and `fc.dateParam(name)` for single reads,
and a validation context in POST handlers.
[ValidationContext](https://docs.kademi.co/ref/templating/md/ValidationContext.md) also has
`validateLong`, `validateDouble`, `validateBigDecimal`, `validateBoolean`, `validateList`,
`validateListLongs` and `validateFile`, each with a required flag and, where it makes sense, bounds.

One exception with a trap of its own: `cleanedParam` runs OWASP HTML sanitisation, which corrupts
JSON, paths and URLs by escaping `&`, `<` and `>`. For a structured blob use `fc.rawParam(name)` -
and then parse and validate it yourself, because nothing has sanitised it. `validateRawString` is
the validation-context equivalent.

The same rule applies in Velocity:
[FormContext](https://docs.kademi.co/ref/templating/md/FormContext.md) and its accessors, never the
request.

### Never let untrusted input reach the page unescaped

Cookies and headers included. In Velocity, escape anything user-supplied before rendering it. This
is how stored XSS gets into an admin console, where the viewer is an administrator with more
privilege than the attacker.

### Consider the negative case

When you check a value is present, decide what happens when it is not - throw, log a warning, or
return early. Silent `null` propagation past a security check is how an authorisation bug becomes
invisible.

## Authorisation

**Every controller checks that the current user may perform this action, before performing it.**
Registering a mapping under `admin/` is not an authorisation check - it is a route.

- Declare the required privilege on the mapping: `.postPriviledge('WRITE_CONTENT')`, and grant the
  matching privilege to the role. A mapping with no `postPriviledge` requires `WRITE`.
- Privilege checks resolve downward only: a granted parent satisfies a required child, never the
  reverse. A role granted `WRITE_CONTENT` does not satisfy a required `WRITE`. The symptom of
  getting this wrong is "authorisation declined" for a non-admin who plainly has the role, while
  administrators succeed.
- **Check ownership as well as role.** "Has the `DealerAdmin` role" is not "may edit *this*
  dealer's record". Verify the record belongs to an organisation the user has access to. Role
  checks alone are how one partner reads another partner's data.
- `Administrator` implicitly grants everything - never add it with `.addRole`.

`securityManager` ([ControllerSecurityManager](https://docs.kademi.co/ref/templating/md/ControllerSecurityManager.md))
has `getCurrentProfile`, `hasRole(profile, roleName)`,
`hasDirectRole(profile, roleName, targetOrg)`, `findApplicableRoles(org, profile)` and
`getCurrentRequestPrivs`.

### Public endpoints

`.isPublic(true)` is an unauthenticated write path into the account. Validate hard, rate-limit what
you can (see [idp-rules.md](idp-rules.md)), and wrap any write in `securityManager.runAsUser` with a
purpose-made user drawn from an app setting - never an administrator.

```js
securityManager.runAsUser(orderUserName, () => {
    db.createNew(formatter.randomGuid, JSON.stringify(order), 'coffeeOrder');
});
```

## Multi-tenancy

**Never put mutable state in global or module scope.** App instances are shared across accounts, so
a cached value written while serving account A is read while serving account B. That is a data leak
across customers, and it will not show up in testing - it needs two accounts, concurrent traffic and
luck.

Constants and stateless service objects at module scope are fine. Anything that varies per request,
per user, per website or per account is not - hold it in a local variable, or in the platform's own
per-request state. If you need a cache, declare one with `controllerMappings.cacheBuilder()` and read it through
`getCacheValue`: keys are automatically scoped per organisation - and per branch for a website - and
the cache is discarded when the app is updated. That is the difference between a cache and a
cross-tenant leak. See [CacheBuilder](https://docs.kademi.co/ref/templating/md/CacheBuilder.md).

## What the browser can see

`admin/`, `website/` and `common/` are served to browsers. `APP-INF/` is not - it is the only place
server-side logic belongs.

Anyone who can reach the admin domain can fetch any file under `admin/`. Do not put a key, a private
endpoint, an internal hostname, or a comment explaining how the authorisation works into
browser-served files.

## Logging

Never log a credential, a token, a session id, a password, a full request body or a full webhook
payload. Log the entry point and its identifying parameters. Account administrators can read the
server logs from the admin console, so "internal only" is not a protection.
