# Finding out what a site currently looks like

A website repository holds the site's pages, its own `/theme/` overrides and almost nothing else
about how it looks. Everything that gives the site its actual appearance - Bootstrap's defaults,
Kademi's additions and the installed theme's variables - lives outside the checkout. So a checkout
alone cannot answer "what colour is this site" or "which parameters does this theme have", and a
restyle written from the checkout alone is a guess.

This page is the procedure for reading the real values before changing any of them.

---

## The four layers

Theme parameters are merged from exactly four LESS files, in this order. Later wins.

| # | Path | What it is | In the checkout? |
|---|---|---|---|
| 1 | `/theme/less/variables.less` | Bootstrap's own defaults, around 381 variables | no |
| 2 | `/theme/less/extra-variables.less` | Kademi's additions, around 16 variables | no |
| 3 | `/theme/less/theme-variables.less` | the installed theme's variables, around 371 in a typical theme | no |
| 4 | `/theme/theme-params.less` | this site's own overrides | **yes** |

Only layer 4 is a file in the website repository. Layers 1 and 2 come from the Bootstrap base
library and layer 3 from the installed theme; on the site they exist only as an overlay assembled
when the request is served. You cannot sync them and you cannot edit them from the website, but you
can read them, and reading them is the point.

Layer 2 is not purely variables - it carries some mixins as well, so do not treat every line in it
as a parameter you can override.

---

## Step 1 - work out the site's own domain

You do not have to ask for the site URL. The checkout knows where it came from.

> **The `.ksync` rule.** Read the checkout URL out of `.ksync/ksync.properties` - that one value,
> read only. **Never write anything under `.ksync`, and never read or modify any other file in it.**
> The rest of that directory is KSync's own bookkeeping - the `blobs` and `hashes` directories, its
> record of what the server already has - and touching it corrupts the checkout's idea of what has been synced.
> This has already happened to someone.

`.ksync/ksync.properties` is a Java properties file; the line you want is `url`, and colons in it
are backslash-escaped:

```properties
url=http\://rootorg.admin.loopbackdns.com\:8080/repositories/admin-lib/27.0.0/
```

KSync keeps credentials in a per-user file outside the checkout -
`~/.config/ksync/credentials.json` on Linux, `~/Library/Application Support/ksync/credentials.json`
on macOS, `%AppData%\ksync\credentials.json` on Windows - mode 0600, deliberately not in a
project so a commit cannot pick it up. Never read, quote or copy that file. Older checkouts
predating that change still carry a `userUrlHash` token in `ksync.properties`, so take the `url`
line and nothing else either way.

Two things come out of the URL.

**The host** is built as `<org>.admin.<primaryDomain>`. Drop any `:port`, then split on `.admin.`:
the org is on the left, the primary domain on the right. Above, the org is `rootorg` and the primary
domain is `loopbackdns.com`. Take the primary domain from the host - do not pick one from a list. The domains
in use are `kademi.us`, `kademi.com.au`, `kademi.uk`, `kademi.hk`, `kademi-maritz.com`,
`kademiplay.com`, `kademi-qa.co` and `kademi-dr.com`, plus `localhost` and `loopbackdns.com` when
working locally, and which one a given account is on is not something to assume.

**The path** is `/repositories/<repoName>/<version>/`. For a website checkout the repository name
is the website's name.

The website is served on a host of its own, not on the admin host:

```
<version>-<websiteName>-<org>.<primaryDomain>
```

for example `v292chrissrfix-kademi-dev-kademi.kademi.us`. Kademi resolves such a host by stripping
the primary domain, splitting what is left on `-` and matching right to left against what exists:
it takes the last part as the org and, if no such org exists, keeps prepending parts until one does;
then the same for the website; whatever is left is the version. The version part is optional -
leave it off and the live version is served - and a website name containing a hyphen resolves fine,
as that example shows, because the lookup is by existence rather than by position.

Three things to get right when building it:

- **Start with the live site,** `<websiteName>-<org>.<primaryDomain>`, unless you need a specific
  version. It has the fewest ways to go wrong.
- **A version name is matched exactly, with `_` tried where you wrote `-`.** So `ms261_v1` is
  reachable as `ms261-v1-...`, but a version whose name contains a dot, such as `27.0.0`, cannot be
  addressed by host at all - the dot is not restored. Use the live site or ask for the URL.
- **A hyphenated website name is ambiguous only if a suffix of it is also a website in the same
  org.** With sites `dev` and `kademi-dev` both present, `v1-kademi-dev-kademi` resolves to `dev`
  with a version `v1-kademi` that does not exist. Rare; if the host 404s, that is the first thing to
  suspect.
- **A subdomain cannot exceed 63 characters.** A long version plus a long website name plus the org
  can overflow it. If the subdomain you build is longer than 63 characters, stop and ask for the
  site's URL rather than sending a request that cannot resolve.

---

## Step 2 - fetch the four files, in order

They are served over plain HTTP from the website's own domain and need no authentication:

```
curl -sS -o /dev/null -w '%{http_code}\n' https://<siteHost>/theme/less/variables.less
curl -sS https://<siteHost>/theme/less/variables.less
curl -sS https://<siteHost>/theme/less/extra-variables.less
curl -sS https://<siteHost>/theme/less/theme-variables.less
curl -sS https://<siteHost>/theme/theme-params.less
```

What the responses mean:

- **200 with content** on the first three. That is the whole file, as written.
- **204 with an empty body** on `/theme/theme-params.less` is normal and is not a failure: it means
  the site has no overrides yet. Layers 1 to 3 are the whole answer in that case.
- **Use the website's own host.** These paths resolve against a different tree on the admin host, so
  a request there does not return this site's styling, whatever status it comes back with. If you
  find yourself fetching from `<org>.admin.<primaryDomain>`, you have the wrong host.

If the site is not reachable - no network, an unpublished version, a host you cannot build - use the
offline fallback below rather than guessing at parameter names.

---

## Step 3 - read them as a chain, not as four files

- **Later wins.** A variable declared in layer 1 and again in layer 3 has layer 3's value. Reading
  only Bootstrap's `variables.less` and reporting `@brand-primary` from it is wrong on nearly every
  real site.
- **Values are as written, not resolved.** A declaration may be another variable or a LESS
  expression rather than a literal - `@wellBackground: @well-bg;`, or a colour function over some
  other variable. Follow the reference back through the chain yourself until you reach a literal.
- **The resolved value, from a template, is `$rootFolder.themeParams.get("navbar-height")`** - the
  value actually in force, with the layers already merged. Useful for checking one parameter; the
  files are what you want when you need the whole palette or the list of names that exist.

What you now have is the list of parameter names this theme actually defines, which is what makes
`/theme/theme-params.less` safe to write: a name that does not exist, or a value referring to a
variable the theme does not have, fails the whole site's stylesheet compile.

---

## Offline fallback: read the theme's own repository

`WEB-INF/settings.xml` in the website checkout lists the apps installed on the site with the version
of each, including the theme and the Bootstrap base library - for example `k-theme` at `3.4.6` and
`bootstrap-base` at `3.6.2`. Those are Marketplace repositories in their own right, so you can check
them out with KSync and read the same variable files locally, with no request to the site at all:

- layers 1 and 2 from the Bootstrap base library at that version
- layer 3 from the theme at that version

Layer 4 you already have, in the website checkout.

This is also the way to read a theme you are about to install, or to diff two theme versions.

---

## Then, and only then, restyle

With the four layers read, [theming.md](theming.md) covers the decision that follows: a variable in
`/theme/theme-params.less` when a parameter can express the change, a rule in
`/theme/custom-styles.less` when it cannot.
