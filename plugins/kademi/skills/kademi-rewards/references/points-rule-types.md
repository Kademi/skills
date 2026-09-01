# Rule types an app can register

The rewards surface has four pluggable rule types. Two are registered from an app's
`controllers.xml`/JS; two are account configuration in the Queries repository.

## Creating a custom points rule type

Two JS functions and one registration. Both functions are called with
`(record, ruleParams, allocationSource, recipient)`; `ruleParams` is a map of the configuration
fields the administrator filled in.

```js
// APP-INF/pointsRuleTypes.js

// Optional. Decides whether this record is covered by the rule at all.
// Omit includeFn and every record is included.
function isIncludedCategoryBonus(record, ruleParams) {
    var categoryName = ruleParams.get('categoryName');
    if (formatter.isEmpty(categoryName)) {
        return true;
    }
    var sku = record.findProductSku();
    if (formatter.isNull(sku)) {
        log.info('isIncludedCategoryBonus :: record={} has no sku', record.id);
        return false;
    }
    return sku.getProduct().hasCategory(categoryName);
}

// Required. Returns the number of points, or null to award nothing.
function processCategoryBonus(record, ruleParams) {
    var multiplier = formatter.toBigDecimal(ruleParams.get('multiplier'));
    if (formatter.isNull(multiplier) || formatter.isNull(record.amount)) {
        log.info('processCategoryBonus :: nothing to award for record={}', record.id);
        return null;
    }
    return formatter.toBigDecimal(record.amount).multiply(multiplier);
}
```

```js
// APP-INF/app.js
controllerMappings.pointsRuleTypeBuilder('category-bonus', 'Category bonus multiplier')
    .includeFn('isIncludedCategoryBonus')
    .processFn('processCategoryBonus')
    .addField('categoryName', 'Product category code, not its title', 'Category')
    .addField('multiplier', 'Points per dollar of record amount', 'Multiplier')
    .build();
```

Register the source file in `controllers.xml` like any other, and the rule type appears in the
points rule type picker when an administrator configures a PAS.

Field methods on [PointsRuleTypeBuilder](https://docs.kademi.co/ref/templating/md/PointsRuleTypeBuilder.md):
`addField(name, title)`, `addField(name, helpText, title)`, `addField(name, helpText, title, options)`,
`addField(name, helpText, title, required, options)` and `addFieldWithOptionsFn(name, helpText,
title, required, optionsFn)` - the last one for a dropdown whose options depend on account
configuration, such as the list of recognition topics.

### Rules for these functions

- **Return `null`, not `0`, to award nothing.** Log the reason at info level first; that log line is
  what an administrator will ask you about when a record does not award.
- **Money is `BigDecimal`.** `formatter.toBigDecimal(...)`, then `.multiply(...)`. Native JS
  arithmetic on a Java `BigDecimal` gives you a float and a rounding complaint later.
- `ruleParams` is a Java map: `ruleParams.get('name')`, never `ruleParams.name`.
- **Null-check everything on the record.** A sales record may have no SKU, no `salesBy`, no amount.
- The recipient is not always `record.salesBy`. It may be a team, or the PAS may set a recipient
  expression. Use `formatter.firstNotNull2(record.salesBy, record.salesTeam)` when you have to work
  it out yourself.
- These run once per record over a whole batch. Do not query per record if one query would do -
  but **never cache on module scope**, because app instances are shared across accounts. Use
  `controllerMappings.cacheBuilder()` with `getCacheValue`, which scopes the key per organisation
  and branch for you. See [kademi-security](../../kademi-security/SKILL.md).
- Under GraalJS the functions must be on `globalThis`, and you pass the exported name to
  `processFn` / `includeFn`.

### Allocation type

`INDIVIDUAL` (the default) awards each qualifying record its own points. `SUM` adds up all of a
recipient's records in the batch into one award - it always awards to the record's `salesBy` entity
and ignores the recipient expression.

## Expiry rule types

`controllerMappings.pointsExpiryRuleTypeBuilder(id, title)` registers a rule that decides when
points allocated by a source expire. Same shape as above, but with only a `processFn` - the
function returns the expiry date. See
[PointsExpiryRuleTypeBuilder](https://docs.kademi.co/ref/templating/md/PointsExpiryRuleTypeBuilder.md).

Voucher expiry rules
([JsVoucherExpiryRuleType](https://docs.kademi.co/ref/templating/md/JsVoucherExpiryRuleType.md)) and
record matcher types
([JsRecordMatcherType](https://docs.kademi.co/ref/templating/md/JsRecordMatcherType.md)) are
configured **per account** in the Queries repository, as `voucher-expiry-rules.xml` and
`record-matchers.xml`, not registered from an app. A record matcher type is driven by up to three
functions: `matchFn` (required - groups or splits candidate records into matched source and
destination sets), `candidateCriteriaFn` (narrows the base candidate query) and `revalidateFn`
(rechecks existing matches).

