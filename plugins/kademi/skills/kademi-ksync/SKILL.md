---
name: kademi-ksync
description: Use for anything involving KSync (the ksync3 command), which connects a local folder to a version of a Kademi repository - installing it, signing in, checking a repository out, keeping a folder in step with a hosted account while you work, publishing to the Marketplace, and working out why a file will not sync. Use when someone wants a Kademi site or app on their machine, when a local edit is not showing up on the account, when a push is refused because the remote changed, when a command says it is not logged in or the session expired, when a file is being skipped, when a checkout turns out to be pointed at the wrong version, or when someone reaches for git commands on a Kademi checkout. Also use before running any ksync3 command unattended, because the defaults assume a person is watching.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# KSync

`ksync3` keeps a folder on your machine and one **version of a Kademi repository** in step. It is
how code gets from your editor onto an account, because there is no local Kademi server - the
account is the runtime.

It looks like git and is not git. The differences are the whole skill:

| git | ksync3 |
|---|---|
| You commit, then push when ready | Every saved file is pushed. There is no commit and nothing staged |
| Local history you can go back through | None. The version's history lives on the account |
| You create branches locally | Versions are created on the server, in the App Builder |
| A merge leaves markers in the file | A conflict is a question per file, or is decided by `--localwins` |
| The remote is a bare repository | **The remote is a live account.** A push can change what visitors see |
| `.gitignore` | `.ksyncignore`, same syntax, four layers |
| `git check-ignore` | `ksync3 check-ignore`, same exit codes |

Use git as well, for the things git is for - history, branches, review. The two do not know about
each other and do not conflict. Put `.ksync/` in `.gitignore`.

## Install

```bash
# macOS, Linux, WSL. Add sudo for a system-wide install
curl -fsSL https://raw.githubusercontent.com/Kademi/ksync/master/installers/install.sh | bash
```

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/Kademi/ksync/master/installers/install.ps1 | iex
```

That installs `ksync3.jar`, a `ksync3` command, tab completion, and a Java runtime if no Java 11+
is already there. Re-run it to update. `ksync3 --version` says which build you have.

An older `java -jar ksync3.jar -command checkout` invocation still works - `-command x` is moved to
the front for you, and single-dash long options like `-url` are accepted. Write new commands the
modern way, `ksync3 checkout --url ...`.

## Sign in

```bash
ksync3 login --oauth --url https://acme.admin.kademi.us
```

A browser opens, you approve, and the tokens are stored per site - so every checkout of that site
is signed in at once, and refreshing happens by itself. Inside a checkout the `--url` is already
known, so it is just `ksync3 login --oauth`.

Two things must be true on the account, and neither is something you can fix from your machine.
If login fails, ask an account administrator to:

- install the **KOAuth2** app from the Marketplace, and
- turn on **Allow Dynamic Client Registrations** under People > OAuth2 Admin Server.

The sign-in redirect comes back to `127.0.0.1` on a random port. Loopback is always accepted, so
there is nothing to add to an allow list.

For CI, or anywhere a browser is not possible, use a KOAuth2 api key instead. It is used exactly as
given, is never written to disk, and needs no login:

```bash
export KSYNC_TOKEN=ko2_ak_...
```

`ksync3 logout` discards the stored sign-in for a site. It reminds you if `KSYNC_TOKEN` is still
set in the environment, because otherwise the next command still authenticates and the logout
looks broken.

## The checkout url

```
https://<account>.admin.<region>/repositories/<repository>/<version>/
```

For example `https://ksync.admin.kademiplay.com/repositories/ksync3demo/version1/`.

Two halves, and both are easy to get wrong.

**The host is the admin host**, `<account>.admin.<region>` - the `.admin.` part is not optional, and
a bare `acme.kademi.us` is a website host, not the one repositories live on. The region is whichever
domain the account is hosted under: `kademi.us`, `kademi.uk`, `kademi.com.au`, `kademi.hk`,
`kademiplay.com`, or one of the client-specific domains such as `kademi-maritz.com`. Take it from
the address bar of the admin console rather than assuming - it differs per account.

**The path is always `/repositories/`**, for a website as much as for an app. This is the trap: the
admin console shows a website at `/websites/<website>/<version>/`, and copying that url out of the
address bar gives you something that looks right and is not. Swap the `websites` segment for
`repositories`, keeping the same name and version, and it works. The failure is not obvious about
this - it says *"is not a repository branch: it answered with a page rather than a version"*, which
is true but does not mention the one segment you have to change.

```
what the console shows:  https://acme.admin.kademi.us/websites/mysite/version1/
what ksync3 needs:       https://acme.admin.kademi.us/repositories/mysite/version1/
```

**Leave the version off to follow the repository** rather than pin to one version:

```bash
ksync3 checkout --url https://acme.admin.kademi.us/repositories/mysite
```

Every later command then resolves the repository's latest version and says which one it picked,
including when that has moved since last time.

**This only works where the versions are named as dotted version numbers**, like `1.4.2`. The
server refuses to order anything else, so a hand-named branch cannot displace a real release - and
Kademi's own `version1`, `version2` naming is *not* a version number by that rule. On a repository
named that way, following fails immediately and tells you what it has:

```
No version of <repo> has a version number for a name, so there is no latest one to follow.
It has: version1. Point -url at one of those to pin this checkout to it
```

So in practice most website checkouts name the version. Which version is "latest" is always the
server's answer, never a local guess.

The url and username are recorded in the checkout, so no later command in that folder needs them.

## The everyday loop

```bash
ksync3 checkout --url https://acme.admin.kademi.us/repositories/mysite/version1   # once
ksync3 sync                                                        # leave running while you work
```

`sync` scans, then watches, and pushes each change as you save it. It runs until you stop it.

Working in bursts, or driving it from a script, use the one-shot pair instead:

```bash
ksync3 pull    # take server-side changes into the working copy
ksync3 push    # send local changes
```

`sync` and `push` only go one way - **neither of them brings server-side changes down.** Only
`pull` does that, and `pull` is the only command that rewrites your local files.

Two things about `sync` that are not obvious until they bite:

- **One ksync3 at a time per branch.** The hash cache is a BerkeleyDB environment under `/tmp`,
  locked single-writer and keyed by the branch url - or by the repository url when the checkout is
  following one, so two checkouts that follow the same repository collide even on different
  versions. Run `pull` while `sync` is going and it dies
  with `EnvironmentLockedException ... je.lck`, which does not mention `sync` at all. Stop `sync`
  first. Two checkouts of the same branch on one machine collide the same way.
- **Never let anything write inside the checkout while `sync` runs.** It syncs whatever appears
  there, your build output and your log files included - and if the writer is the sync process
  itself, say a log you redirected into the folder, each push grows the log, which triggers
  another push. Keep logs and build output outside the checkout, or in `.ksyncignore`.

## Running it unattended

Getting this wrong is how an agent or a CI job hangs forever on a question nobody sees.

- **Never run `sync` in the foreground of a tool call or a build step.** It does not return. Use
  `pull` and `push`, which do.
- **A blocked `sync` keeps running and stops delivering anything.** Once the remote has moved,
  every save is refused and you carry on working with nothing reaching the account. The desktop
  notification fires *once*, on the transition, and never again however many pushes are refused
  after it. Poll `problem` in `.ksync/status.json` if anything depends on the work actually
  landing.
- **Choose the console resolver first.** `--conflictmode auto`, the default, only avoids the GUI
  dialog when it can tell nobody could click one - under Claude Code, or with
  `KSYNC_NON_INTERACTIVE`, `CI`, `DEBIAN_FRONTEND=noninteractive`, `TERM=dumb`, or no display. A
  plain script on a developer's desktop trips none of those, gets the dialog, and hangs on a window
  nobody is looking at. Pass `--conflictmode console`, or set `KSYNC_NON_INTERACTIVE=1`.
- **Then close stdin**: `ksync3 pull < /dev/null`. `pull` is the command that can meet a conflict,
  and once it is asking on the terminal, no input means it leaves the file alone - both versions
  untouched, a warning logged - instead of blocking on a prompt forever. Closing stdin does nothing
  on its own; it only answers a prompt the previous bullet has to have chosen.
- Authenticate with `KSYNC_TOKEN`, not with an interactive login.
- `--logformat kv` gives parseable output; `--debug` gives the detail when something is wrong.
- **`sync`, `push`, `pull` and `checkout` raise OS desktop notifications** when they enter a
  problem state - a refused push, a lost connection. There is no flag to turn them off: `--notray`
  hides only the tray icon, and only for `sync`. Each retry is a fresh process entering the problem
  state afresh, so a loop that retries a failing push pops one notification per attempt on
  someone's desktop. Check the exit code and stop, rather than retrying blind. The other commands
  - `login`, `logout`, `ignore`, `check-ignore`, `verify`, `publish` - are silent.
- **Those same four write `.ksync/status.json`**, not just `sync` - read its `busy` and `problem`
  booleans, or the `state` (`IDLE`, `BLOCKED`, `OFFLINE`, `FAILED`), rather than scraping the log.

**`--localwins` discards other people's work.** It makes the local copy authoritative: a push
overwrites a remote that has moved on, and a conflict keeps the local file without asking. That is
right for a checkout whose contents come out of version control, and wrong everywhere else. Do not
reach for it to get past a refused push - pull first and look at what changed.

## What does not sync

Four layers of gitignore rules, weakest first, each able to undo the one before it:

1. built in - `.git/`, `.svn/`, `.hg/`, `.DS_Store`, `Thumbs.db`, `node_modules`, `bower_components`
2. `~/.config/ksync/ignore`, yours on this machine - edit with `ksync3 ignore --pattern "*.log"`
3. `.ksyncignore` in the checkout, shared with the team and synced like any other file
4. `--ignore` for one run

So a checkout that really does keep its own `node_modules` says `!node_modules` in its
`.ksyncignore`. `.ksync/` itself is never syncable and cannot be re-included.

When a file is not appearing on the account, ask rather than read four files:

```bash
ksync3 check-ignore theme/dist/bundle.js
```

It names the rule, the file it came from and the line number, and exits 0 if the path is ignored,
1 if it is not.

## The .ksync directory

`checkout` writes `.ksync/` for its own bookkeeping. **Never write anything inside it.** `blobs`
and `hashes` are its record of what the server already has; editing them does not change the
account, it corrupts the record, and the next push or pull misbehaves. Change a checkout by running
ksync3, never by editing its files.

One value in it is worth reading - `url` in `.ksync/ksync.properties`, which tells you which
account, repository and version this folder is connected to:

```properties
url=https\://acme.admin.kademi.us/repositories/mysite/version1/
```

Take that line and nothing else. Credentials live outside the checkout, in a 0600 file under your
config directory (`~/.config/ksync/credentials.json` on Linux, `~/Library/Application
Support/ksync/credentials.json` on macOS, `%AppData%\ksync\credentials.json` on Windows). Never
read, quote or copy it. Checkouts predating that change still carry a `userUrlHash` token in
`ksync.properties`, which is a live credential.

## When something is wrong

| What you see | What it means | What to do |
|---|---|---|
| `Remote repository has changed, please pull` | Someone else pushed since your last sync. The push was refused, nothing was lost | `ksync3 pull`, check what arrived, then push |
| `Not logged in to <host>` | No stored tokens for this site | `ksync3 login --oauth`, or set `KSYNC_TOKEN` |
| `The session for <host> has expired and could not be renewed` | The refresh token is dead too | `ksync3 login --oauth` again |
| `is not a repository branch: it answered with a page` | Usually a `/websites/` url copied from the console, where `/repositories/` is needed | Fix the url, then `checkout` again |
| `is not a ksync checkout, so there is no url to sync with` | You are in the wrong directory | `cd` to the checkout, or pass `--url` |
| `No version of <repo> has a version number for a name` | The repository has only hand-named branches, so there is no "latest" to follow | Point `--url` at one of the versions it lists |
| `<url> no longer answers as a repository` | A followed repository has gone or been renamed | Point `--url` at a version to pin the checkout |
| A saved change has no effect on the site | Very often the edit landed on a version the account is not running | Compare `url` in `.ksync/ksync.properties` with the version shown against the app at **Websites & apps > Apps** before debugging any code |
| `Remote repository has changed` when nobody else is working, and it comes and goes between runs | The account is answering with two different branch heads between requests | Retry; if it keeps alternating, report it. **Do not reach for `--localwins`** - against whichever head is stale it overwrites the good one with an older tree |
| `pull` fails with a `NullPointerException` | A defect in current ksync3 releases, not anything wrong with your checkout | There is no flag around it - take the changes with a fresh `checkout` into an empty directory, and report the version you are on |
| `EnvironmentLockedException`, `je.lck could not be locked` | Another ksync3 is already working on this branch, usually a `sync` you left running | Stop the other one; they cannot share a checkout |
| `sync` is running, saves are happening, nothing reaches the account | It went `BLOCKED` earlier and is refusing every push since | Check `problem` in `.ksync/status.json`; stop `sync`, pull, restart it |
| `sync` pushes over and over with no edits from you | Something inside the checkout is being written - often a log or build output, and if it is the sync log the pushes feed themselves | Move it outside the checkout or add it to `.ksyncignore` |
| A file never appears on the account | An ignore rule | `ksync3 check-ignore <path>` |
| Pages break after a publish, or files 404 | The version is missing content on the server | `ksync3 verify` lists the files whose content is missing, and exits 1 when anything is |

Nothing here is recovered by deleting `.ksync` and starting again - a fresh `checkout` into an
empty directory is the honest reset, and it costs only the download.

## Publishing

`ksync3 publish` uploads apps, libs and themes to the Marketplace in bulk. It is a different job
from syncing, and it is not needed to use an app inside your own account.

Run it from the folder holding the `apps`, `libs` and `themes` directories, and name what to send:

```bash
ksync3 publish --appids leadman-lib,payment-lib --report   # dry run first
ksync3 publish --appids leadman-lib,payment-lib
```

Each asset must have exactly one version folder inside it. `--force` republishes something already
published; it is for recovery, not for routine use - bump the version instead. Cutting versions and
the console side of publishing belong to the `kademi-app-development` skill.

## Every command and option

Read [references/commands.md](references/commands.md) for the full list, the exit codes, and the
options each command takes.
