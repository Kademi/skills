# Scheduled work: pipeline schedules and CRM sync jobs

Two different things are called "scheduled sync" in Kademi, and they are not interchangeable.

| | Pipeline schedule | CRM sync job |
|---|---|---|
| Runs | One integration pipeline, through its endpoint | A two-way object sync with an external CRM |
| Moves | Files: CSV, Excel, fixed width, query exports | Objects: profiles, organisations, leads |
| Configured in | Data > Integration | The CRM app's own Sync Jobs screen |
| You extend it with | Pipeline steps and [`JsRowStep`](https://docs.kademi.co/ref/templating/md/JsRowStep.md) scripts | Sync job action providers, or a whole sync provider |
| Use when | A system exchanges files with you | A system exchanges records with you and both sides can change them |

## Pipeline schedules

A [PipelineSchedule](https://docs.kademi.co/ref/templating/md/PipelineSchedule.md) is a recurring
timer attached to one pipeline. Each firing does exactly what a manual **Run** does: pull the file
from the remote server and import it, or build the export and push it.

Create one in the **Schedule** step of the Create Export or Create Import wizard, or add it to an
existing endpoint later.

| Setting | Notes |
|---|---|
| Time unit | `DAYS`, `WEEKS`, `MONTHS` or `ANNUAL`. **Hourly is not supported.** |
| Number | How many units make one interval, so 3 with `DAYS` is every three days |
| Start date | The first run. Its **time of day** also fixes the time every later run happens at, which is what stops repeated runs drifting |
| Day name | Optional weekday, for example `Monday`. A calculated run time is rolled forward to the next matching day |
| End date | When the recurrence stops |
| Type | Inbound (pull data in) or outbound (push data out) |
| Run as | The profile the run is performed as, which decides what it can see and do |

Things worth knowing:

- All the date arithmetic happens in the account's timezone.
- Only schedules on a website's **live** branch are picked up. A schedule on a draft version does
  nothing until you publish.
- The next run time is stored and polled, so a run starts at or shortly after its due time, not to
  the second. Do not build anything that depends on precise firing.
- Choose the run-as profile deliberately. A schedule runs with no request and no logged-in user, so
  the permissions of that profile are the only permissions the run has.

From server JavaScript, [IntegrationManager](https://docs.kademi.co/ref/templating/md/IntegrationManager.md)
manages them as `services.integrationManager`:

```js
var im = services.integrationManager;

var schedule = im.createPipelineSchedule(
    "weekly-deals-export",   // pipeline id
    "WEEKS",                 // timer unit
    1,                       // multiple
    startDate,               // first run; its time of day fixes every later run
    "outbound",              // schedule type
    "Monday",                // optional day name, or null
    website,
    profile);                // the profile runs happen as

var all = im.findPipelineSchedules(website);
im.updatePipelineSchedule(schedule);
im.deletePipelineSchedule(schedule);
```

### Designing a pipeline for scheduled use

A scheduled run is not an interactive one, and the differences bite:

- **Nobody is watching.** Attach a
  [ResultEmail](https://docs.kademi.co/ref/templating/md/ResultEmailPipelineStep.md) step, or enable
  notifications in the wizard, with `onlySendOnFailure` set so it stays quiet when things work.
- **The same file may still be there tomorrow.** Turn on execution recording, set an
  `execIdTemplate` that identifies the data rather than the run, and set `preventDuplicates`.
- **There is no response to render.** A [`TemplateOutput`](https://docs.kademi.co/ref/templating/md/TemplateOutput.md) or [`VelocityOutput`](https://docs.kademi.co/ref/templating/md/VelocityOutputStep.md) step has nobody to
  render for. Report through messages and the result email instead.
- **A big file will not get faster because it runs at night.** Use
  [map-reduce](map-reduce.md) if the volume warrants it.
- **Bound the window.** For index-query exports, set the pipeline's `fromDate` and `toDate`
  attributes so a scheduled export covers a period rather than the entire history every time.

## CRM sync jobs

CRM apps such as Dynamics 365, Salesforce and HubSpot sync objects rather than files, in either
direction or both, on a schedule of their own.

Supported object mappings are, broadly:

- Leads to Kademi leads
- Contacts to Kademi profiles
- Accounts to Kademi organisations

A sync job is configured in the CRM app's admin: a name, a sync provider, a direction (to Kademi,
from Kademi, or both), which object types to sync, a schedule mode (a recurring interval, or manual
only), and then filters, tags, groups and notification settings. Intervals here support hours as
well as days, weeks, months and years. Jobs can be run on demand at any time.

Setup walkthroughs:
[How to use Kademi with Microsoft Dynamics 365](https://docs.kademi.co/blogs/docs-kb/how-to-use-kademi-with-microsoft-dynamics-365/)
and
[Syncing Custom Fields with Salesforce](https://docs.kademi.co/blogs/docs-kb/syncing-custom-fields-with-salesforce/).

### Extending a sync with an action provider

The built-in sync moves the standard fields. Custom fields, derived values and anything
account-specific are added with a **sync job action provider**: an object your app registers, whose
hooks are called at the right points in the sync.

```js
var syncJobActionProvider = {
    name: function () {
        return 'sfCrmSyncActionProvider';
    },
    title: function () {
        return 'SF Transform AAA';
    },

    // Remote -> Kademi: the local object has just been updated from the remote one.
    onLocalObjectUpdated: function (type, id, localObject, syncJob) {
        var om = services.organisationManager;
        var remoteObj = services.salesforceService.getSFEntity(id, "Account", ['my_new_field__c']);
        var params = formatter.newMap();
        params.put("my_new_field", remoteObj.my_new_field__c);
        om.updateOrgExtraFields(localObject,
            localObject.allSelectedOrgTypes(),
            formatter.newFormContext(params));
    },

    // Kademi -> remote: last chance to add to the payload before it is sent.
    beforeRemoteObjectUpdated: function (type, bodyDataObject, localObject, syncJob) {
        bodyDataObject.my_new_field__c = localObject.field("my_new_field");
    },

    // Remote -> Kademi: reshape the incoming object before it is applied.
    transformRemoteObject: function (type, remoteObject, localObject) {
        return remoteObject;
    }
};

var syncJobActionProviders = {
    appName: "sf-actions",
    getActions: function () {
        return [syncJobActionProvider];
    }
};

controllerMappings
    .newImplementationBuilder('syncJobActionProviders')
    .implementationObject(syncJobActionProviders)
    .build();
```

`type` is `profile`, `organisation` or `lead`. Every hook is optional: implement only the ones you
need. Once registered, the action appears in the sync job's configuration and only runs on jobs it
has been selected for.

This is the right extension point for bidirectional custom fields. Remote field naming is the
provider's business, for example Salesforce's `__c` suffix for custom fields, and Dynamics 365's
per-environment column prefix.

### Writing a whole sync provider

To sync with a system that has no app yet, register a **sync provider**: the object that knows how
to talk to the remote system.

```js
var syncJobProvider = {
    name: function () { return 'MyCrmSyncProvider'; },
    title: function () { return 'My CRM Sync Provider'; },
    platformTitle: function () { return 'My CRM'; },
    supportedTypes: function () { return ['organisation', 'profile', 'lead']; },
    supportedDirections: function () { return ['ToKademi', 'FromKademi', 'Both']; },
    getDocumentDetails: function () { return 'https://example.com/docs'; },

    listAllObjects: function (syncJob, type, cb, job) { /* fetch remote, call cb(results) */ },
    updateLocalObject: function (type, id, target, syncJob, job) { /* remote -> Kademi */ },
    setRemoteObject: function (type, id, target, syncJob, job) { /* Kademi -> remote */ },
    deleteRemoteObject: function (type, id, syncJob, job) { },
    saveSettings: function (syncTypes, formContext, validationContext, syncJob) { }
};

controllerMappings
    .newImplementationBuilder('syncJobProviders')
    .implementationObject(syncJobProvider)
    .build();
```

`saveSettings` is where you validate and store your provider's own configuration on the sync job,
which is how the CRM apps capture things like an extra-column prefix or a target user group.

Note the shape of `listAllObjects`: it takes a callback rather than returning a list, so a provider
can page through a large remote result set and hand batches back as they arrive. Do not accumulate
the whole remote dataset in memory before calling back.

## Choosing between them

- The other system drops files somewhere, or wants files from you: **pipeline schedule**.
- The other system is a CRM with an app, and records change on both sides: **CRM sync job**.
- The other system has an API but no app, and you sync records rather than files: write a **sync
  provider**.
- The work is a bulk recalculation inside Kademi with no external system at all: neither. Submit a
  [map-reduce job](map-reduce.md) directly.
