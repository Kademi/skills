---
name: kademi-rewards
description: Turning sales and activity into reward points on Kademi, and the app-contributed rule types that customise how. Use when the task mentions a points allocation source or PAS, a sales data series or sales records, points rules, points buckets, promotions or rewards, record matching, points or voucher expiry, or point statements - including "create a custom PAS", "these records are not awarding points", "points went to the wrong person", or "award double points for this product category". Covers the sales-data-to-points pipeline, registering a custom points rule type from an app with pointsRuleTypeBuilder, its include and process functions, expiry rule types, record matcher types, and running and resetting allocations.
license: Apache-2.0
metadata:
  author: kademi
  version: "0.1"
---

# Kademi: rewards and points

## The pipeline

```
sales records  ->  record matchers  ->  points allocation source  ->  points rule  ->  points
 (a series)        (optional)           (a PAS, per reward)          (per record)     (to a
                                                                                       profile
                                                                                       or org)
```

| Piece | What it is | Who sets it up |
|---|---|---|
| [SalesDataSeries](https://docs.kademi.co/ref/templating/md/SalesDataSeries.md) | A named stream of sales records - a claims feed, a distributor upload, a POS import | Administrator |
| [SalesDataRecord](https://docs.kademi.co/ref/templating/md/SalesDataRecord.md) | One row: an amount, a period, a `salesBy` entity, optionally a product SKU and extra fields | Imported, or created by an app |
| [RecordMatcher](https://docs.kademi.co/ref/templating/md/RecordMatcher.md) | Groups or splits records before allocation - pairs reversals, rolls line items into a claim | Administrator, using a matcher type |
| **Points allocation source (PAS)** | The rule set that turns the series' records into points against one reward | Administrator, in the admin UI |
| **Points rule type** | The code that decides *whether* a record counts and *how many* points it is worth | **You**, from an app |
| [Reward](https://docs.kademi.co/ref/templating/md/Reward.md) | The points bucket or promotion the points land in; its points system decides profile or organisation | Administrator |

A PAS belongs to exactly one series and allocates against exactly one reward. An account normally
has several per series - one per promotion, product group or participant type.

## Calculating points: three options, pick the lowest

A PAS can work out its points in one of three ways, in increasing order of cost to maintain:

1. **Nothing configured** - the record's own value is allocated as points.
2. **An MVEL expression** on the PAS, with a second MVEL expression filtering which records count.
   Configured entirely in the admin UI, no app needed. This handles most "amount times 2" and
   "only category X" cases.
3. **A points rule type** registered by an app. When a rule type is set it takes over completely:
   it decides inclusion as well as the amount, and the MVEL expressions are ignored.

**Do not write a rule type for something an MVEL expression can do.** Write one when the
calculation needs to look at data outside the record - a recognition level, a lookup table, another
app's state - or when administrators need a named, configurable rule they can reuse across sources.

## Where to go next

| The task | Read |
|---|---|
| Write a custom points rule type - the include and process functions, configuration fields, `BigDecimal`, recipients | [references/points-rule-types.md](references/points-rule-types.md) |
| Points or voucher expiry rules, record matcher types | [references/points-rule-types.md](references/points-rule-types.md) |
| Run, test or reset an allocation; work out why a record awarded nothing | [references/running-allocations.md](references/running-allocations.md) |

## Related managers

| Service | For |
|---|---|
| `services.dataSeriesManager` | Series, records, points allocation sources, running and resetting allocations |
| `services.pointsManager` | Points buckets, crediting and debiting balances, expiry, balance history |
| `services.promotionsManager` | Promotions and points buckets (both are `Reward`), reward categories, reward entries |
| `services.recordMatchingManager` | Record matchers and the destination records they generate |
| `services.voucherManager` | Voucher types, allocation, redemption, status history |

Confirm any method before calling it:
`https://docs.kademi.co/ref/templating/md/<Manager>.md`. See
[kademi-api-reference](../kademi-api-reference/SKILL.md).

When points are *spent* rather than earned - a store that accepts points, a promotion applied at
checkout - that is the commerce surface: [kademi-commerce](../kademi-commerce/SKILL.md).
