# Promotion mechanic types

A promotion mechanic is the *behaviour* behind a promotion: a prize draw, an instant win, a scratch
card, or nothing at all beyond showing content. Administrators create a promotion and pick its
mechanic; your app supplies the mechanic.

A promotion is a [Reward](https://docs.kademi.co/ref/templating/md/Reward.md) - the same entity as a
points bucket, distinguished by its type.

## Register

```js
controllerMappings.promotionMechanicTypeBuilder('content-promo', 'Plain content promotion')
    .description('The mechanic runs outside Kademi; this just shows the promotion content.')
    .icon('fa fa-address-card')
    .editTemplate('/theme/apps/myapp/promo-content-edit.html')
    .summaryTemplate('/theme/apps/myapp/promo-content-summary.html')
    .participantTemplate('/theme/apps/myapp/content-promotion.html')
    .supportsWebsite(true)
    .build();
```

| Method | What it is |
|---|---|
| `editTemplate(path)` | The admin form for configuring an instance of this mechanic |
| `summaryTemplate(path)` | How the configured mechanic is summarised in the admin UI |
| `participantTemplate(path)` | What a participant sees on the website |
| `saveMechanicDetailsFn(name)` | Function that persists the mechanic's own settings from the edit form |
| `createMetricsFn(name)` | Function that creates the metrics reported for this mechanic |
| `supportsWebsite(bool)` | Whether the mechanic can be surfaced on a website as well as in admin |
| `icon(s)`, `description(s)` | How it presents in the mechanic picker |

Both chained setters and plain `setXxx` bean setters are exported, so either style works. See
[PromotionMechanicTypeBuilder](https://docs.kademi.co/ref/templating/md/PromotionMechanicTypeBuilder.md).

## The three templates

They are ordinary Velocity templates in your app, and the split matters:

- **edit** and **summary** are admin surfaces - follow
  [kademi-admin-ui](../../kademi-admin-ui/SKILL.md).
- **participant** is a website surface, seen by end users - follow
  [kademi-themes](../../kademi-themes/SKILL.md), and remember it renders for an unauthenticated or
  low-privilege visitor.

Register a participant template that content authors can also place on a page with
`controllerMappings.addTemplate(parentPath, fileName, description, contentTemplate)`.

## Entries

Participation is recorded as a
[RewardEntry](https://docs.kademi.co/ref/templating/md/RewardEntry.md). Build and submit one with
`services.promotionsManager.newRewardEntryBuilder(reward, profile)` and `submitEntry(builder)`, and
mark a winner with `updateWinningEntry(entry)`.

Before accepting an entry, check the promotion is open and the entrant is allowed:

```js
var promo = services.promotionsManager.findPromotion(promoName);
if (promo == null || !services.promotionsManager.isActive(promo)) {
    return views.jsonResult(false, 'This promotion is not running');
}
if (!services.promotionsManager.isElligbleUser(profile, promo)) {
    return views.jsonResult(false, 'You are not eligible for this promotion');
}
```

Note the platform's spelling of `isElligbleUser`.
[PromotionsManager](https://docs.kademi.co/ref/templating/md/PromotionsManager.md) also has
`isStarted`, `isMatchingPromoCode`, `numEntries`, `countPromotionEntries`,
`findRewardEntriesForUser` and the participant search builder.

## Rules

- **The entry endpoint is a public write path.** Validate, check eligibility server-side, and
  enforce entry limits in the same transaction that writes the entry - two clicks and a slow
  network is the classic double-entry bug.
- Never decide a winner in browser JavaScript. Draw and instant-win outcomes are decided
  server-side or they are not decided at all.
- Promotions are soft deleted and date-bounded. `isActive` is not the same as "exists".
