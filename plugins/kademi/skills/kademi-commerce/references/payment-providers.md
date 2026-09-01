# Payment providers

Registering your app as a payment provider makes it appear as a payment option at checkout, and
hands it the cart to charge.

## Register

```js
controllerMappings.paymentProviderDetails()
    .processFn('processPayment')
    .paymentForm('/theme/apps/MyGateway/paymentForm.html')
    .addPaymentOptions('MyGateway', 'Pay by card', '/theme/apps/MyGateway/logo.png')
    .build();
```

| Method | What it does |
|---|---|
| `processFn(name)` | The function that takes the payment. **Required** - build without it and the registration logs a warning and cannot take payments |
| `paymentForm(path)` | Velocity template rendered as the payment step of checkout |
| `addPaymentOptions(id, title, logoHref)` | One selectable option. Call it more than once for a gateway offering several methods |
| `recurring(initFn, makeTokenPaymentFn)` | Opts the provider into subscriptions and instalments |

See
[PaymentProviderDetailsBuilder](https://docs.kademi.co/ref/templating/md/PaymentProviderDetailsBuilder.md).

## The process function

```js
function processPayment(paymentResult, cart, totalAmount, form, purchaser,
                        recurringAmount, repeatMultiples, repeatUnits) {
    var key = services.websiteManager.getSetting('MyGateway', 'apiKey', branch);

    var resp = /* call the gateway */;

    if (resp.approved) {
        paymentResult.paymentCompleted = true;
        paymentResult.resultSummary = 'Approved';
        paymentResult.resultMessage = 'Payment of ' + totalAmount + ' approved';
    } else {
        paymentResult.paymentCompleted = false;
        paymentResult.resultSummary = 'Declined';
        paymentResult.resultMessage = resp.customerSafeMessage;
    }
}
```

You do not return a value. You **populate `paymentResult`**, a
[RepoAppPaymentResult](https://docs.kademi.co/ref/templating/md/RepoAppPaymentResult.md):

| Property | Meaning |
|---|---|
| `paymentCompleted` | Whether the payment succeeded. This is the field the checkout branches on |
| `resultSummary` | Short status, for the order record |
| `resultMessage` | Message shown to the customer - make it something they can act on |
| `nextHref` | Redirect the customer here, for an off-site or 3-D Secure step |
| `paymentTransaction` | The [PaymentTransaction](https://docs.kademi.co/ref/templating/md/PaymentTransaction.md) record, if you created one |

Leaving `paymentCompleted` unset is a declined payment, so a function that throws before setting it
fails safe - but the customer sees nothing useful. Catch, log, set a message.

## Recurring payments

```js
controllerMappings.paymentProviderDetails()
    .processFn('processPayment')
    .recurring('initRecurring', 'makeTokenPayment')
    .build();
```

`initRecurring(paymentResult, cart, totalAmount, repeatMultiples, repeatUnits, form, purchaser)`
sets the schedule up with the gateway and stores the customer token.
`makeTokenPaymentFn` is then called for each later instalment. The platform models the schedule as
a [RecurringTransaction](https://docs.kademi.co/ref/templating/md/RecurringTransaction.md) with a
[DueTransaction](https://docs.kademi.co/ref/templating/md/DueTransaction.md) per instalment.

## Rules

- **Credentials come from app settings holding a `${secret.…}` placeholder**, read with
  `getSetting`. Never `getRawSetting`, never a constant in the file. See
  [kademi-security](../../kademi-security/SKILL.md).
- **Never trust an amount that came from the request.** Charge `totalAmount` as the platform
  computed it.
- **Log the transaction id, never the card data, the full gateway response or the API key.**
- A gateway that redirects off-site needs `nextHref` plus a public return endpoint that verifies a
  signature before marking the order paid - a return URL a customer can hand-edit is a free-order
  bug.
- Test and production endpoints belong in app settings, not in a branch on a hostname.
