# Authentication and hardening

Three separate mechanisms: OAuth 2 for signing users in, IDP policy for CSRF, and IDP policy
again for rate limiting and brute-force defence. Only the first involves app code in the normal
case.

## OAuth 2 sign-in

Kademi can create and link profiles through Facebook, Google or any standards-compliant OAuth 2
provider. The flow:

1. A user clicks "Log me in with X" on a Kademi site.
2. Kademi redirects to the provider's authentication URL with the configured client id, scope and
   redirect URL, plus a base64 `state` value it generated.
3. The user authenticates with the provider and grants the requested scope.
4. The provider redirects back to your `/oauth` URL with an authorisation code and the same
   `state`.
5. Kademi exchanges the code for an access token.
6. Kademi calls the profile URL with the access token to read the user's id and email.
7. The token is linked to the profile for future logins.

Setup is configuration, not code: turn on the Social Media Login app under Website manager ->
Applications, open its settings, and add a provider. A custom provider needs client id, client
secret, authentication URL, token URL, profile URL and scope. The redirect URL must be a full URL
ending in `/oauth`, for example `https://www.mydomain.com/oauth`, and the app has to be enabled on
each website that offers it. Providers can also be specified per website.

<https://docs.kademi.co/blogs/docs-kb/oauth-2/>

An app can contribute its own sign-in provider with
`controllerMappings.signinProvider()` or `controllerMappings.websiteSigninProvider()`, and can
replace the authentication mechanism entirely with
`controllerMappings.authenticationHandler()`, which binds JS functions to the Milton
authentication contract (`supports`, `authenticate`, `isCompatible`, `appendChallenges`,
`credentialsPresent`). See
[AuthHandlerBuilder](https://docs.kademi.co/ref/templating/md/AuthHandlerBuilder.md). Do this only
when configuration genuinely cannot express the requirement: a custom handler sits on the path of
every request.

## CSRF protection

Cross-site request forgery works because a form on the attacker's site submits to yours while the
victim is still logged in. The defence is a token injected into every form and validated on
submit.

This is configured as an IDP policy rule, not in your app. The rule below rejects any POST that
does not carry a valid CSRF token, unless its path is registered as CSRF-exempt.

```xml
<policy>
  <rules>
    <rule>
      <expression class="and">
        <expression class="method" method="POST"/>
        <expression class="not">
          <expression class="valid-csrf"/>
        </expression>
        <expression class="not">
          <expression class="dynamicPath" pathType="excludeCsrf"/>
        </expression>
      </expression>
      <action class="multiAction">
        <setResponse status="SC_BAD_REQUEST"/>
        <abort/>
        <log/>
      </action>
    </rule>
  </rules>
  <properties>
    <entry>
      <string>csrfKeys</string>
      <list>
        <string>my-key-1</string>
        <string>my-key-2</string>
      </list>
    </entry>
    <entry>
      <string>csrfValidMins</string>
      <int>60</int>
    </entry>
  </properties>
</policy>
```

`csrfKeys` is a list so keys can be rotated: add the new key, let the old tokens expire, then drop
the old key. `csrfValidMins` is the token lifetime. The token is checked in the `K-CSRF` header -
see
[ValidCsrfTokenIDPExpression](https://docs.kademi.co/ref/templating/md/ValidCsrfTokenIDPExpression.md).

<https://docs.kademi.co/blogs/docs-kb/idp-implementing-csrf-protection/>

### What your app has to do

Browser form posts get their token automatically. Endpoints that are called by machines - webhook
receivers, callback URLs, API routes consumed by another system - never will, so they must be
registered as CSRF-exempt paths at init time:

```js
controllerMappings
    .dynamicIdpPaths()
    .type('excludeCsrf')
    .addPaths('/my-app/webhook')
    .build();
```

That is what `pathType="excludeCsrf"` in the rule above matches
([IdpDynamicPathsBuilder](https://docs.kademi.co/ref/templating/md/IdpDynamicPathsBuilder.md),
[DynamicPathIDPExpression](https://docs.kademi.co/ref/templating/md/DynamicPathIDPExpression.md)).
Exempting a path removes a protection: exempt the narrowest prefix that works, and authenticate
the caller some other way - a shared secret, a signature header, or a token you issued.

## Brute force and credential stuffing

An attacker guessing passwords or probing for valid email addresses has to make thousands of
requests, and will vary the targeted account to avoid per-account detection. So track rates per
source IP *and* per targeted user, and act when a rate trips.

### Failed logins

Count failed logins over ten minutes and lock the targeted profile for an hour past twenty:

```xml
<policy>
  <rules>
    <rule>
      <expression class="compare" comparator="GT">
        <lhs class="metric" metricName="failed.logins.10mins"/>
        <rhs class="const">
          <value class="int">20</value>
        </rhs>
      </expression>
      <action class="multiAction">
        <accessBlock blockForMins="60"/>
      </action>
    </rule>
  </rules>
  <metrics>
    <entry>
      <string>failed.logins.10mins</string>
      <logins intervalSecs="600" type="FAILED"/>
    </entry>
  </metrics>
</policy>
```

See [LoginsMetric](https://docs.kademi.co/ref/templating/md/LoginsMetric.md) and
[AccessBlockIDPAction](https://docs.kademi.co/ref/templating/md/AccessBlockIDPAction.md).

### Password-reset email harvesting

Before guessing passwords, attackers often find valid addresses by submitting many different
emails to the password reset form. The rule above will not catch that: each account is only tried
once. Track by source IP instead.

```xml
<policy>
  <rules>
    <rule>
      <expression class="and">
        <expression class="method" method="POST"/>
        <expression class="path">
          <pathPrefixes class="java.util.Arrays$ArrayList">
            <a class="string-array">
              <string>/profile-reset-password</string>
            </a>
          </pathPrefixes>
        </expression>
        <expression class="compare" comparator="GT">
          <lhs class="metric" metricName="pwd.resets.by.ip.10mins"/>
          <rhs class="const">
            <value class="int">10</value>
          </rhs>
        </expression>
      </expression>
      <action class="abort"/>
    </rule>
  </rules>
  <metrics>
    <entry>
      <string>pwd.resets.by.ip.10mins</string>
      <requestMatch method="POST">
        <wrapped class="statusCode" intervalSecs="600" metricType="IP">
          <statusCodes>
            <status>SC_OK</status>
          </statusCodes>
        </wrapped>
        <pathPrefixes class="java.util.Arrays$ArrayList">
          <a class="string-array">
            <string>/profile-reset-password</string>
          </a>
        </pathPrefixes>
      </requestMatch>
    </entry>
  </metrics>
  <knownIps/>
  <content-access-rules/>
  <properties/>
</policy>
```

Note the action is `abort`, not a profile lock: the attacker is targeting many accounts, so
locking any one of them punishes the wrong person. Blocking the source IP is reasonable. Combine
this with CSRF tokens and a captcha on the reset form.

<https://docs.kademi.co/blogs/docs-kb/idp-implementing-protection-against-brute-force-attacks/>

Related building blocks:
[RequestMatchMetric](https://docs.kademi.co/ref/templating/md/RequestMatchMetric.md),
[StatusCodeMetric](https://docs.kademi.co/ref/templating/md/StatusCodeMetric.md),
[KnownIpsIDPExpression](https://docs.kademi.co/ref/templating/md/KnownIpsIDPExpression.md),
[AbortRequestIDPAction](https://docs.kademi.co/ref/templating/md/AbortRequestIDPAction.md),
[NotifyAdminIDPAction](https://docs.kademi.co/ref/templating/md/NotifyAdminIDPAction.md).

## Contributing a sign-in provider

An app can add its own entries to the sign-in provider list - the buttons on a login page, or the
providers offered in admin.

```js
controllerMappings.signinProviderDetails()          // admin sign-in
    .signinProvidersFn('listSigninProviders')
    .build();

controllerMappings.websiteSigninProviderDetails()   // website sign-in
    .signinProvidersFn('listWebsiteSigninProviders')
    .build();
```

The named function produces the provider list on demand, so it can vary by website, by account
configuration, or by which of your app's settings have been filled in - which is the reason to use
this rather than declaring providers statically. See
[SigninProviderDetailsBuilder](https://docs.kademi.co/ref/templating/md/SigninProviderDetailsBuilder.md).

A provider you add is an authentication path into the account. Everything in the OAuth 2 section
above applies to it, and the redirect URL must be an exact full URL, not a prefix.

## What your app is still responsible for

IDP policy protects the perimeter. It does not check that the logged-in user is allowed to do the
specific thing they just asked for. Every handler still has to:

- grant and require matching privileges (`.addRole(...)` plus `.postPriviledge(...)`)
- check the current user in the GET handler, not in the path resolver, and deny with
  `page.throwNotAuthorized(msg)`
- extract every parameter through the validation context and check `vc.isValid()`
- never trust an outcome asserted by the client
