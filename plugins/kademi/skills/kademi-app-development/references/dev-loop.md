# Development Loop

You develop Kademi apps **locally**, against a real Kademi account, using **KSync** - a
bi-directional file sync tool. Edits you save locally are pushed to the server as you make them,
so you refresh the browser and see the change.

There is no local Kademi server. The account is the runtime.

## KSync

- Source: <https://github.com/Kademi/ksync>
- Guide: <https://docs.kademi.co/blogs/docs-kb/developing-with-ksync/>
- JAR: <http://docs.kademi.co/ksync/ksync3.jar> (KSync3 - the current version; requires Java 8+)

Cross-platform and Windows installers are also available from the guide. The installers register
a `ksync://` URI scheme, so links in the Kademi admin UI can launch a checkout directly.

Run it as:

```
java -jar ksync3.jar -command <command> [options]
```

A one-line wrapper makes this less tedious:

```bash
# ksync.sh
java -jar ~/ksync.jar "$@"
```

## Commands

| Command | What it does |
|---|---|
| `checkout` | Downloads a remote repository into the current directory and writes a `.ksync` metadata directory |
| `sync` | Watches for local changes and pushes each one immediately. Run this while you work |
| `pull` | Downloads server-side changes into your local copy |
| `push` | Uploads local changes in one go |
| `publish` | Publishes apps to the Kademi Marketplace |
| `login` | Authenticates and stores a token |
| `usage` | Prints the full option list |

## Options

| Option | Applies to | Meaning |
|---|---|---|
| `-command <arg>` | all | One of `usage`, `checkout`, `push`, `pull`, `sync`, `publish`, `login` |
| `-url <arg>` | checkout, publish | Repository or account URL |
| `-user <arg>` | checkout, publish | Username. **Not** your email address |
| `-password <arg>` | checkout, publish | Password. Prompts if omitted |
| `-auth <arg>` | all | An encrypted token from the server, instead of user/password |
| `-ignore <arg>` | checkout | Comma-separated file/folder names to skip |
| `-rootdir <arg>` | publish | Directory containing the `apps`, `libs` and `themes` folders |
| `-appids <arg>` | publish | `*` for everything, or a comma-separated list of app ids, or absolute paths |
| `-appname <arg>` | checkout | Name of the folder to create for the app |
| `-appdir <arg>` | - | Set by the `ksync://` URI scheme handler |
| `-force` | publish | Republish a version that already exists |
| `-report` | publish | Dry run - report what would happen, change nothing |
| `-versionincrement` | publish | Bump version files as part of publishing |

## Getting started

```bash
mkdir mysite && cd mysite
ksync.sh -command checkout \
  -url https://myaccount.admin.kademi.com/repositories/mysite/version1 \
  -user myusername
```

Then leave sync running in a terminal while you work:

```bash
ksync.sh -command sync
```

## Rules that will bite you

- **`sync` never modifies local files.** It is push-only. To take server-side changes you must
  run `pull` explicitly.
- **`push` fails if the server has changed** since your last pull. That is deliberate - run
  `pull`, resolve, then `push`.
- **A version folder must contain exactly one version.** More than one and publishing fails.
- **Never republish a version that already exists.** Bump the version instead. `-force` exists
  for recovery, not for routine use.
- **`-user` is a username, not an email address.**

## Publishing

Versions are created in the admin UI, not as folders in your working tree, and publishing to the
Marketplace is a UI action. KSync also has a bulk `publish` command for pushing many apps at once
from a `<rootdir>/{apps,libs,themes}/<app-id>/<version>/` tree.

See [publishing.md](publishing.md).

## Working with git

KSync and git are independent. Keep your app in git as normal and let KSync handle the account.
Exclude KSync's metadata:

```gitignore
.ksync/
```
