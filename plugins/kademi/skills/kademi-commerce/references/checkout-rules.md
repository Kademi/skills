# Custom checkout rules

A checkout rule inspects a cart and can add line items to it, or refuse to let it check out. It is
how "spend $200 and get a free sample", "buy 3 get 1 free" and "you may not order this printer
without a toner cartridge" are built.

Administrators add a configured instance of your rule type to a store's checkout rules and fill in
the fields you declared. One rule *type* from your app can be configured many times.

## Register the type

```js
controllerMappings.checkoutRuleTypeBuilder('free-gift', 'Simple free gift')
    .checkItemsFn('freeGiftCheckItems')
    .processCheckoutFn('freeGiftProcessCheckout')
    .addTextField('category', 'Eligible category', false)
    .addTextField('giftSku', 'Gift SKU', true)
    .addTextField('minCartCost', 'Minimum cart cost', false)
    .addTextField('giftText', 'Gift text to display in cart', false)
    .build();
```

`addTextField(id, label, required)` and
`addSelectField(id, label, required, options)` declare the configuration form. Under Nashorn build
the options list with `formatter.toList([...])`. See
[CheckoutRuleTypeBuilder](https://docs.kademi.co/ref/templating/md/CheckoutRuleTypeBuilder.md).

## The two functions

Both take a single `context` argument, and both are called by name - assign them to `globalThis`
under GraalJS.

### checkItemsFn - runs while the cart is being priced

Its job is to decide whether the rule applies and, if it does, add line items. It runs **every time
the cart is rendered**, so make the early exits cheap.

```js
function freeGiftCheckItems(context) {
    if (formatter.isEmpty(context.rule.params.giftSku)) {
        return;                                    // not configured; nothing to do
    }

    var giftSku = services.catalogManager.findSku(context.rule.params.giftSku);
    if (giftSku == null) {
        log.warn('freeGiftCheckItems: no SKU={}', context.rule.params.giftSku);
        return;
    }

    if (formatter.isNotEmpty(context.rule.params.category)
        && !services.cartManager.containsCategory(context.rule.params.category, context.checkoutItems)) {
        return;                                    // no eligible product in the cart
    }

    if (formatter.isNotEmpty(context.rule.params.minCartCost)) {
        var min = formatter.toDouble(context.rule.params.minCartCost);
        var actual = formatter.toDouble(services.cartManager.totalCostIncTax(context.checkoutItems));
        if (actual < min) {
            return;                                // cart is below the threshold
        }
    }

    var item = context.lineItemBuilder()
        .description(context.rule.params.giftText || context.rule.title)
        .productSku(giftSku)
        .quantity(1)
        .build();
    context.addLineItem(item);
}
```

The context is a
[CheckItemsCheckoutRuleContext](https://docs.kademi.co/ref/templating/md/CheckItemsCheckoutRuleContext.md):

| On the context | What it gives you |
|---|---|
| `context.rule` | The configured [CustomCheckoutRule](https://docs.kademi.co/ref/templating/md/CustomCheckoutRule.md) - `rule.params.<fieldId>`, `rule.title`, `rule.promotionName` |
| `context.cart`, `context.purchaser`, `context.store` | The cart, the buying profile, the store |
| `context.mainItems` | Only what the customer put in the cart |
| `context.checkoutItems` | Everything that will show at checkout, **including items other rules added** |
| `context.availablePromos`, `context.activatedPromos` | Rewards available and already activated for this checkout |
| `context.promoActivated` | Whether this rule's declared promotion is active. `true` when the rule declares none |
| `context.lineItemBuilder()`, `context.addLineItem(item)` | Build and add a line |

`mainItems` versus `checkoutItems` is the trap. Testing "is there an eligible product" against
`checkoutItems` means a gift added by an earlier rule can satisfy your own condition, and two rules
can feed each other. Test against `mainItems` unless you genuinely want to react to what other
rules did.

### Tying a rule to a promotion

If the administrator set a promotion name on the rule, honour it. The pattern is: find it, check it
is active, check the purchaser is eligible, check it has been activated for this checkout.

```js
if (formatter.isNotEmpty(context.rule.promotionName)) {
    var promo = services.promotionsManager.findPromotion(context.rule.promotionName);
    if (promo == null || !services.promotionsManager.isActive(promo)) {
        return;
    }
    if (!services.promotionsManager.isElligbleUser(context.purchaser, promo)) {
        return;
    }
    if (!context.promoActivated) {
        return;                                    // e.g. the entry code has not been entered
    }
}
```

Note the platform's spelling of `isElligbleUser`. Confirm it in
[PromotionsManager](https://docs.kademi.co/ref/templating/md/PromotionsManager.md) rather than
guessing at it.

### processCheckoutFn - runs when a matching line is committed

Called once per line item your rule produced, as the order is committed. Its context is a
[ProcessCheckoutRuleContext](https://docs.kademi.co/ref/templating/md/ProcessCheckoutRuleContext.md)
with `context.lineItem` and `context.commitLineItem()`.

For a rule that just adds an item, this is the whole implementation:

```js
function freeGiftProcessCheckout(context) {
    context.commitLineItem();
}
```

Do the extra work here - decrementing a custom allowance, recording an entitlement as used - and
call `commitLineItem()` when you are done. Not calling it means the line does not become part of
the order.

## Line items

```js
var item = context.lineItemBuilder()
    .description('Free sample')
    .productSku(sku)
    .quantity(1)
    .costExTax(formatter.toBigDecimal('0'))
    .taxRate(formatter.toBigDecimal('0.15'))
    .build();
```

`quantity` accepts a `Long`, `Double` or `BigDecimal`; `costExTax`, `tax` and `taxRate` take
`BigDecimal`. Omitting the cost prices the line from the catalogue, which is what you want for a
"buy X get 1 free" where the free unit is the same SKU at zero cost. See
[CheckoutLineItemBuilder](https://docs.kademi.co/ref/templating/md/CheckoutLineItemBuilder.md).

## Blocking a checkout

A mandatory co-purchase rule works the same way, but instead of adding a gift it adds the required
item, or leaves the cart in a state the checkout refuses. Decide which behaviour the account wants
before you build it: silently adding a required product to someone's cart is a surprise, and a
rejection needs a message the shopper can act on.

## Gotchas

- The rule runs on **every cart render**. A `findSku` per line item on a fifty-line cart is fifty
  queries per page view.
- `context.rule.params.<name>` is a Java map lookup - the keys are the field ids you declared, and
  a typo yields `undefined`, not an error.
- Money is `BigDecimal`. `formatter.toDouble` is fine for a threshold comparison, never for a
  price you are about to store.
- Under GraalJS both functions must be on `globalThis`, and the names you pass to `checkItemsFn`
  and `processCheckoutFn` are the exported names.
- Two rules configured on the same store both run. Order is not something you control from the
  rule, so a rule must be correct regardless of what else ran first.
