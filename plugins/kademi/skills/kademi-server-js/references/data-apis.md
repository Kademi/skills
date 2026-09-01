# Data APIs: JSON database, users and memberships

## Where does this data go?

Four stores, and the wrong choice is expensive to undo.

| Your data | Store | Why |
|---|---|---|
| Your app's own records - tickets, submissions, configurations, anything with no platform entity | **JSON database** | Schemaless, per-account, searchable, no migration to deploy |
| A handful of configuration values scoped to the app | **App settings** | Already has an editing UI and a per-branch scope |
| Something the platform already models - profiles, orgs, orders, sales records, points | The **platform entity**, through its manager | Reporting, journeys, permissions and audit already understand it |
| A derived value you want to filter or report on | **A custom indexed field** on an existing index | Computed at reindex time, so the report is one query - see [queries.md](queries.md) |

Elasticsearch is not on that list, because it is not a separate choice: **the JSON database and the
platform's search indexes are both queried through Elasticsearch.** You never store *into*
Elasticsearch directly. You store a document in a JSON database, or an entity through its manager,
and query the index it lands in.

## The JSON database

Kademi's built-in document store ("KongoDB") holds arbitrary JSON documents, addressable by path,
searchable with Elasticsearch queries, and optionally readable over REST.

A document's path is `/jsondb/<database name>/<document name>`, and that is also its href from a
browser.

<https://docs.kademi.co/blogs/docs-kb/using-the-kademi-json-database/>

### Creating the database from your app

Do not make users create it by hand. Create it in the `onAppEnabled` callback, which receives the
organisation root folder and the website root folder (one of the two is null).

```js
globalThis._onAppEnabled = (orgRoot, websiteRoot) => {
    if (websiteRoot === null) {
        return; // account-level install; this app wants a per-website database
    }
    const dbs = orgRoot.find('jsondb');
    const dbName = `coffeeOrders-${websiteRoot.websiteName}`;
    let db = dbs.child(dbName);
    if (db === null) {
        db = dbs.createDb(dbName, `Coffee Orders - ${websiteRoot.websiteName}`,
                          'helloWorld/coffeeOrderTemplate');
        db.website = websiteRoot.websiteName;
    }
};
```

### Reading and writing

```js
const db = page.find('/jsondb/coffeeOrders-mysite');   // JsonDatabaseFolder
const doc = db.child('order-123');                     // one document, or null
const data = doc.jsonObject;                           // parsed JSON

const recent = db.findByType('coffeeOrder');           // all documents of one type
const hits = db.search(JSON.stringify({ query: { match: { size: 'large' } } }));

db.createNew(formatter.randomGuid, JSON.stringify(order), 'coffeeOrder');
db.deleteDocument(doc);
```

From Velocity: `$page.find("/jsondb/milton-releases/current").jsonObject.version`, and
`$page.find("/jsondb/milton-releases/").findByType("release")` to iterate.

### Mappings, and why an unmapped field cannot be searched properly

A JSON database is backed by an Elasticsearch index. Fields you intend to filter, sort or aggregate
on need a mapping, declared once and stored on the database. Build it with
`services.searchManager.newESMappingsBuilder()`
([ESMappingsBuilder](https://docs.kademi.co/ref/templating/md/ESMappingsBuilder.md)):

```js
var mappings = services.searchManager.newESMappingsBuilder()
    .newKeyword('ticketId').subfield('text').build()
    .newKeyword('status').build()
    .newLong('assigneeId').build()
    .newDate('enteredDate').build()
    .startObjectMapping('customer')
        .newKeyword('name').build()
        .newKeyword('email').build()
    .endObjectMapping();
```

Each `newX(name)` returns an [ESFieldBuilder](https://docs.kademi.co/ref/templating/md/ESFieldBuilder.md)
that you configure and close with `.build()`, returning you to the mappings builder. The usual shape
is `newKeyword` for exact match, filtering and aggregating, with `.subfield('text')`
added when the same field also needs full-text search; `newText` for free text; `newLong`,
`newDouble`, `newBoolean`, `newDate` for the rest. Declare the mappings in your `onAppEnabled`
callback, alongside creating the database - changing the mapping of a field that already has data
means a reindex, so get the types right first.

Query with an ordinary Elasticsearch request body, and **map the response to your own structure
before returning it** from a service - see
[kademi-coding-standards](../../kademi-coding-standards/SKILL.md).

```js
var hits = db.search(JSON.stringify({
    query: { bool: { filter: [{ term: { status: 'open' } }] } },
    sort: [{ enteredDate: 'desc' }],
    size: 50
}));
```

### The KJsonData service

Accounts with the **KJsonData** app enabled also get `services.jsonDatabaseManagerV2`, a JS service
that wraps the folder API: `getDatabase(name)`, `createDatabase(name, title, mappings)`,
`saveDbMapping`, `getDbRecordById`, `query(db, queryJson)` and `generateUniqueRecordId`. It is
convenient - `query` takes a JS object rather than a JSON string, and pre-processes it - but it is
an app's service, not platform API, so it is absent if that app is not enabled. The folder API above
always works.

See [JsonDatabaseFolder](https://docs.kademi.co/ref/templating/md/JsonDatabaseFolder.md),
[JsonDatabase](https://docs.kademi.co/ref/templating/md/JsonDatabase.md) and
[JsonDocument](https://docs.kademi.co/ref/templating/md/JsonDocument.md).

### Anonymous writes

Every operation on a JSON database happens as some user. For a public endpoint with no logged-in
user, wrap the write in `securityManager.runAsUser`:

```js
controllerMappings
    .websiteController()
    .path('/orderCoffee/')
    .enabled(true)
    .isPublic(true)
    .postPriviledge('READ_CONTENT')
    .addMethod('POST', 'handleCoffee', 'coffeeType')
    .build();

globalThis.handleCoffee = (page, params, files, fc) => {
    const vc = fc.newValidationContext();
    const coffeeType = vc.validateString('coffeeType', true, 40);
    const size = vc.validateString('size', true, 20);
    if (!vc.isValid()) {
        return vc.toJsonResult();
    }

    const db = page.find(`/jsondb/coffeeOrders-${page.websiteName}`);
    if (db === null) {
        return views.jsonResult(false, 'Ordering is not configured');
    }

    securityManager.runAsUser(orderUserName, () => {
        db.createNew(formatter.randomGuid, JSON.stringify({ coffeeType, size }), 'coffeeOrder');
    });

    return views.jsonResult(true, 'Order placed');
};
```

Pick the run-as user from an app setting rather than hard-coding it, and validate before writing:
a public endpoint is an unauthenticated write path into your account.

### REST access

Documents are only loadable over REST when the database has the Allow REST flag set and is
associated with the website (or allows access from any website). Then a browser can
`GET /jsondb/<db>/<doc>` and get the JSON back.

## Users, profiles and memberships

<https://docs.kademi.co/blogs/docs-kb/user-and-membership-api/>

Three representations of a user exist. The profile domain object is the one to work with;
[ProfileBean](https://docs.kademi.co/ref/templating/md/ProfileBean.md) is a lightweight form for
traversing large lists and
[UserResource](https://docs.kademi.co/ref/templating/md/UserResource.md) is the addressable form.
Both of the latter are mostly deprecated.

```js
const me = services.userManager.currentProfile;
const byId = services.userManager.findById(formatter.toLong('12345'));
const byName = services.userManager.findByName('userA');
const byEmail = services.userManager.findByEmail('usera@example.com');

const isAdmin = services.userManager.hasRole(me, 'MyAppAdmin');
```

In Velocity the current user is `$user`; `$user.profile` gives the bean and `$user.thisUser` the
profile. `#set( $u = $page.find("/users/$profile.userName") )` looks a user resource up by href.

### Memberships

A membership links a profile, a group and an organisation.

```js
const memberships = services.userManager.membershipList(profile);  // must be a Profile
```

`membershipList` returns a
[MembershipList](https://docs.kademi.co/ref/templating/md/MembershipList.md) of
[MembershipBean](https://docs.kademi.co/ref/templating/md/MembershipBean.md). Filter it, and reach
the organisation through `.org`, which is an
[OrgData](https://docs.kademi.co/ref/templating/md/OrgData.md):

```velocity
#foreach( $membership in $memberships.filterByGroup("Dealer") )
    $membership.org.address
#end
```

The account's own organisation is `$rootFolder.orgData`. `childOrgs()` on it returns an
[OrgDataList](https://docs.kademi.co/ref/templating/md/OrgDataList.md) of the organisations inside
it, and `members("RoleOrGroup")` on each gives its members:

```velocity
#foreach( $dealership in $rootFolder.orgData.childOrgs() )
$dealership.title    $dealership.members("Dealer").size()
#end
```

`membershipListCached(profile)` and `membershipList(profile, useCache)` exist for hot paths; call
`flushCachedMemberships(profile)` after changing a membership. Full method list:
[UserManager](https://docs.kademi.co/ref/templating/md/UserManager.md).

## Custom indexed fields

If a report needs data that lives in a different part of the account, compute it into the search
index at reindex time instead of joining at query time. See
[references/queries.md](queries.md).
