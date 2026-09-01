# Credentials and secrets

## Never in an app's files

Not in `.js`, not in `.mjs`, not in `controllers.xml`, not in a template, not in
`dependencies.json`, not in a comment, not in a commented-out line. App source is versioned, synced,
published to the Marketplace and readable by anyone who can reach the admin domain. There is no such
thing as a credential that is "only in the dev copy".

## Where they go instead

Two account-level stores, both edited in the admin console under
**Account settings > Environment variables**, and both reachable from any value that supports
`${...}` substitution:

| Store | Placeholder | For |
|---|---|---|
| Environment variables | `${my.variable}` | Non-secret per-environment values - hostnames, endpoint URLs, account ids |
| Secrets | `${secret.name}` | Credentials. Secret names must start with `secret.` |

Put the placeholder in the app setting or endpoint field, not the value:

```
apiKey  =  ${secret.stripeKey}
baseUrl =  ${my.stripeBaseUrl}
```

Substitution happens when the value is read, so your code never contains the credential and a
config snapshot never carries it between accounts. It applies to:

- **App settings**, read through the normal settings API.
- **Integration endpoints** - the address, username, password, private key, from-address and
  reply-to fields. See
  [kademi-integrations/references/endpoints.md](../../kademi-integrations/references/endpoints.md).

## Reading a setting that holds a secret

```js
const key = services.websiteManager.getSetting('my-app', 'apiKey', branch);      // resolved
const raw = services.websiteManager.getRawSetting('my-app', 'apiKey', branch);   // "${secret.stripeKey}"
```

`getSetting` applies substitution. `getRawSetting` deliberately does not - it exists for the
settings editor UI, which has to show and re-save the placeholder rather than the value. **Using
`getRawSetting` to fetch a credential is the most common mistake here**: the request goes out with
the literal string `${secret.stripeKey}` as the API key, and the provider returns 401.

In a controller handler, `page.appSettings` is already the resolved map for the current organisation
and branch.

## Managing secrets from code

[AccountManager](https://docs.kademi.co/ref/templating/md/AccountManager.md) exposes
`putSecret(name, value)`, `removeSecret(name)` and `getSecretNames()` - names only, no values.
`putSecret` throws if the name does not start with `secret.`. The environment-variable equivalents
are `putEnvVariable`, `removeEnvVariable` and `getEnvVariables`.

`getSecrets()` is on the class but is not exported to GraalJS, so under `engineVersion="2.0"` it is
not callable at all. Do not go looking for a way around that: pulling secret values into script
scope is the thing the placeholder mechanism exists to avoid. Put `${secret.name}` in the setting
and read the setting.

## Deciding where a credential lives

| Situation | Where |
|---|---|
| One credential for the whole account | Account secret, referenced from an app setting |
| Different per website | App setting per branch, holding a `${secret.…}` placeholder |
| Per end user (OAuth tokens and similar) | Stored against the profile by the platform - see [auth.md](../../kademi-server-js/references/auth.md) |
| Needed by browser JavaScript | It is not a secret. Anything the browser can read is public - redesign so the call happens server-side |

## Crypto

`formatter.crypto` ([CryptoImpl](https://docs.kademi.co/ref/templating/md/CryptoImpl.md)) provides
hashing, PBKDF2 key derivation, symmetric encryption and Diffie-Hellman.
[JWTManager](https://docs.kademi.co/ref/templating/md/JWTManager.md) creates and parses JWTs and
JWKs, and generates signing key pairs. Use them for signing and verifying webhooks and tokens. Do
not hand-roll a signature check, and compare digests with a helper rather than `==`.

Never write your own password storage - passwords are the platform's job.

## Rotation

When a credential has leaked, or on a schedule:

1. Issue the new credential at the provider, leaving the old one live.
2. `putSecret('secret.stripeKey', newValue)` - every setting referencing it picks the new value up
   on the next read, with no app deploy.
3. Verify traffic is succeeding on the new credential.
4. Revoke the old one at the provider.

Because the settings hold a placeholder rather than the value, nothing needs editing per website or
per app. That is the main practical reason to use secrets even for a single-account integration.
