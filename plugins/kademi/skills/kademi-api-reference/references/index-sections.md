# Index sections

Every `## <Section>` heading in `https://docs.kademi.co/ref/templating/md/index.md`, what kind of
task each one covers, and a few representative classes. Use this to pick the section to scan when
you know the task but not the class name.

Sections appear in the index in the order below (alphabetical, with `Other` last). Classes are
alphabetical within a section, and every class name is unique across the whole index, so a class
belongs to exactly one section. New classes are added over time, so treat this as a map of where
to look, not as a complete listing - the index itself is authoritative.

Fetch a class as `https://docs.kademi.co/ref/templating/md/<ClassName>.md`.

## The sections

### Account Settings
Capturing an account's app configuration as a portable snapshot, diffing two snapshots, and
reviewing or excluding the differences during a deployment. Use for config drift, promotion
between accounts, and deployment review tooling.
`AccountConfigSnapshot`, `ConfigDiff`, `ConfigDelta`, `IgnoredConfigItem`

### Addresses
The portable postal-address bean used as a nested property when building organisation, user and
cart addresses.
`AddressBean`

### AI Agents
Defining AI agents: the agent definition parsed from XML, the event handlers and timers that fire
it, and the workflow steps plus completion types that decide when a step is finished. Also the
deserialised LLM responses and inference records. Use for agent authoring and for reading what an
LLM call returned.
`AgentDef`, `AgentWorkflowDef`, `AgentWorkflowStep`, `DecisionAgentWorkflowStepCompletionType`,
`LlmInferenceInfo`, `Responses`

### App Definitions
What an app declares to the platform from its server-side registration code: controller mappings
and their HTTP methods, menu items, KEditor components, dependencies, app-contributed queries and
fields. Start here for anything to do with `controllerMappings`.
`ControllerMappingList`, `ControllerMapping`, `ControllerMethod`, `ComponentBean`, `AppMenuItem`

### Applications
The built-in applications an account can enable - content, learning, e-commerce, auctions,
alerts, integrations, payment gateways - and what enabling each one adds to a website. Use to
find out which feature set owns a capability before hunting for its manager.
`ContentApp`, `LearningApp`, `AlertsApp`, `IntegrationApp`, `AuctionApp`

### Asset Types
Configuring an asset type: the matchers that decide when an asset interaction applies, and the
path mappings that route a content delivery request to an asset view.
`AndMatcher`, `OrMatcher`, `PathMapping`, `RequestContentTypeMatcher`

### Asset Views
The renderers an asset type can dispatch to - default edit forms, page templates, and
pre-generated alternate formats such as thumbnails or transcodes.
`AltFormatContentView`, `EditContentItemView`, `PageTemplateContentItemAssetView`

### Assets
The asset library records themselves: images, videos, binary files, text and content items, with
their stored file and metadata.
`Asset`, `BinaryAsset`, `ImageAsset`, `ContentItemAsset`

### Builders
Fluent builders. Any time you need to construct something with many optional parts - a profile
and its memberships, an email, an alert, an agent definition, a search - the builder is here, and
its first paragraph names the manager call that hands it to you. Second place to look after
Managers.
`ProfileBuilder`, `AlertBuilder`, `AgentDefBuilder`, `RewardEntryBuilder`,
`StreamEventBeanBuilder`, `ParticipantSearchBuilder`

### Content
Tenant content-type configuration and the default actions behind content authoring: the loaded
asset type definitions, the matchers that pick an alternate format, and the form-submit action
that creates or updates a content item.
`ContentTypes`, `EditAssetAction`, `AltFormatMatcher`

### Custom Fields
Extra (custom) field definitions on entities such as leads, triggers and metrics, and rendering
one as an HTML form control.
`ExtraField`, `ExtraFieldRenderer`, `GroupExtraField`

### Database Entities
The persisted records: the field-by-field reference for a Lead, a Cart, a Quote, an EmailItem, a
Blog. Go here for "what properties does this record have", "what is nullable", "what does this
status mean". Note that a few very common types (Profile, Organisation, Group) have no page.
`Lead`, `Cart`, `Quote`, `EmailItem`, `GroupMembership`, `Website`

### Database Table Providers
Import-pipeline table providers: the components that insert, update or delete rows of one entity
type as an import pipeline runs, and that read rows back out for an export.
`GroupMembershipTableProvider`, `CategoryTableProvider`, `FastPointsRowProvider`,
`DataSeriesProvider`

### Debugging
Debug sessions - short-lived captures of matching web requests and async tasks for one tenant -
and the cache statistics recorded alongside them.
`DebugSession`, `DebugSessionInfo`, `DebugSessions`, `CacheStoreStats`

### E-commerce
Checkout rules and shipping providers: the contexts passed into a checkout rule's JS functions,
and the base classes a shipping provider extends. For carts, products and pricing *operations*
see Managers (`CartManager`, `CatalogManager`, `PriceManager`) and Database Entities.
`AbstractCheckoutRuleContext`, `CheckItemsCheckoutRuleContext`, `AbstractShippingProvider`

### Engagement Scoring Factor Types
The individual factors that contribute to a lead's engagement score - comments, contact form
submissions, credentials created, and so on.
`CommentEngagementScoringFactorType`, `ContactFormEngagementScoringFactorType`,
`CredentialEngagementScoringFactorType`

### Events
Platform events an app can listen for or that fire during a built-in operation: what fires, when,
and what data the event carries. Use when you need to hook behaviour onto something happening.
Journey-specific triggers live in Journeys instead.
`BeforeSignupEvent`, `BeforeVoucherRedemptionEvent`, `CalendarEventAccepted`

### IDP Rules
Identity-provider rules: the conditions evaluated during sign-in, request handling and email
processing, and the actions they can take - abort the request, block access, add a known IP,
challenge for a second factor. Use for authentication policy and fraud/abuse gating.
`AbortRequestIDPAction`, `AccessBlockIDPAction`, `AddKnownIpIDPAction`

### Integrations
Endpoint configuration for inbound and outbound data integrations. The operations are on
`IntegrationManager` in Managers.
`EndPointMapping`

### Journeys
The journey/funnel automation engine, and the largest section after Other and Database Entities.
Four recurring kinds of class, distinguishable by name suffix:
- **Goals** (`...Goal`) - what a lead must achieve to move on.
- **Actions** (`...GoalAction`, `...FunnelAction`) - what happens at a node.
- **Triggers** (`...FunnelTrigger`) - what starts or advances a journey.
- **Types** (`...FunnelTriggerType`, `...FunnelActionType`) - the descriptors that register a
  trigger or action with the automation engine and build instances from submitted form data.
Scan by suffix for the shape you need, then by the verb in the name.
`AcceptQuoteGoal`, `AddToGroupGoalAction`, `CreateTaskGoalAction`, `ContactFormFunnelTrigger`,
`BadgeAwardFunnelActionType`, `Begin`

### Managers
**The verbs of the platform, and the first place to look for "how do I do X".** One class per
domain, each reached from server-side JS and Velocity by a registered name that the class
description states explicitly (`services.emailManager`, `userManager`, `formatter`,
`services.criteriaBuilders`). Covers profiles and groups, email and SMS, points, vouchers,
promotions, learning, leads, carts and catalogue, content and assets, search, files and FTP,
LLM inference, jobs, dates and formatting.
`UserManager`, `EmailManager`, `Formatter`, `KCriteriaBuilders`, `PointsManager`, `LeadManager`,
`AssetManager`, `LlmManager`, `ApplicationServices`

### Pipeline Steps
The individual steps of an import/export pipeline: parsing CSV and Excel input, running a
database query as a source, transforming rows, and writing output.
`CsvInput`, `CsvOutput`, `DatabaseSourceStep`

### Pipelines
The pieces a pipeline step works with - a row's column mapping, sheet routing, and the writer a
row-processing script forwards rows through.
`Column`, `RowWriter`, `NextSheetStep`

### Queries
Saved query and reporting configuration: match fields, lookup tables, and how a data-series
record-editing form is configured.
`ComparisonLookupTableField`, `DataSeriesContent`, `DataSeriesFieldConfig`

### Recipes
App recipes - the ordered stages and steps that guide a new account through configuring itself -
and the running project instance of one.
`Recipe`, `Project`, `MultiNextRecipeStep`

### Recognition
The JS-implemented recognition points rule type. Recognition *operations* are on
`RecognitionManager` in Managers.
`JsRecognitionPointsRuleType`

### Reports
A custom report registered by an app, produced from a query table or a JS function.
`AppReport`

### Resources
The WebDAV resource tree: the classes that serve a URL - folders, asset management resources, and
the base class almost every resource extends. Use when you are reasoning about how a path is
served rather than about data.
`AbstractResource`, `AssetsFolder`, `AbstractManageAssetResource`

### Rewards
JS-implemented rule types for the rewards domain, configured per account: points rules, points
expiry rules and record matchers.
`JsPointsRuleType`, `JsPointsExpiryRuleType`, `JsRecordMatcherType`

### Roles
Every grantable role and exactly what access it confers. Use to answer "who is allowed to do
this" and to pick the right role when registering or checking permissions.
`AccountingRole`, `ContentAuthorRole`, `ContentViewerRole`, `FraudManagerRole`, `BloggerRole`

### Search
A recently run Elasticsearch query, kept in a rolling in-memory list. Search *operations* are on
`SearchManager` in Managers.
`RecentQuery`

### Server Monitoring
Per-operation timing and in-flight operation tracking: hierarchical stopwatches with named laps,
and the record of a request or async job while it is running.
`KStopWatch`, `CurrentOp`, `ChildStopWatch`

### Subscriptions
A billable usage metric, such as profiles or emails sent, that subscription usage is measured
against.
`UsageFactor`

### Table Uploads
Saved spreadsheet imports: the reusable column-to-field mapping and the action handlers attached
to a mapping.
`FieldMapping`, `ActionHandlerConfigBean`

### Tables
Built-in reporting tables - a named, queryable result set such as expiring points or stored
addresses - used as report and query sources.
`ExpiringPointsTable`, `ExpiringPointsTableV2`, `EntityAddressesTable`

### Views
What a controller returns to produce a response: raw bytes under a chosen content type, a
streamed content file, a rendered editor page. Go here when the question is "how do I return
this from my controller".
`BinaryView`, `ContentFileView`, `ContentEditorView`

### Website Settings
A website's per-app settings and theme, as loaded from its settings file.
`WebsiteSettings`, `AppSettingsBean`

### Other
The catch-all, and the largest section: beans, DTOs, read-only views, summaries, result wrappers
and standalone services that do not belong to any of the groups above. Anything named `...Bean`,
`...Summary`, `...Result` or `...Response` is likely here, as are a number of genuinely useful
standalone APIs.
`ProfileBean`, `AlertBean`, `VoucherBean`, `AccessLogBean`, `AggBucket`, `XMLHttpRequest`,
`AccountUsage`

## Notes

- **Managers first, Builders second.** Between them they answer most "how do I do X" questions,
  and both name their own entry point in their description.
- **Database Entities answers "what fields".** Managers answers "what operations".
- **Other is large and unstructured.** If a scan of the obvious section fails, search the whole
  index for the noun in the task before concluding the class does not exist.
- Counts drift as the platform grows. Section *names* have been stable; treat the numbers as a
  sense of scale, not a checksum.
