# Triggers and events

Three separate mechanisms move a journey along. They are easy to confuse.

| Mechanism | Started by | Configured by an administrator as | Extended by your app with |
|---|---|---|---|
| **Goal node** | An event reaching a lead parked at the node | A box on the funnel canvas | `addGoalNodeType` |
| **Entry criteria** | An event matching the goal a `Begin` node points at, for someone with no lead yet | The funnel's entry point | the same goal node type |
| **Automation** | An event matching a configured trigger, with no lead parked anywhere | A trigger plus actions, in the funnel's automations tab | `addFunnelTriggerType`, `addFunnelActionType` |

Before building anything, check whether the platform already fires what you need.

## Is there already a trigger for this?

### Learning

- [ModuleProgressEvent](https://docs.kademi.co/ref/templating/md/ModuleProgressEvent.md) - a
  learner starts, saves, completes, renews, expires or languishes on a module.
- [ModuleFunnelTriggerType](https://docs.kademi.co/ref/templating/md/ModuleFunnelTriggerType.md) -
  the automation trigger for the above.
- [ModuleProgressGoal](https://docs.kademi.co/ref/templating/md/ModuleProgressGoal.md),
  [ModuleExpiryGoal](https://docs.kademi.co/ref/templating/md/ModuleExpiryGoal.md) - the goal nodes.

### E-commerce, quotes and auctions

- [ShoppingCartFunnelEvent](https://docs.kademi.co/ref/templating/md/ShoppingCartFunnelEvent.md),
  [ShoppingCartFunnelTriggerType](https://docs.kademi.co/ref/templating/md/ShoppingCartFunnelTriggerType.md),
  [ShoppingCartGoal](https://docs.kademi.co/ref/templating/md/ShoppingCartGoal.md) - item added,
  checkout completed, payment pending.
- [ShoppingCartFulfillmentStatusEvent](https://docs.kademi.co/ref/templating/md/ShoppingCartFulfillmentStatusEvent.md),
  [OrderStatusGoal](https://docs.kademi.co/ref/templating/md/OrderStatusGoal.md) - fulfilment moves
  to shipped, delivered and so on.
- [QuoteSentEvent](https://docs.kademi.co/ref/templating/md/QuoteSentEvent.md),
  [QuoteAcceptedEvent](https://docs.kademi.co/ref/templating/md/QuoteAcceptedEvent.md),
  [QuoteRejectedEvent](https://docs.kademi.co/ref/templating/md/QuoteRejectedEvent.md) with
  [SentQuoteGoal](https://docs.kademi.co/ref/templating/md/SentQuoteGoal.md) and
  [AcceptQuoteGoal](https://docs.kademi.co/ref/templating/md/AcceptQuoteGoal.md).
- [AuctionBidEvent](https://docs.kademi.co/ref/templating/md/AuctionBidEvent.md),
  [AuctionClosedEvent](https://docs.kademi.co/ref/templating/md/AuctionClosedEvent.md),
  [AuctionBidFunnelTriggerType](https://docs.kademi.co/ref/templating/md/AuctionBidFunnelTriggerType.md),
  [AuctionClosedFunnelTriggerType](https://docs.kademi.co/ref/templating/md/AuctionClosedFunnelTriggerType.md),
  [AuctionBidGoal](https://docs.kademi.co/ref/templating/md/AuctionBidGoal.md).

### Rewards, points, vouchers and recognition

- [RewardGrantedFunnelEvent](https://docs.kademi.co/ref/templating/md/RewardGrantedFunnelEvent.md),
  [RewardDebitedFunnelEvent](https://docs.kademi.co/ref/templating/md/RewardDebitedFunnelEvent.md),
  [RewardGrantedFunnelTriggerType](https://docs.kademi.co/ref/templating/md/RewardGrantedFunnelTriggerType.md).
- [PointsTransactionAddedGoal](https://docs.kademi.co/ref/templating/md/PointsTransactionAddedGoal.md) -
  any credit or debit.
- [PointsValueReachedGoal](https://docs.kademi.co/ref/templating/md/PointsValueReachedGoal.md) - a
  balance crosses a threshold.
- [PromotionEntryGoal](https://docs.kademi.co/ref/templating/md/PromotionEntryGoal.md) - a
  promotion or reward entry is granted.
- [VoucherFunnelEvent](https://docs.kademi.co/ref/templating/md/VoucherFunnelEvent.md),
  [VoucherStateGoal](https://docs.kademi.co/ref/templating/md/VoucherStateGoal.md) - a voucher is
  issued or changes state.
- [RecognitionEvent](https://docs.kademi.co/ref/templating/md/RecognitionEvent.md),
  [RecognitionLevelAchievedEvent](https://docs.kademi.co/ref/templating/md/RecognitionLevelAchievedEvent.md),
  [RecognitionCloseToLevelEvent](https://docs.kademi.co/ref/templating/md/RecognitionCloseToLevelEvent.md),
  [RecognitionLostEvent](https://docs.kademi.co/ref/templating/md/RecognitionLostEvent.md), each
  with a matching trigger type:
  [RecognitionFunnelTriggerType](https://docs.kademi.co/ref/templating/md/RecognitionFunnelTriggerType.md),
  [RecognitionLevelAchievedFunnelTriggerType](https://docs.kademi.co/ref/templating/md/RecognitionLevelAchievedFunnelTriggerType.md),
  [RecognitionCloseToLevelFunnelTriggerType](https://docs.kademi.co/ref/templating/md/RecognitionCloseToLevelFunnelTriggerType.md),
  [RecognitionLostFunnelTriggerType](https://docs.kademi.co/ref/templating/md/RecognitionLostFunnelTriggerType.md).

### Profiles, groups and credentials

- [ProfileUpdatedEvent](https://docs.kademi.co/ref/templating/md/ProfileUpdatedEvent.md),
  [ProfileUpdatedFunnelTriggerType](https://docs.kademi.co/ref/templating/md/ProfileUpdatedFunnelTriggerType.md),
  [ProfileUpdatedGoal](https://docs.kademi.co/ref/templating/md/ProfileUpdatedGoal.md).
- [SubscriptionFunnelEvent](https://docs.kademi.co/ref/templating/md/SubscriptionFunnelEvent.md),
  [GroupGoal](https://docs.kademi.co/ref/templating/md/GroupGoal.md) - membership subscribed,
  accepted, rejected, pending, removed, lapsed, payment overdue.
- [KademiSubscriptionEvent](https://docs.kademi.co/ref/templating/md/KademiSubscriptionEvent.md),
  [KademiSubscriptionGoal](https://docs.kademi.co/ref/templating/md/KademiSubscriptionGoal.md) -
  platform subscription lifecycle.
- [CredentialSetFunnelEvent](https://docs.kademi.co/ref/templating/md/CredentialSetFunnelEvent.md),
  [CredentialUpdatedEvent](https://docs.kademi.co/ref/templating/md/CredentialUpdatedEvent.md),
  [CredentialSetGoal](https://docs.kademi.co/ref/templating/md/CredentialSetGoal.md),
  [CredentialUpdatedFunnelTriggerType](https://docs.kademi.co/ref/templating/md/CredentialUpdatedFunnelTriggerType.md),
  [CredentialDisabledFunnelTriggerType](https://docs.kademi.co/ref/templating/md/CredentialDisabledFunnelTriggerType.md).
- [LoginEvent](https://docs.kademi.co/ref/templating/md/LoginEvent.md).

### Web activity

- [PageHitFunnelEvent](https://docs.kademi.co/ref/templating/md/PageHitFunnelEvent.md),
  [PageViewedFunnelTriggerType](https://docs.kademi.co/ref/templating/md/PageViewedFunnelTriggerType.md),
  [PageViewedGoal](https://docs.kademi.co/ref/templating/md/PageViewedGoal.md).
- [UserVisitEvent](https://docs.kademi.co/ref/templating/md/UserVisitEvent.md),
  [UserVisitFunnelTriggerType](https://docs.kademi.co/ref/templating/md/UserVisitFunnelTriggerType.md),
  [UserVisitGoal](https://docs.kademi.co/ref/templating/md/UserVisitGoal.md) - first request in at
  least 24 hours.
- [ContactFormSubmittedFunnelEvent](https://docs.kademi.co/ref/templating/md/ContactFormSubmittedFunnelEvent.md),
  [ContactFormFunnelTriggerType](https://docs.kademi.co/ref/templating/md/ContactFormFunnelTriggerType.md),
  [ContactFormGoal](https://docs.kademi.co/ref/templating/md/ContactFormGoal.md).
- [FileUploadEvent](https://docs.kademi.co/ref/templating/md/FileUploadEvent.md),
  [FileUploadFunnelTriggerType](https://docs.kademi.co/ref/templating/md/FileUploadFunnelTriggerType.md).
- [FormSubmittedEvent](https://docs.kademi.co/ref/templating/md/FormSubmittedEvent.md),
  [FormGoal](https://docs.kademi.co/ref/templating/md/FormGoal.md) - the form on a funnel form node.

### Social and community

- [NewCommentEvent](https://docs.kademi.co/ref/templating/md/NewCommentEvent.md),
  [CommentFunnelTriggerType](https://docs.kademi.co/ref/templating/md/CommentFunnelTriggerType.md).
- [ForumTopicCreatedEvent](https://docs.kademi.co/ref/templating/md/ForumTopicCreatedEvent.md).
- [VotedEvent](https://docs.kademi.co/ref/templating/md/VotedEvent.md),
  [VoteReceivedEvent](https://docs.kademi.co/ref/templating/md/VoteReceivedEvent.md),
  [VotesFunnelTriggerType](https://docs.kademi.co/ref/templating/md/VotesFunnelTriggerType.md).
- [SocialInteractionEvent](https://docs.kademi.co/ref/templating/md/SocialInteractionEvent.md),
  [SocialInteractionGoal](https://docs.kademi.co/ref/templating/md/SocialInteractionGoal.md).
- [ReferralEvent](https://docs.kademi.co/ref/templating/md/ReferralEvent.md),
  [ReferralSentGoal](https://docs.kademi.co/ref/templating/md/ReferralSentGoal.md),
  [ReferralSignupGoal](https://docs.kademi.co/ref/templating/md/ReferralSignupGoal.md).

### Sales data

- [SalesRecordCreatedFunnelEvent](https://docs.kademi.co/ref/templating/md/SalesRecordCreatedFunnelEvent.md),
  [SalesDataRecodFunnelEvent](https://docs.kademi.co/ref/templating/md/SalesDataRecodFunnelEvent.md)
  (created, updated or deleted),
  [SalesRecordCreatedFunnelTriggerType](https://docs.kademi.co/ref/templating/md/SalesRecordCreatedFunnelTriggerType.md),
  [SalesRecordCreatedGoal](https://docs.kademi.co/ref/templating/md/SalesRecordCreatedGoal.md).
- [DataSeriesValueGoal](https://docs.kademi.co/ref/templating/md/DataSeriesValueGoal.md) - a running
  total crosses a threshold.

### Messaging outcomes

- [EmailSendFunnelEvent](https://docs.kademi.co/ref/templating/md/EmailSendFunnelEvent.md),
  [EmailSendGoal](https://docs.kademi.co/ref/templating/md/EmailSendGoal.md).
- [EmailDeliveryFunnelEvent](https://docs.kademi.co/ref/templating/md/EmailDeliveryFunnelEvent.md),
  [EmailResultGoal](https://docs.kademi.co/ref/templating/md/EmailResultGoal.md),
  [EmailInteractionGoal](https://docs.kademi.co/ref/templating/md/EmailInteractionGoal.md).
- [SmsDeliveryFunnelEvent](https://docs.kademi.co/ref/templating/md/SmsDeliveryFunnelEvent.md),
  [SmsResultGoal](https://docs.kademi.co/ref/templating/md/SmsResultGoal.md).

### Tasks and lead lifecycle

- [TaskCompleteFunnelEvent](https://docs.kademi.co/ref/templating/md/TaskCompleteFunnelEvent.md),
  [TaskCompleteGoal](https://docs.kademi.co/ref/templating/md/TaskCompleteGoal.md),
  [TaskGoal](https://docs.kademi.co/ref/templating/md/TaskGoal.md) (creates a
  [TaskDef](https://docs.kademi.co/ref/templating/md/TaskDef.md)-based task then waits for a
  matching [TaskOutcome](https://docs.kademi.co/ref/templating/md/TaskOutcome.md)).
- [LeadCreatedEvent](https://docs.kademi.co/ref/templating/md/LeadCreatedEvent.md),
  [LeadUpdatedEvent](https://docs.kademi.co/ref/templating/md/LeadUpdatedEvent.md),
  [LeadClosedEvent](https://docs.kademi.co/ref/templating/md/LeadClosedEvent.md),
  [LeadEndedEvent](https://docs.kademi.co/ref/templating/md/LeadEndedEvent.md).
- [LeadUpdatedGoal](https://docs.kademi.co/ref/templating/md/LeadUpdatedGoal.md) - the lead reaches
  one of a list of stages.
- [OtherJourneyProgressGoal](https://docs.kademi.co/ref/templating/md/OtherJourneyProgressGoal.md) -
  another lead for the same profile is created or closed.

### Structural nodes, with no event behind them

- [TimerGoal](https://docs.kademi.co/ref/templating/md/TimerGoal.md) - wait a fixed period.
- [StopGoGoal](https://docs.kademi.co/ref/templating/md/StopGoGoal.md) - wait for a human, released
  by a [GoFunnelEvent](https://docs.kademi.co/ref/templating/md/GoFunnelEvent.md).
- [BranchGoal](https://docs.kademi.co/ref/templating/md/BranchGoal.md) - wait on several goals at
  once.
- [DecisionAction](https://docs.kademi.co/ref/templating/md/DecisionAction.md) - branch on rules.
- [TestSplitAction](https://docs.kademi.co/ref/templating/md/TestSplitAction.md) - A/B split.
- [ForkGoalAction](https://docs.kademi.co/ref/templating/md/ForkGoalAction.md) - split into parallel
  branches.
- [EndGoalAction](https://docs.kademi.co/ref/templating/md/EndGoalAction.md),
  [CancelGoalAction](https://docs.kademi.co/ref/templating/md/CancelGoalAction.md).
- [StartFunnelGoalAction](https://docs.kademi.co/ref/templating/md/StartFunnelGoalAction.md),
  [StartAndWaitFunnelGoal](https://docs.kademi.co/ref/templating/md/StartAndWaitFunnelGoal.md).
- [OneShotFunnelTriggerType](https://docs.kademi.co/ref/templating/md/OneShotFunnelTriggerType.md) -
  restrict another trigger to firing at most once per entity.
- [DateFilterFunnelTriggerType](https://docs.kademi.co/ref/templating/md/DateFilterFunnelTriggerType.md) -
  gate a trigger on a date window.

### Built-in actions worth reusing before writing your own

[SendEmailGoalAction](https://docs.kademi.co/ref/templating/md/SendEmailGoalAction.md),
[SendSmsAction](https://docs.kademi.co/ref/templating/md/SendSmsAction.md),
[SetFieldGoalAction](https://docs.kademi.co/ref/templating/md/SetFieldGoalAction.md),
[CreateNoteGoalAction](https://docs.kademi.co/ref/templating/md/CreateNoteGoalAction.md),
[CreateTaskGoalAction](https://docs.kademi.co/ref/templating/md/CreateTaskGoalAction.md),
[CreateCalendarEventGoalAction](https://docs.kademi.co/ref/templating/md/CreateCalendarEventGoalAction.md),
[CreateDataSeriesRecordGoalAction](https://docs.kademi.co/ref/templating/md/CreateDataSeriesRecordGoalAction.md),
[AddToGroupGoalAction](https://docs.kademi.co/ref/templating/md/AddToGroupGoalAction.md),
[RemoveFromGroupGoalAction](https://docs.kademi.co/ref/templating/md/RemoveFromGroupGoalAction.md),
[ProcessMembershipGoalAction](https://docs.kademi.co/ref/templating/md/ProcessMembershipGoalAction.md),
[AddToOrgTypeGoalAction](https://docs.kademi.co/ref/templating/md/AddToOrgTypeGoalAction.md),
[RemoveOrgTypeGoalAction](https://docs.kademi.co/ref/templating/md/RemoveOrgTypeGoalAction.md),
[RemoveProfileGoalAction](https://docs.kademi.co/ref/templating/md/RemoveProfileGoalAction.md),
[AssignToGoalAction](https://docs.kademi.co/ref/templating/md/AssignToGoalAction.md),
[GrantRewardsGoalAction](https://docs.kademi.co/ref/templating/md/GrantRewardsGoalAction.md),
[DebitPointsGoalAction](https://docs.kademi.co/ref/templating/md/DebitPointsGoalAction.md),
[AllocateVoucherGoalAction](https://docs.kademi.co/ref/templating/md/AllocateVoucherGoalAction.md),
[ActivateAlertAction](https://docs.kademi.co/ref/templating/md/ActivateAlertAction.md),
[AttachLeadFileGoalAction](https://docs.kademi.co/ref/templating/md/AttachLeadFileGoalAction.md),
[CopyLeadFileGoalAction](https://docs.kademi.co/ref/templating/md/CopyLeadFileGoalAction.md),
[SetSourceLeadGoalAction](https://docs.kademi.co/ref/templating/md/SetSourceLeadGoalAction.md).

## Engagement scoring

A lead's **engagement score** is computed from dates of engagement activity, contributed by a set of
scoring factor types. The platform ships factors for web visits, email responses, contact forms,
comments, credentials and product orders. An app adds its own:

```js
controllerMappings.addEngagementScoringFactorType(
    'trainingCompletions',                 // id
    'Training completions',                // label shown when configuring scoring
    'trainingFactorProperties',            // function returning the factor's configurable properties
    'findTrainingEngagementDates'          // function returning the dates the lead engaged
);

globalThis.findTrainingEngagementDates = (/* lead context */) => {
    // return the dates this lead engaged through your app
};
```

Both function arguments may be a function name or an actual function. Registration is ignored once
the app's engine has finished initialising.

You return **dates, not scores**. The platform does the weighting and decay, which is why an app
factor stays comparable with the built-in ones and why an administrator can retune scoring without
you changing code. See
[RepoAppEngagementScoringFactorType](https://docs.kademi.co/ref/templating/md/RepoAppEngagementScoringFactorType.md)
and the Engagement Scoring Factor Types section of the reference index.

## Legacy registrations

`controllerMappings.automationTrigger(...)` builds a legacy automation trigger type. **New apps use
`addFunnelTriggerType`** (above). It is listed here only so that an existing app calling it is
recognised for what it is.

`funnelActionTypesFunction(fn)` is the on-demand counterpart to declaring action types statically:
the named function is called with the list to add action types to, so the set can depend on account
configuration. Use it when your action types vary per account; declare them statically otherwise.

## Firing your own journey event

The simplest and most common case. `eventManager`
([EventWrapper](https://docs.kademi.co/ref/templating/md/EventWrapper.md)) fires a
[RepoAppFunnelEvent](https://docs.kademi.co/ref/templating/md/RepoAppFunnelEvent.md) whose event id
is a **goal node type name**. Every goal node of that type, on every funnel, gets offered the event.

```js
/* global eventManager, formatter, log */

function fireWarrantyApproved(warrantyId, warrantyType, profile) {
    var params = formatter.newMap();
    params.put('warrantyId', warrantyId + '');
    params.put('warrantyType', warrantyType);

    if (formatter.isNull(profile)) {
        eventManager.goalAchieved('warrantyApprovedGoal', params);   // current logged-in user
    } else {
        eventManager.goalAchieved('warrantyApprovedGoal', profile, params);
    }
}
```

Overloads: `goalAchieved(name)`, `goalAchieved(name, params)`,
`goalAchieved(name, profile)`, `goalAchieved(name, profile, params)`. The forms without a profile
require a current logged-in user and throw without one, so pass the profile explicitly from any
background or webhook context.

### Put ids on events, not entities

Event parameters are a `Map<String,String>`, and the funnel engine can recreate an event from a map
of serializable properties in order to replay it. Carry **entity ids and plain strings**, and
re-resolve the record inside the goal or action handler. A live database entity attached to an event
may be read long after the session that loaded it has gone.

The corollary on the receiving side: a goal handler that gets `params.get('warrantyId')` should look
the warranty up itself, and cope with it having been deleted since.

## Firing a trigger event

Where `goalAchieved` targets goal *nodes*, `fireTrigger` targets *automations*.

```js
eventManager.fireTrigger(profile, website, 'warrantyApproved', attributes, conditions);
```

For anything beyond the simplest call, use the builder
([EventBuilder](https://docs.kademi.co/ref/templating/md/EventBuilder.md)):

```js
eventManager.eventBuilder()
    .withProfile(profile)
    .withWebsite('main')
    .withTriggerId('warrantyApproved')
    .addAttribute('warrantyId', warrantyId + '')
    .addAttribute('warrantyType', warrantyType)
    .fireEvent();
```

## Registering a custom automation trigger type

An administrator picks a trigger, fills in its fields, and attaches actions to it. Your trigger type
says which event id it listens for and, optionally, names a function that decides whether a given
event actually matches the administrator's configuration.

```js
controllerMappings
    .addFunnelTriggerType('onWarrantyApproved', 'Warranty approved', 'warrantyApproved')
    .description('Fires when a warranty claim is approved')
    .checkMatchFn('checkWarrantyApprovedTrigger')
    .addField('warrantyType', 'Warranty type', false, null)
    .addFieldWithOptionsFn('websiteName', 'Website', true, listWebsites)
    .itemIdField('warrantyId')
    .build();

/**
 * @param {Object} event the fired event
 * @param {Map} triggerParams the fields the administrator configured on this trigger
 * @returns {boolean} true if this event should fire this trigger
 */
function checkWarrantyApprovedTrigger(event, triggerParams) {
    var wanted = triggerParams.get('warrantyType');
    if (formatter.isEmpty(wanted)) {
        return true;
    }
    return formatter.isEqual(wanted, event.parameters.get('warrantyType'));
}
```

- The third argument to `addFunnelTriggerType` is the **event id**. It can be the id you pass to
  `goalAchieved` or `fireTrigger`, or the simple class name of a platform event such as
  `ModuleProgressEvent` or `SubscriptionFunnelEvent`.
- Omitting `checkMatchFn` means every occurrence of that event id matches.
- `itemIdField` names the parameter identifying *what* the event was about, so "only once per
  product" automations can tell two firings apart.
- `addFieldWithOptionsFn` takes a function returning the option list, evaluated when the form is
  rendered, so dropdowns show current account data.
- Use `funnelTriggerTypesFunction(fn)` when the set of trigger types itself depends on account data.

See [FunnelTriggerTypeBuilder](https://docs.kademi.co/ref/templating/md/FunnelTriggerTypeBuilder.md)
and [RepoAppFunnelTriggerType](https://docs.kademi.co/ref/templating/md/RepoAppFunnelTriggerType.md).

## Registering a custom automation action type

```js
controllerMappings
    .addFunnelActionType('archiveWarranty', 'Archive warranty')
    .description('Moves the warranty record to the archive')
    .doActionFn('archiveWarrantyAction')
    .addField('reason', 'Reason', true, null)
    .build();

/**
 * @param {String} id the automation's id
 * @param {Funnel} funnel the funnel the automation belongs to
 * @param {Object} event the event that fired the automation
 * @param {Date} now
 * @param {Map} settings the fields the administrator configured on this action
 */
function archiveWarrantyAction(id, funnel, event, now, settings) {
    var profile = event.leadProfile;
    if (formatter.isNull(profile)) {
        log.warn('archiveWarrantyAction: no profile on event for automation {}', id);
        return;
    }
    transactionManager.runInTransaction(function () {
        archiveWarrantiesFor(profile, settings.reason);
    });
}
```

See [FunnelActionTypeBuilder](https://docs.kademi.co/ref/templating/md/FunnelActionTypeBuilder.md),
[RepoAppFunnelActionType](https://docs.kademi.co/ref/templating/md/RepoAppFunnelActionType.md) and
[RepoAppFunnelAction](https://docs.kademi.co/ref/templating/md/RepoAppFunnelAction.md).

Each automation firing writes a
[JourneyAutomation](https://docs.kademi.co/ref/templating/md/JourneyAutomation.md) row, so an action
should still be written to tolerate running twice.

## Declaring and listening for plain app events

Separate from journeys, an app can declare its own events for other apps to react to.

```js
controllerMappings.newEventDefinitionBuilder('warrantyApproved')
    .description('A warranty claim was approved')
    .addProperty('warrantyId', 'Id of the warranty record')
    .addProperty('warrantyType', 'The warranty type name')
    .build();

// somewhere in your code
var props = formatter.newMap();
props.put('warrantyId', warrantyId + '');
controllerMappings.triggerEvent('warrantyApproved', props);

// in this or another app
controllerMappings.addEventListener('warrantyApproved', true, function (rootFolder, event) {
    log.info('warranty {} approved', event.parameters.get('warrantyId'));
});
```

`addEventListener` matches by the event's simple class name, or by the event id for trigger and app
events. `addEventListenerForType(fullyQualifiedName, enabled, fn)` matches a class or interface, so
every event implementing that interface is handled. See
[RepoAppEventDefBuilder](https://docs.kademi.co/ref/templating/md/RepoAppEventDefBuilder.md),
[RepoAppEventDef](https://docs.kademi.co/ref/templating/md/RepoAppEventDef.md) and
[RepoAppEventListener](https://docs.kademi.co/ref/templating/md/RepoAppEventListener.md).

The same rule applies: put ids and strings on the event, not live entities.
