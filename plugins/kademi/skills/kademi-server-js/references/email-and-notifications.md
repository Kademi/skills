# Email and notifications

## Sending email from server JS

[EmailManager](https://docs.kademi.co/ref/templating/md/EmailManager.md) exposes a fluent builder.
`build()` queues the message and returns the
[EmailItem](https://docs.kademi.co/ref/templating/md/EmailItem.md), whose `id` you can log or
store.

```js
const emailItem = services.emailManager.emailBuilder()
    .recipient(profile)                 // or .recipientAddress('someone@example.com')
    .fromAddress(rootFolder.emailAddress)
    .subject('Your order is on its way')
    .html(bodyHtml)
    .text(bodyPlainText)
    .build();

console.log('queued email', emailItem.id);
```

Full option list: [EmailItemBuilder](https://docs.kademi.co/ref/templating/md/EmailItemBuilder.md).
Do not loop over a group and send one message per member from a request handler; that is what
group email jobs and automations are for.

## Email templating

Email bodies and subjects use MVEL, not Velocity: `@{profile.firstName}`, not `$profile.firstName`.

```
@{profile.firstName}, thank you for your payment.

Amount: @{event.attributes.payment.amount}
Invoice number: @{event.attributes.payment.invoiceNum}
Receipt number: @{event.attributes.payment.transactionID}
```

Objects available to an email template: `profile`, `user`, `website`, `formatter`, `event`, and
`login`.

`login` generates a one-time authentication token, so a link can log the recipient straight in:
`/survey1.html?@{login}`. Tokens are valid for seven days. In the shared email base template,
which is Velocity rather than MVEL, the token is reached through the page model object instead.

<https://docs.kademi.co/blogs/docs-kb/send-emails/>

## Calling your app's API from an email

An app can expose a function for email templates to call, which is how you inject data an email
template cannot reach on its own:

```
@{applications.socialLinks.call("genSocialLink", user)}
```

`socialLinks` is the app id, `genSocialLink` the function name, and the remaining arguments are
passed through. The returned value is inserted into the rendered email. Keep these functions
fast and side-effect free: they run once per recipient.

<https://docs.kademi.co/blogs/docs-kb/using-custom-app-api-in-emails/>

## Notifications

"Notify me when X happens" is an automation, not code. Build a trigger on the event you care
about, add a send-email action, and pick an administrative group as the recipient on the
Recipients tab. The event object is available to the email template, so a comment notification can
read:

```
New comment in website @{website.domainName}
Posted by: @{event.sourceProfile.formattedName}
```

Reach for a custom app only when the automation cannot express the condition. If your app raises
the event itself, register the event definition with
`controllerMappings.newEventDefinitionBuilder(id)` and fire it with
`controllerMappings.triggerEvent(eventDefId, properties)`, then let an automation handle the
delivery.

<https://docs.kademi.co/blogs/docs-kb/setup-notifications/>

## Receiving email: mailbox controllers

An app can capture inbound mail for its domain. Register a mailbox mapping with
[MailboxMappingBuilder](https://docs.kademi.co/ref/templating/md/MailboxMappingBuilder.md):

```js
controllerMappings
    .mailboxController()
    .enabled(true)
    .verifyMailbox('verifyMailbox')
    .storeMail('storeMail')
    .build();
```

Two callbacks, in order.

**verifyMailbox(rootFolder, to)** decides whether this mailbox should capture the message. It
receives the website root folder and the recipient address, and must return a boolean.

```js
globalThis.verifyMailbox = (rf, to) => to.domain === 'bloggs.com';
```

The address object carries `user`, `domain`, `personal` and `displayName`, plus `toString()` and
`toPlainAddress()` (the address without the personal part).

**storeMail(rootFolder, to, msg)** runs only if verify returned true, and handles the message.

```js
globalThis.storeMail = (rf, to, msg) => {
    console.log('from', msg.from, 'subject', msg.subject);
    for (const att of msg.attachments) {
        console.log('attachment', att.name, att.contentType);
    }
    // parse msg.text / msg.html, store a record, raise an event...
};
```

`msg` is a
[RepoMailboxStandardMessage](https://docs.kademi.co/ref/templating/md/RepoMailboxStandardMessage.md):
`from`, `to`, `cc`, `bcc`, `replyTo`, `subject`, `text`, `html`, `headers`, `size` and
`attachments`.

Under Nashorn use `formatter.foreach(msg.attachments, function (att) { ... })` rather than
`for...of`, and `log.info` rather than `console.log`.

Inbound mail is untrusted input from anyone who can guess the address. Validate before you act on
it, and never render `msg.html` back into a page without sanitising it.

<https://docs.kademi.co/blogs/docs-kb/handling-email-with-a-custom-app/>

## Becoming the email or SMS sender

An app can take over *delivery* for the whole account - putting a transactional email provider or an
SMS gateway behind Kademi's own send APIs, so every email or text the platform generates goes
through it.

```js
controllerMappings.emailSenderDetails()
    .sendEmailFn('sendEmail')
    .build();

globalThis.sendEmail = (rf, emailItem) => {
    const resp = /* hand the message to the provider */;

    const attempt = services.emailManager.createSendAttempt(emailItem);
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
        services.emailManager.updateEmailComplete(emailItem, false);
    } else {
        attempt.statusDate = formatter.now;
        attempt.status = `${resp.statusCode} - ${resp.statusText}`;
        services.emailManager.updateEmailFailed(emailItem, true);
    }
};
```

The function is called with the account's root folder and an
[EmailItem](https://docs.kademi.co/ref/templating/md/EmailItem.md). **Reporting the outcome back is
the whole contract** - record a send attempt, then call `updateEmailComplete` or
`updateEmailFailed`. An app that sends successfully but never reports leaves every message showing
as pending forever, and the retry logic cannot work.

SMS is the same shape, with a settings function as well:

```js
controllerMappings.smsProviderDetails()
    .sendSmsFn('sendSms')
    .settingsFn('smsSettings')
    .build();

globalThis.sendSms = (rf, smsItem) => {
    // ... send, then report through services.smsManager
    // services.smsManager.setSmsFailed(smsItem, 'reason', formatter.now);
};
```

See
[EmailSenderDetailsBuilder](https://docs.kademi.co/ref/templating/md/EmailSenderDetailsBuilder.md),
[SmsProviderDetailsBuilder](https://docs.kademi.co/ref/templating/md/SmsProviderDetailsBuilder.md),
[EmailManager](https://docs.kademi.co/ref/templating/md/EmailManager.md) and
[SmsManager](https://docs.kademi.co/ref/templating/md/SmsManager.md).

Provider credentials go in app settings holding `${secret.…}` placeholders, read with `getSetting` -
see [kademi-security](../../kademi-security/SKILL.md). A sender app holds the keys to every message
the account sends, so it is the last place to be casual about them.

## Contributing an EDM template

`controllerMappings.addEdmTemplate(...)` registers an email template from your app repository. It
behaves like `addTemplate`, except the template opens in the **EDM editor** and is backed by a dummy
EDM resource rather than a website page. Use it when your app ships a branded email layout that
administrators should be able to edit.
