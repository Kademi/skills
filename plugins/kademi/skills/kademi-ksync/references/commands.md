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
| `push` | Sends everything changed here since the last sync, in one go |
| `pull` | Applies everything that changed on the branch to the working copy |
| `verify` | Asks the server which files in this version it cannot serve the content for |
| `login` | Signs in to a site and stores the login for later runs |
| `logout` | Discards the stored credentials for a site |
| `ignore` | Adds patterns to your per-user ignore file, or lists what is in it |
| `check-ignore` | Names the rule that excludes a path, and where it came from |
| `publish` | Publishes apps, libs or themes to the Marketplace |

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
| `--auth <user,token>` | An encrypted token from the server, instead of a username and password |
| `-t`, `--token <apikey>` | A KOAuth2 api key (`ko2_ak_...`), used as given and never stored. Defaults to `$KSYNC_TOKEN` |
| `-i`, `--ignore <globs>` | Comma separated patterns to ignore for this run, on top of the ignore files |

A username and an `--auth` token are two answers to the same question, so giving both is an error
rather than one being silently dropped.

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
is left alone, both files untouched, with a warning - so an unattended run cannot hang.

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
many pushes it refuses. Nothing turns notifications off.

## sync

| Option | Meaning |
|---|---|
| `--notray` | Do not show the status icon in the OS status bar. The status file is still written |

`--notray` governs the tray icon only, and only for `sync`. See "Status and notifications" above
for what is still reported.

## login

| Option | Meaning |
|---|---|
| `--url <url>` | The site to sign in to. Taken from the checkout when run inside one |
| `-o`, `--oauth` | Use OAuth2 - opens a browser to authorize. Otherwise a username and password are used |
| `-u`, `--user` / `-p`, `--password` | The other way in |

Credentials are stored per site, so every checkout of that site is signed in at once. `login`
deliberately does not create a `.ksync` directory, so running it in the wrong folder leaves nothing
behind.

## logout

| Option | Meaning |
|---|---|
| `--url <url\|domain>` | The site to log out of, as a url or a bare domain. Taken from the checkout when run inside one |

Removes both the OAuth tokens and the cookie login, because leaving one behind is not a logout.
The client registration for this machine is kept, so the next login skips re-registering.

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

Runs the missing-object check over the whole version on the server, and lists the files whose
content it cannot serve. That walk is not cheap on a large branch.

| Exit | Meaning |
|---|---|
| 0 | Every file has its content |
| 1 | Something is missing, and is listed |
| 2 | The command could not be run as given |

An older server that does not know the check answers with HTML, and ksync3 says so rather than
letting a JSON parser complain about a `<`.

## publish

| Option | Meaning |
|---|---|
| `-a`, `--appids <ids>` | Required. `*` for all, a comma separated list of ids, or absolute paths |
| `-f`, `--force` | Republish something already published |
| `-r`, `--report` | Report only, change nothing |

Run from the folder that holds the `apps`, `libs` and `themes` directories. Each asset must have
exactly one version folder inside it.

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

A system-wide install with `sudo` puts the jar in `/usr/local/lib/ksync3` and the launcher in
`/usr/local/bin/ksync3`. `XDG_CONFIG_HOME` is respected on Linux.

Inside a checkout, `.ksync/` holds `ksync.properties` (the recorded `url`, `repoUrl`, `user` and
`remoteHash`), `status.json`, and the local object store. Only `url` is worth reading, and nothing
in there should ever be written by hand.

## The ksync:// URI scheme

The installers register a `ksync://` handler, so a link in the Kademi admin console can launch a
checkout. The part after `ksync://` is a base64 command line. Nothing needs to construct these -
the console does.
