# Versions, Deploying and the Marketplace

Three separate things, often confused:

1. **Syncing** - getting your local files into an app version's repository on an account. KSync.
2. **Versioning** - creating a new version of an app. Done in the admin UI.
3. **Publishing** - listing a version on the Kademi Marketplace so other accounts can install it.
   Done in the admin UI.

Guide: <https://docs.kademi.co/blogs/docs-kb/deploying-apps-to-the-marketplace/>

## Versions are created on the server, not in your working tree

This is the part that surprises people. You do **not** make a version folder locally. A version is
a repository on the account, and you check out or sync against one specific version:

```
https://myaccount.admin.kademi.com/repositories/<app>/<version>
```

So your local working tree is the *contents* of one version. Keep it in git as normal.

## Creating a new app

1. Go to the **Apps** page and find the **App Builder** panel.
2. Create the app, giving it a name. **Enable "App Provider".**
3. Open **App Files** to get the repository your code goes into.
4. KSync your code in, then publish (below).

## Releasing a new version of an existing app

1. Open the app's repository from the Apps page.
2. **Duplicate the most recent version** and give the copy an incremented version number.
3. Switch to the new version using the version selector.
4. KSync your code into that version's repository.
5. Publish.

You never edit a version that is already published. Duplicate, increment, sync, publish.

## Publishing to the Marketplace

1. Make sure your code is synced into the target version's repository.
2. Go to the App Builder page, then **Marketplace Details**.
3. Check the details are right, then:
   - **New app** - save, then **Add to marketplace**
   - **Existing app** - **Republish**

## The `ksync -command publish` alternative

KSync also has a `publish` command that pushes many apps at once from a local tree laid out as
`<rootdir>/{apps,libs,themes}/<app-id>/<version>/`. That is a bulk path for maintaining a whole
set of apps; the admin-UI flow above is the normal one for a single app.

Always dry-run it first:

```bash
ksync.sh -command publish -rootdir . -appids '*' \
  -url https://myaccount.admin.kademi.com -user myusername -report
```

See [dev-loop.md](dev-loop.md) for the full option list.

## Version rules

- Never republish a version that already exists - create a new one.
- Exactly one version folder per asset in the bulk publish layout.
- `-force` exists for recovery, not for routine use.

## Making your app's configuration portable

An account's configuration can be snapshotted, diffed against another account and deployed - that is
how a change made in a test account is promoted to production. Your app's own configuration only
takes part if you register two functions:

```js
controllerMappings.appendConfigFunction('describeMyAppConfig');
controllerMappings.applyConfigFunction('applyMyAppConfig');

globalThis.describeMyAppConfig = (builder) => {
    // add an entry per portable config item
};

globalThis.applyMyAppConfig = (deltas, ctx) => {
    // apply the incoming changes
};
```

- `appendConfigFunction` is called with a config item list builder and **describes** what your app
  has, so it can be exported and compared.
- `applyConfigFunction` is called with the config deltas and an apply context, and **applies** them.
  Without it the platform reports that your app cannot apply config changes, and its items show in a
  diff as undeployable.

Register both or neither - describing items you cannot apply produces a diff an administrator cannot
action.

**Never make a credential a portable config item.** Secrets are per-account by design; a config item
holding `${secret.stripeKey}` moves the *reference*, which is the behaviour you want. See
[kademi-security](../../kademi-security/SKILL.md).

Related classes:
[AccountConfigSnapshot](https://docs.kademi.co/ref/templating/md/AccountConfigSnapshot.md),
[ConfigDiff](https://docs.kademi.co/ref/templating/md/ConfigDiff.md),
[ConfigDelta](https://docs.kademi.co/ref/templating/md/ConfigDelta.md),
[ConfigItem](https://docs.kademi.co/ref/templating/md/ConfigItem.md), and the Account Settings
section of the reference index.
