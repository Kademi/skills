# Front-end forms

Registration, login, surveys and payments all have built-in Kademi endpoints. You write the HTML
and post to them over AJAX; the response is JSON carrying a status flag, general messages and
per-field validation messages.

The `jquery.forms` plugin does the plumbing. Call `.forms(...)` on a form and it intercepts the
submit, validates, serialises, POSTs, and maps any `fieldMessages` in the response back onto the
matching inputs.

```javascript
$("#myForm").forms({
    validationFailedMessage: "Please check the details below.",
    callback: function (resp, form) {
        // resp.status is true on success
    }
});
```

The JSON response shape is the same everywhere -
[JsonResult](https://docs.kademi.co/ref/templating/md/JsonResult.md):

```json
{
    "data": null,
    "fieldMessages": [],
    "messages": [],
    "nextHref": "",
    "status": true
}
```

Always check `status`. Never treat an HTTP 200 as success.

---

## Registration forms

Reference: <https://docs.kademi.co/blogs/docs-kb/building-custom-registration-forms/>

Every registration creates a membership of one user group, and **the group is named by the form
action**: post to `/<groupName>/signup`. For a group called `retail-staff`:

```html
<form action="/retail-staff/signup" method="post" id="registerForm" class="form-horizontal">
    <div class="form-group">
        <label for="email">Email</label>
        <input type="email" class="form-control" id="email" name="email" required />
    </div>
    <div class="form-group">
        <label for="nickName">Display name</label>
        <input type="text" class="form-control" id="nickName" name="nickName" required />
    </div>
    <div class="form-group">
        <label for="password">Password</label>
        <input type="password" class="form-control" id="password" name="password" required />
    </div>
    <div class="form-group">
        <label for="confirmPassword">Confirm password</label>
        <input type="password" class="form-control" id="confirmPassword" name="confirmPassword" required />
    </div>

    <input type="hidden" id="orgId" name="orgId" />

    #foreach( $field in $page.extraFields )
        <div class="form-group">
            <label>$formatter.htmlEncode($field.text)</label>
            $field.html
        </div>
    #end

    #if( $page.hasOptins() )
        #foreach( $optin in $page.optins )
            <label>
                <input type="checkbox" name="optins" value="$formatter.htmlAttEncode($optin.name)" />
                $formatter.htmlEncode($optin.message)
            </label>
        #end
    #end

    <button type="submit" class="btn btn-primary">Register</button>
</form>
```

**Input names that carry meaning:**

| Name | Meaning |
|---|---|
| `email` | the email address to register with |
| `nickName` | display name shown to other users |
| `password` | the password to create |
| `confirmPassword` | checked against `password` client side; the server does not require it |
| `orgId` | id of the organisation to join; defaults to the account organisation when empty |
| `optins` | a checkbox per opt-in group the user may also join |

Any custom fields defined on the group can also be posted as inputs. `$page.extraFields` renders
them for you - see [ExtraField](https://docs.kademi.co/ref/templating/md/ExtraField.md).

To let users pick their group, change the form's `action` in JavaScript before submitting.

**Organisation lookup.** GET the same signup URL with `jsonQuery` to search organisations valid
for that group:

```
/retail-staff/signup?jsonQuery=cal&where-brand=Petbarn&th
```

| Parameter | Meaning |
|---|---|
| `jsonQuery` | the text to search for; its presence means "return JSON" |
| `th` | return results shaped for a typeahead widget; no value |
| `where-<field>` | only return organisations whose field `<field>` has the given value |

Results are an array of objects with `title`, `orgId`, `address`, `postcode`, `state`, `phone`
and a `fields` map. Put the chosen `orgId` into the hidden input. For a short list, a `#foreach`
building `<option>` elements is simpler than a typeahead.

**Opt-ins.** Create the extra group, add it as an opt-in in the primary group's settings, then add
a checkbox named `optins` whose value is the opt-in group's name. Users can unsubscribe from it
later on their profile page.

**Log the user in after registering.** Registration does not create a session. Follow a successful
response with a login call using the email and password just submitted.

---

## Login forms

Reference: <https://docs.kademi.co/blogs/docs-kb/login-forms-and-pages/>

Include `theme/js/jquery.user.js`, create a form with inputs named `email` and `password`, and
initialise the user plugin. Form attributes, layout and ids do not matter - only the input names
are read.

The plugin does more than login: it initialises JavaScript variables from cookies, applies
user-state classes so elements can show or hide based on whether anyone is logged in, and binds a
logout handler to everything matching `.logout` (configurable via `logoutSelector`).

To POST directly instead:

```
POST /.dologin
_loginUserName=<user>&_loginPassword=<password>
```

```json
{
    "data": {
        "name": "jsmith",
        "href": "/users/jsmith/public",
        "userName": "jsmith",
        "userId": 99999,
        "photoHash": "0f672c68..."
    },
    "fieldMessages": [],
    "messages": [],
    "nextHref": "",
    "status": true
}
```

`nextHref` is set when a server-side page workflow is in progress - follow it if present.
`photoHash` loads from `/_hashes/files/<hash>`.

**The login template.** When a user hits a resource they are not authorised for, Kademi renders
`/theme/apps/login/login.html` **in place of** the page, with HTTP 400 so it is not cached. That
keeps bookmarks working without redirects.

Prefer this to redirecting unauthorised users away. A login template can tell the difference
between "nobody is logged in" and "you are logged in but lack access", and say so - a redirect
cannot, which makes permission bugs much harder to diagnose.

---

## One-time-password login

Reference: <https://docs.kademi.co/blogs/docs-kb/create-an-otp-login-component/>

A complete worked example of a component plus two controllers. The shape:

**Register the component and two public POST endpoints:**

```javascript
controllerMappings.addComponent("sampleapp/components", "loginOtp", "html", "OTP login form", "sampleapp");

controllerMappings.websiteController()
    .enabled(true).isPublic(true)
    .path('/samples/getOtp')
    .addMethod('POST', 'getOtp')
    .postPriviledge("READ_CONTENT")
    .build();

controllerMappings.websiteController()
    .enabled(true).isPublic(true)
    .path('/samples/loginOtp')
    .addMethod('POST', 'loginOtp')
    .postPriviledge("READ_CONTENT")
    .build();
```

**Step 1 - issue the code.** Find the profile by phone number, generate a password-reset token,
and text it. See [UserManager](https://docs.kademi.co/ref/templating/md/UserManager.md) and
[SmsManager](https://docs.kademi.co/ref/templating/md/SmsManager.md).

```javascript
function getOtp(page, params, files, form) {
    var phone = form.cleanedParam('phone');
    var website = page.find("/").website;

    var um = services.userManager;
    var profiles = um.findMatchingProfiles(um.newProfileMatchRequest().phone(phone));
    if (profiles.size() === 0) {
        return views.jsonResult(true); // do not reveal whether the number is known
    }
    var profile = profiles.get(0);

    transactionManager.runInTransaction(function () {
        var otp = um.generatePasswordReset(profile, website);
        services.smsManager.send(profile, "Your login code is: " + otp.token);
    });
    return views.jsonResult(true);
}
```

**Step 2 - verify and log in.** Look the token up, reject it if missing, already used or expired,
then authenticate.

```javascript
function loginOtp(page, params, files, form) {
    var otp = form.cleanedParam('otp');
    var website = page.find("/").website;

    var passwordReset = services.userManager.findPasswordReset(otp, website);
    if (formatter.isNull(passwordReset)) {
        return views.jsonResult(false, 'Code is not valid');
    }
    if (!formatter.isNull(passwordReset.usedDate)) {
        return views.jsonResult(false, 'Code has already been used');
    }
    var expiry = formatter.addMinutes(passwordReset.createdDate, 10);
    if (formatter.between(expiry, null, formatter.now)) {
        return views.jsonResult(false, 'Code has expired');
    }

    transactionManager.runInTransaction(function () {
        services.securityManager.authenticate(passwordReset.profile.name);
    });
    return views.jsonResult(true, 'Login success');
}
```

Two things worth keeping from that example: **return the same response whether or not the phone
number matched a profile**, so the endpoint cannot be used to enumerate users; and **keep the
expiry window short** - a code delivered by SMS does not need to be valid for days.

The component's `dependencies.json` declares the browser script:

```json
{
    "dependencies": [
        { "js": { "group": "main", "path": "/theme/apps/sampleapp/scripts.js" } }
    ]
}
```

and that script swaps the two panels over as each step succeeds:

```javascript
$(function () {
    $('.panel-get-otp form').forms({
        onSuccess: function () {
            $('.panel-get-otp').hide();
            $('.panel-login-otp').show();
        }
    });
    $('.panel-login-otp form').forms({
        onSuccess: function () {
            window.location.href = '/dashboard';
        }
    });
});
```

Sending real SMS requires an SMS app installed and configured in the account.

---

## Surveys

Reference: <https://docs.kademi.co/blogs/docs-kb/developing-with-surveys/>

A survey is backed by a reward with the survey option enabled. Any HTML form can submit to it:

- the form action is `/rewards/<reward name>`;
- the form must contain an input named `entry` to trigger submission;
- every answer input's name must start with `answer`, for example `answer-pet-name`.

Reading results back:

```velocity
#foreach( $sub in $page.submissions )
    $formatter.htmlEncode($sub.profile.firstName)
    - $formatter.htmlEncode($sub.answers.get("answer-pet-name"))
#end
```

Poll totals and the current user's own answers are also retrievable over AJAX from the reward
URL.

---

## Payment forms

Reference: <https://docs.kademi.co/blogs/docs-kb/create-a-custom-payment-form/>

Card payments POST to a payment endpoint and return the standard JSON result, so the same
`jquery.forms` pattern applies. The parameter names for the built-in eWAY integration are `name`,
`number`, `expiryMonth`, `expiryYear`, `cvn`, `totalAmount` and `currencyCode`.

Card data is a compliance boundary, not just another form:

- use the provider's client-side encryption, or hold a PCI DSS compliance certificate;
- never log, store or echo back a card number or CVN;
- treat the payment provider's response, not the browser's, as the record of what happened -
  never let the page assert its own success back to the server.

Provider credentials are configured in the account's app settings, not in template code.

---

## Other built-in form workflows

Reference: <https://docs.kademi.co/blogs/docs-kb/forms/>

Kademi ships workflows for several form types. Each fires a trigger you can hang further actions
off - emails, group membership, journey steps.

| Workflow | Use | Custom fields | Trigger | Autoresponder |
|---|---|---|---|---|
| Signup | registering new accounts | yes, on the group | Subscription | - |
| Contact us | contact and request forms | yes, all fields recorded | Contact | yes |
| Calendar | event and webinar registration | event-specific fields only | - | yes |
| Products | ordering | yes, on the product | - | - |
| Learning | quizzes and surveys inside modules | yes, all module inputs | ModuleProgress, LearnerProgress, RewardGranted | yes, module completion email |
| Referrals | invite a friend | no | Referral | yes |

Reach for one of these before writing a form from scratch - you get validation, storage,
reporting and triggers without building any of it.

---

## Embedding third-party widgets

Authors can drop arbitrary HTML into a page using the code block component from the Extra
Components app, so you rarely need a custom component just to embed a video or widget:
<https://docs.kademi.co/blogs/docs-kb/embedding-code/>. For video hosted in Kademi there is a
built-in player - see
<https://docs.kademi.co/blogs/docs-kb/embedding-video-on-your-website/>.
