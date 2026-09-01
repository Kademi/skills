# Intrusion detection and prevention (IDP)

Kademi's IDP engine sits in front of requests. It is how an account rate-limits a
login form, geofences an admin domain, blocks a scraper, whitelists office IPs, or returns a 429
when a metric crosses a threshold - without any app code.

This is **account configuration, not app code.** An account `Administrator` edits it in the admin
console at **/manage-idp/**. Policies live at two scopes: the account, and each website (its
`WEB-INF/idp-policy.xml`). Apps contribute exactly one thing, `dynamicIdpPaths` - see the end.

## The model

```
Policy
 ├─ metrics[]         named counters over a rolling window, evaluated on responses
 ├─ rules[]           each = one condition tree + one action
 ├─ knownIps{}        named lists of IPs, built by rules and tested by conditions
 └─ content-access[]  include/exclude content paths for named groups
```

A **rule** is one boolean **condition** and one **action**. Conditions nest - `All of (AND)`,
`Any of (OR)`, `Not` - so a rule is really a small tree. Metrics are named and referenced from a
condition with `Metric value`, which is what makes rate limiting possible: the metric counts, the
condition compares, the action responds.

Rules that need to know who the user is run after authentication; the rest run before. You do not
choose this - it follows from the conditions you used.

## The canonical shape: rate limit a form

> When the request is a **POST** to **/profile-reset-password** and the metric
> `pwd.resets.by.ip.10mins` is **greater than 10**, **block the request**.

In editor terms: a rule whose condition is `All of (AND)` over `HTTP method is` = POST,
`Request path matches` = `/profile-reset-password`, and `Compare values` of
[`Metric value` = `pwd.resets.by.ip.10mins`] `>` [`Fixed value` = 10]; with the action
`Block the request`.

The metric itself is a `Request count` or `Count of response statuses` over an interval, keyed by
IP. Define it in the policy's metrics first, then reference it by name.

## Conditions

The label is what the editor shows; the class name is what the reference documents.

| Editor label | Class | Matches when |
|---|---|---|
| All of (AND) / Any of (OR) / Not | `AndIDPExpression`, `OrIDPExpression`, `NotIDPExpression` | Combine child conditions |
| Compare values | `CompareIDPExpression` | Two values compare (lt, lte, eq, gte, gt) |
| Metric value | `LookupMetricIDPExpression` | *Yields* a named metric's current value |
| Fixed value | `ConstIDPExpression` | *Yields* a literal, for the other side of a compare |
| Request path matches | `PathIDPExpression` | Path by prefix, suffix or contained text |
| HTTP method is | `MethodIDPExpression` | Method matches exactly |
| Host is | `HostIDPExpression` | Requested host matches |
| Header matches | `HeaderIDPExpression` | A header matches a regex - `*` checks all headers |
| Form parameter matches | `FormParamIDPExpression` | A posted parameter matches a regex - `*` checks all |
| IP starts with | `SourceIpIDPExpression` | Client IP has the prefix |
| IP is in ranges | `KnownIpRangesIDPExpression` | Client IP is in one of the CIDR ranges |
| IP is in known list | `KnownIpIDPExpression`, `KnownIpsIDPExpression` | Client IP is in a named known-IP list |
| IP is whitelisted for this website | `WebsiteIpWhitelistIDPExpression` | Host and IP match the website's whitelist |
| Country is in list | `GeoLocationIDPExpression` | Client IP geolocates to one of the country codes |
| User is in group | `GroupMembershipExpression` | Current user is in one of the groups |
| Has valid CSRF token | `ValidCsrfTokenIDPExpression` | Request carries a valid CSRF token |
| Within date range | `DateRangeIDPExpression` | Now is inside the range - use it to expire a rule |
| Adaptive rate limiter | `MetricBasedLimiterIDPExpression` | Rate exceeds a limit interpolated from another metric |
| Dynamic path type is | `DynamicPathIDPExpression` | Path matches a prefix an app registered for that type |
| Policy property value | `PropertyIDPExpression` | *Yields* a value from the policy's properties |

## Actions

| Editor label | Class | Effect |
|---|---|---|
| Block the request | `AbortRequestIDPAction` | Stops processing and rejects the request |
| Allow and stop checking | `ContinueIDPAction` | Accepts it and skips all later rules - the whitelist action |
| Temporarily block | `AccessBlockIDPAction` | Blocks the user, or on a failed login the attempted username, for N minutes |
| Set response status | `ResponseCodeIDPAction` | Sets the HTTP status, e.g. 429 |
| Set response body | `ResponseBodyIDPAction` | Writes a fixed body and sends immediately |
| Set response header | `SetHeaderIDPAction` | Adds a response header |
| Add IP to known list | `AddKnownIpIDPAction` | Adds the client IP to a named list for later rules |
| Log the request | `LogRequestIDPAction` | Writes it to the IDP log, compact or full |
| Notify administrators | `NotifyAdminIDPAction` | Queues an admin notification |
| Save to data series | `SaveToDataSeriesIDPAction` | Records the request into a sales data series for reporting |
| Record telemetry | `TelemetryIDPAction` | Pushes an account telemetry event |
| Multiple actions | `MultiIDPAction` | Runs several actions in order |

`Allow and stop checking` is order-sensitive by design: put the office-IP whitelist rule above the
rate limits, or your own staff get blocked by them.

## Metrics

Rolling-window counters, evaluated on responses, referenced from conditions by name.

| Editor label | Class | Counts |
|---|---|---|
| Request count | `RequestCountMetric` | Requests to the same URL over the window |
| Count of response statuses | `StatusCodeMetric` | Responses whose status is in a configured set |
| Login attempts count | `LoginsMetric` | Failed or successful logins per user |
| Average response time | `AverageResponseTimeMetric` | Mean response time in ms |
| Fraud score | `FraudScoreIDPMetric` | Recent fraud scores, for user, IP or account |
| Metric for matching requests | `RequestMatchMetric` | Wraps another metric, applying it only to matching requests |

## Content access rules

`IDPContentAccess` includes or excludes content under a path for named groups. It is a coarse
gate in front of content, not a substitute for the authorisation checks your controllers must do -
see [input-and-authorisation.md](input-and-authorisation.md).

## What an app contributes

One thing: `dynamicIdpPaths`, which registers path prefixes under a named **type**.

Its everyday use is `type('excludeCsrf')`, marking endpoints that cannot carry a CSRF token -
webhooks, machine-to-machine APIs, MCP endpoints. That is documented with the rest of CSRF in
[auth.md](../../kademi-server-js/references/auth.md), including why an exempt endpoint still has to
authenticate its caller.

The IDP angle is the other half: a policy rule can match any registered type with the
`Dynamic path type is` condition. So if your app registers its public endpoints under a type, an
account can rate-limit or geofence them **as a group**, and the rule keeps working when your app
adds another endpoint. If your app exposes public endpoints, register them for that reason alone.

Prefixes are collected from every active app and cached for 30 seconds. Registration only takes
effect while the app's mappings are being assembled - a `build()` after that does nothing. See
[IdpDynamicPathsBuilder](https://docs.kademi.co/ref/templating/md/IdpDynamicPathsBuilder.md).

## Gotchas

- **Rule order matters**, and `Allow and stop checking` short-circuits everything below it.
- A rule with no date range runs forever. `Within date range` is how an incident-response rule
  removes itself.
- Metrics are evaluated **on responses**, so a rule comparing a metric is reacting to traffic that
  already completed. That is fine for rate limiting and wrong for anything needing to be atomic.
- Blocking by IP hits everyone behind a corporate NAT. Prefer per-user conditions where the user is
  known, and keep the office ranges in a known-IP list.
- Test on the website scope before the account scope. An account-scope rule that blocks the admin
  domain locks out the people who could fix it.
- The engine is not a substitute for authorisation, validation or CSRF tokens. It is the layer that
  buys time when one of those fails.
