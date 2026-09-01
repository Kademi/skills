---
name: kademi-commerce
description: Building on Kademi's e-commerce surface - stores, product catalogues, carts and checkout. Use when the task mentions a store, shop, product, SKU, category, cart, checkout, order, shipping, tax, a payment provider or gateway, a promo code, a prize draw or instant win, or "buy X get one free" style offers. Covers registering a custom checkout rule type that inspects the cart and adds or blocks line items, registering an app as a payment provider including recurring payments, promotion mechanic types, and the catalog, cart and payment managers. Use when a checkout is rejecting a cart, a free gift or discount is not appearing, a payment gateway integration needs writing, or an order total comes out wrong.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: commerce

## The model

```
Website
 └─ ECommerceStore ── PricingConfiguration (currency, tax, shipping, points buckets, order ids)
     ├─ Products ─ ProductSku ─ Category
     └─ Cart ─ CheckoutLineItem[] ─ checkout ─ payment provider ─ ProductOrder
```

A website can have several **stores**, each named uniquely within it. Products belong to a store
through `ProductInEComStore`, not by a field on the product. Stores are **soft deleted** - the
finders skip rows with a `deletedDate`, and so must anything you write that reads them directly.

| Thing | Class |
|---|---|
| Shop front | [ECommerceStore](https://docs.kademi.co/ref/templating/md/ECommerceStore.md) |
| Store pricing and behaviour | [PricingConfiguration](https://docs.kademi.co/ref/templating/md/PricingConfiguration.md) |
| Product and its purchasable variants | [Product](https://docs.kademi.co/ref/templating/md/Product.md), [ProductSku](https://docs.kademi.co/ref/templating/md/ProductSku.md) |
| Cart, and a line on it | [Cart](https://docs.kademi.co/ref/templating/md/Cart.md), [CheckoutLineItem](https://docs.kademi.co/ref/templating/md/CheckoutLineItem.md) |
| Completed order | [ProductOrder](https://docs.kademi.co/ref/templating/md/ProductOrder.md) |
| A promotion, and a points bucket - both are this | [Reward](https://docs.kademi.co/ref/templating/md/Reward.md) |

## What an app contributes

Three extension points. Everything else - stores, products, categories, prices, shipping and tax
settings - is administrator configuration, not code.

| You want | Register | Read |
|---|---|---|
| A cart-level offer or restriction: free gift, buy-X-get-1, mandatory co-purchase, "you may not order this without that" | `controllerMappings.checkoutRuleTypeBuilder(id, title)` | [references/checkout-rules.md](references/checkout-rules.md) |
| To take payment through a gateway the platform does not support | `controllerMappings.paymentProviderDetails()` | [references/payment-providers.md](references/payment-providers.md) |
| A new kind of promotion behaviour: prize draw, instant win | `controllerMappings.promotionMechanicTypeBuilder(id, title)` | [references/promotion-mechanics.md](references/promotion-mechanics.md) |

If the requirement is a *price* change rather than a cart change, look at the store's pricing
configuration and the shipping and tax providers first - `ExpressionShippingProvider` takes an MVEL
expression and needs no app at all.

## Managers

| Service | For |
|---|---|
| `services.catalogManager` | Products, SKUs, categories, aliases, images, parameters. `findSku(skuCode)` is the workhorse |
| `services.cartManager` | Carts, orders, fulfilment status, promo codes, totals, `doProcessCart` |
| `services.paymentManager` | Payment transactions and providers |
| `services.promotionsManager` | Promotions and points buckets (both `Reward`), eligibility, activity |

[CatalogManager](https://docs.kademi.co/ref/templating/md/CatalogManager.md),
[CartManager](https://docs.kademi.co/ref/templating/md/CartManager.md),
[PromotionsManager](https://docs.kademi.co/ref/templating/md/PromotionsManager.md).

Confirm any method before you call it - see
[kademi-api-reference](../kademi-api-reference/SKILL.md).

## Rules that bite here

- **Money is `BigDecimal`.** `formatter.toBigDecimal(...)` then `.multiply(...)` / `.add(...)`.
  Native JS arithmetic silently converts to a float and the totals drift by cents.
- **A checkout rule runs on every cart render, not just at checkout.** Return early and cheaply
  when the rule does not apply; do not query per line item if one query up front will do.
- **Soft deletes everywhere.** Stores, SKUs and promotions are deleted by date, not by removal.
- **Never trust a price, quantity or SKU that arrived in a request.** Look the SKU up server-side
  and price it from the catalogue - see [kademi-security](../kademi-security/SKILL.md).
- Points paid against a purchase are a debit on a points bucket, so a store that accepts points is
  also a rewards surface - see [kademi-rewards](../kademi-rewards/SKILL.md).
