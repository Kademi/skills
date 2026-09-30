# ksync3 commands and options

`ksync3 <command> [options]`. Every command takes `--help`, which lists only that command's own
options. `ksync3 --version` prints the build.

Options are spelled both ways - `--url` and `-url` - because the documentation, older scripts and
`ksync://` links all use the single dash form. A legacy `-command sync` is moved to the front for
you, so old scripts keep working.

## Commands

| Command | What it does |
|---|---|
| `checkout` | Downloads every file in a branch into this directory and records the branch in `.ksync` |
| `sync` | Watches for local changes and pushes each one as it is saved. Runs until stopped |
| `push` | Sends everything changed here since the last sync, in one go, then makes sure the server has the whole version |
| `pull` | Applies everything that changed on the branch to the working copy |
| `verify` | Asks the server what this version is missing, and uploads whatever this checkout has |
| `login` | Signs in to a site and stores the login for later runs |
| `logout` | Discards the stored credentials for a site |
| `ignore` | Adds patterns to your per-user ignore file, or lists what is in it |
| `check-ignore` | Names the rule that excludes a path, and where it came from |
| `publish` | Publishes apps, libs, themes or recipes to the Marketplace |

## Options every command takes

| Option | Meaning |
|---|---|
| `-d`, `--debug` | Verbose output, with the level and source class on each line |
| `--logformat <fmt>` | `plain` (default), `ts` (ISO-8601 UTC timestamp and level first), or `kv` for a log reader |
| `-h`, `--help` | This command's options |

`--appdir` and `--appname` also exist, but are set by a `ksync://` link rather than by hand.

## Options for the commands that talk to a server

`checkout`, `push`, `pull`, `sync`, `verify`, `publish`:

| Option | Meaning |
|---|---|
| `--url <url>` | The branch to sync with. Remembered in the checkout, so only a first run needs it |
| `-u`, `--user <user>` | Username to log in with. **Not** an email address |
| `-p`, `--password <pw>` | Prompted for when left out |
| `--auth <user,token>` | An encrypted token from the server, instead of a username and password. A KOAuth2 api key on its own is taken the same as `--token` |
| `-t`, `--token <apikey>` | A KOAuth2 api key (`ko2_ak_...`), used as given and never stored. Defaults to `$KSYNC_TOKEN` |
| `-i`, `--ignore <globs>` | Comma separated patterns to ignore for this run, on top of the ignore files |

A username, an `--auth` token and a `--token` api key are answers to the same question, so giving
more than one is an error rather than one being silently dropped.

## Options for the commands that move files

`checkout`, `push`, `pull`, `sync`:

| Option | Meaning |
|---|---|
| `-l`, `--localwins` | Local is authoritative - overwrite a remote that has moved on, and keep the local file on a conflict, without asking. `--no-localwins` turns it back off |
| `-c`, `--conflictmode <m>` | How to ask about a conflict: `gui` (a dialog), `console` (a terminal prompt), or `auto` (the default) |
| `-s`, `--statusfile <file>` | Where to write the JSON status file. Defaults to `.ksync/status.json` |

`--localwins` makes `--conflictmode` irrelevant, because nothing is asked.

`auto` picks the terminal prompt rather than a dialog when nobody could click one: under Claude
Code, when `KSYNC_NON_INTERACTIVE` is set, under `CI`, with `DEBIAN_FRONTEND=noninteractive`, with
`TERM=dumb`, or with no display. A terminal prompt with stdin closed answers itself - the conflict
is left alone, both files untouched, with a warning - so an unattended run cannot hang. The pull then
exits 1 with the conflict still open; see `pull` below.

Closing stdin only helps once `console` has been chosen. A script that trips none of those checks
gets the dialog and waits on it.

### Status and notifications

`sync`, `push`, `pull` and `checkout` publish status. `login`, `logout`, `ignore`, `check-ignore`,
`verify` and `publish` do not, and are silent.

`.ksync/status.json` carries the state, a `label`, the `busy` and `problem` booleans, a detail
line, the command, the local directory, the url, the local and remote hashes, the last error, an
error count, the `pid` and a timestamp. For a script, `busy` and `problem` are the two worth
reading. The states are `STARTING`, `SCANNING`, `IDLE`, `PUSHING`, `PULLING`, `BLOCKED` (the remote
has changed and a pull is needed), `OFFLINE`, `FAILED` and `STOPPED`.

Those same four raise a transient desktop notification on entering a problem state, and again on
recovering. Only on the edges - a run that stays blocked notifies once and then goes quiet however
many pushes it refuses, and a `sync` retrying an unreachable server notifies once, not per retry.
Nothing turns notifications off.

## checkout

| Exit | Meaning |
|---|---|
| 0 | Every file was fetched |
| 1 | The checkout did not complete: the server could not be reached, or some files could not be fetched |

## pull

| Exit | Meaning |
|---|---|
| 0 | Pulled, or nothing had changed on the server |
| 1 | The pull did not complete: the server could not be reached, some files could not be brought down, or a conflict was left unresolved |

A conflict answered `n`, or left unanswered because there is no console, keeps your file and leaves
the pull unrecorded. The pull ends `BLOCKED` and exits 1, `push` stays blocked, and the next `pull`
asks again. `--localwins` settles it by keeping the local file, and the pull then exits 0.

## push

After the push, the server is asked whether it has everything the new version needs, and anything
missing is uploaded. That walks the whole version, so on a large repository it takes minutes; the
version is already live by then, so stopping it is safe.

| Exit | Meaning |
|---|---|
| 0 | Pushed, or nothing to push |
| 1 | The push did not go through: the remote had moved on, the server was unreachable, an upload or the new version was refused, or the server is still missing content |

## sync

| Option | Meaning |
|---|---|
| `--notray` | Do not show the status icon in the OS status bar. The status file is still written |

`--notray` governs the tray icon only, and only for `sync`. See "Status and notifications" above
for what is still reported.

A push that fails because the server was unreachable, timed out, or answered 429, 502, 503 or 504
is tried again by itself, after 30 seconds and then less often, up to every 10 minutes, without
waiting for another save. Other failures wait for the next save. After each push, the check that
`push` does runs in the background.

## login

| Option | Meaning |
|---|---|
| `--url <url>` | The site to sign in to. Taken from the checkout when run inside one |
| `-o`, `--oauth` | Browser only, with no fallback to a username and password |
| `-u`, `--user` / `-p`, `--password` | Skip the browser and sign in with a password |

With neither, a browser opens to authorize, falling back to a username and password when the site
does not offer OAuth2 or the browser sign-in does not complete. Credentials are stored per site, so
every checkout of that site is signed in at once. `login` deliberately does not create a `.ksync`
directory, so running it in the wrong folder leaves nothing behind.

## logout

| Option | Meaning |
|---|---|
| `--url <url\|domain>` | The site to log out of, as a url or a bare domain. Taken from the checkout when run inside one |

Removes both the OAuth tokens and the cookie login, because leaving one behind is not a logout.
Where the site supports it, the tokens are also revoked (RFC 7009) and this machine's client
registration deleted (RFC 7592) on the server. This machine is signed out even if that part fails.

## ignore

| Option | Meaning |
|---|---|
| `--pattern <glob>` | Pattern to add, comma separated for several. Lists the file when omitted |

Edits `~/.config/ksync/ignore` (`%AppData%\ksync\ignore` on Windows, `~/Library/Application
Support/ksync/ignore` on macOS), which applies to every checkout on this machine. Rules the team
should share go in a `.ksyncignore` inside the checkout instead. Run with no pattern to see the
built-in defaults as well as your own.

## check-ignore

`ksync3 check-ignore <path>...`

| Option | Meaning |
|---|---|
| `-i`, `--ignore <globs>` | Extra patterns to apply, as a sync would take them |
| `-n`, `--non-matching` | Also report paths that no rule matched |
| `-q`, `--quiet` | Print nothing, and answer in the exit code |

Output is `<source>:<line>:<pattern>\t<path>`. A path a `!` rule put back is reported too, marked
`(re-included)`, because that is a different answer from no rule having matched.

| Exit | Meaning |
|---|---|
| 0 | At least one path given is ignored |
| 1 | None of them is |
| 2 | A path was outside the checkout, or an option was wrong |

## verify

Runs the missing-object check over the whole version on the server, uploads whatever this checkout
has of what is missing, and repeats until nothing more can be sent. What is still missing is
listed. The walk is not cheap: minutes on a large branch.

| Exit | Meaning |
|---|---|
| 0 | Every file has its content |
| 1 | Something is still missing, and is listed |
| 2 | The command could not be run as given |

An older server that does not know the check answers with HTML, and ksync3 says so rather than
letting a JSON parser complain about a `<`.

## publish

| Option | Meaning |
|---|---|
| `-a`, `--appids <ids>` | Required. `*` for all, a comma separated list of ids, or absolute paths |
| `-f`, `--force` | Republish something already published |
| `-r`, `--report` | Report only, change nothing |
| `--retries <n>` | How many more times to try an asset that fails, with `--force` from the second try for a version the run created. Default 3 |

Run from the folder that holds the `apps`, `libs`, `themes` and `recipes` directories. Each asset
must have exactly one version folder inside it.

A publish that fails often works on the next try, so each asset is tried again up to `--retries`
times, with a growing pause between tries. `--force` is added from the second try, but only for a
version this run created, so a retry never overwrites a version that was already published. The run
ends with a summary in which tries that failed and then worked are warnings. A rejected login stops
the whole run at once rather than failing every asset in turn.

### ksync.toml

A `ksync.toml` in that folder sets the order, which matters when some things must be live before
others. `ksync` (the Go client) reads the same file.

```toml
[[tiers]]
dir   = "libs"
type  = "lib"
first = ["admin-lib"]   # before the rest of its tier

[[tiers]]
dir  = "apps"
type = "app"
```

Each `[[tiers]]` table has a `dir`, a `type` (`app`, `lib`, `theme` or `recipe`) and optionally
`first`. Tiers go in file order. **Folders the file does not list are not published**, so adding one
means adding a tier for it. A top-level `concurrency` is accepted for `ksync` and ignored by ksync3.
Any other unknown key is refused with its line number rather than ignored, because a misspelt
`first` would silently lose the order it exists for. Without the file the order is themes, apps,
libs, recipes.

| Exit | Meaning |
|---|---|
| 0 | Everything published, possibly after retries, which are listed as warnings |
| 1 | Something still failed after its retries, the login was refused, or `ksync.toml` is invalid |

## Environment variables

| Variable | Effect |
|---|---|
| `KSYNC_TOKEN` | A KOAuth2 api key used instead of any stored login, and never written to disk |
| `KSYNC_NON_INTERACTIVE` | Use the terminal prompt for conflicts rather than a dialog |
| `CI` | The same effect |
| `KSYNC3_HOME`, `KSYNC3_BIN` | Where the installer puts the jar and the launcher |
| `KSYNC3_BUNDLE_JRE=1` | Install a private JRE even when Java is already present |

## Where things live

| | Linux / WSL | macOS | Windows |
|---|---|---|---|
| Credentials | `~/.config/ksync/credentials.json` | `~/Library/Application Support/ksync/credentials.json` | `%AppData%\ksync\credentials.json` |
| Per-user ignore file | `~/.config/ksync/ignore` | `~/Library/Application Support/ksync/ignore` | `%AppData%\ksync\ignore` |
| Jar and JRE | `~/.local/share/ksync3` | `~/Library/Application Support/ksync3` | `%LOCALAPPDATA%\Programs\ksync3` |
| Launcher | `~/.local/bin/ksync3` | `~/.local/bin/ksync3` | `%LOCALAPPDATA%\Programs\ksync3\bin\ksync3.cmd` |
| Shared object cache, older builds only | `~/.cache/ksync/objects` | `~/Library/Caches/ksync/objects` | `%LocalAppData%\ksync\objects` |

A system-wide install with `sudo` puts the jar in `/usr/local/lib/ksync3` and the launcher in
`/usr/local/bin/ksync3`. `XDG_CONFIG_HOME` is respected on Linux.

Inside a checkout, `.ksync/` holds `ksync.properties` (the recorded `url`, `repoUrl`, `user` and
`remoteHash`) and `status.json`. Newer builds add the object store in `objects/` (pack files shared
with `ksync`, the Go client), and a `.gitignore` and `.ignore` that keep git and search tools out;
older builds keep the objects in the shared cache above, or in `blobs` and `hashes`. Only `url` is
worth reading, and nothing in there should ever be written by hand.

## The ksync:// URI scheme

The installers register a `ksync://` handler, so a link in the Kademi admin console can launch a
checkout. The part after `ksync://` is a base64 command line. Nothing needs to construct these -
the console does.
