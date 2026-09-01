# Journey fields

A journey field is a named, typed value your app computes on demand. Registering one puts your app's
data in front of administrators in four places at once:

- the **KCode picker**, used in journey emails, SMS, landing pages and node settings
- the **segment / rule builder**, for choosing who a journey applies to
- **funnel rule expressions**
- the **query builder**

This is the only way an administrator can reach your app's data without asking you to write code for
them, which is why it is usually worth adding even for a single value.

Fields are aggregated across every active app on the account
([FieldsService](https://docs.kademi.co/ref/templating/md/FieldsService.md)), and each one is a
[Field](https://docs.kademi.co/ref/templating/md/Field.md) with an id, label, type and optional
parent types.

## Two generations

| | Version one | Version two |
|---|---|---|
| Registered with | `addTextJourneyField`, `addNumericJourneyField`, `addJourneyField`, `addJourneyFieldSelect` | `newFieldBuilder(...)...build()` or `addFieldV2(...)` |
| Typed return | string / integer / double / date / time / datetime / boolean | the same, **plus object types** such as `Profile` or `Lead` or one of your own |
| Chainable in KCode | no | yes, via `parentType` |
| Eval signature | `fn(profile, vars)` | `fn(root, profile, vars, fieldId)` |

Use version two for anything new. Version one is still fine for a single flat value that hangs off
nothing, and it is less to write.

## Version one

```js
/* global controllerMappings, formatter, services */

controllerMappings.addTextJourneyField(
    'warranty_last_status',
    'Warranty: last status',
    'getLastWarrantyStatus'
);

/**
 * @param {Object} profile the profile the field is evaluated for, may be null
 * @param {Map} vars evaluation variables - 'lead' and 'thisOrg' when they apply
 * @returns {String} the field value
 */
function getLastWarrantyStatus(profile, vars) {
    var lead = vars.get('lead');
    if (formatter.isNull(lead)) {
        return null;
    }
    return lead.allFieldValues.get('warrantyStatus');
}
```

`addNumericJourneyField(id, label, integer, evalFunction)` gives standard numeric operators.
`addJourneyFieldSelect(id, label, type, values, operators, evalFunction)` renders a fixed dropdown
in the rule builder. The eval argument may be a function name or an actual function.

## Version two

```js
controllerMappings
    .newFieldBuilder('warrantyClaim', 'Warranty claim')
    .returnType('WarrantyClaim')     // an object type name you invent
    .parentType('Lead')              // chains straight after the built-in currentLead
    .evalFunction('getWarrantyClaimForLead')
    .build();

controllerMappings
    .addFieldV2('warrantyClaimStatus', 'Status', 'string', 'WarrantyClaim', 'getClaimStatus')
    .addFieldV2('warrantyClaimAmount', 'Amount', 'double', 'WarrantyClaim', 'getClaimAmount');

/**
 * @param {Object} root the parent object - a Lead here, because parentType is Lead
 * @param {Object} profile the profile in context, may be null
 * @param {Map} vars evaluation variables, including 'lead', 'page' and 'event' where they apply
 * @param {String} fieldId the id of the field being evaluated
 * @returns {Object} the field value, or null
 */
function getWarrantyClaimForLead(root, profile, vars, fieldId) {
    var lead = root;
    if (formatter.isNull(lead)) {
        return null;
    }
    var claimId = lead.getFieldValue('warrantyId');
    if (formatter.isEmpty(claimId)) {
        return null;
    }
    return findWarrantyClaim(formatter.toLong(claimId, true));
}

function getClaimStatus(root, profile, vars) {
    return formatter.isNull(root) ? null : root.status;
}
```

`addFieldV2(id, label, returnType, parentTypes, evalFunction)` is shorthand for the builder, and
also chains. `parentTypes` accepts a single string, a list, an array, or `null` for a root-level
field.

### Builder options

| Method | Effect |
|---|---|
| `returnType(s)` | `datetime`, `string`, `integer`, `boolean`, `double`, or an object type name |
| `parentType(s)` | The single type this field hangs off |
| `parentTypes(s)` | Several, or `null` for a root field |
| `evalFunction(s)` | Function or function name, called as `(root, profile, vars, fieldId)` |
| `evalProperty(name)` | Read a bean property off the parent object instead of calling a function |
| `appendQueryFunction(s)` | Makes the field *searchable* rather than only evaluable, by translating a comparison into a query |
| `build()` | Register on the app |
| `build(fields)` | Register into a supplied list - used by a dynamic fields function |

See [FieldV2Builder](https://docs.kademi.co/ref/templating/md/FieldV2Builder.md) and
[RepoAppJourneyFieldV2](https://docs.kademi.co/ref/templating/md/RepoAppJourneyFieldV2.md).

`evalProperty` is worth reaching for whenever the value is already a property on the parent - it
avoids a function call and a null check:

```js
controllerMappings
    .newFieldBuilder('warrantyClaimRef', 'Reference')
    .returnType('string')
    .parentType('WarrantyClaim')
    .evalProperty('reference')
    .build();
```

## Fields that only exist at runtime

Some fields cannot be known when the app loads - one per configured warranty type, one per survey
question, one per custom field on a record type. Register a function instead of the fields
themselves, and it is called with the root folder and the list to fill.

```js
controllerMappings.journeyFieldsFunction(loadWarrantyFields);

/**
 * @param {Object} rootFolder the current root folder
 * @param {List} fields the list to add built fields to
 */
function loadWarrantyFields(rootFolder, fields) {
    var types = listWarrantyTypes();
    if (formatter.isEmpty(types)) {
        return;
    }

    formatter.foreach(types, function (type) {
        controllerMappings
            .newFieldBuilder('warrantyCount_' + type.name, 'Warranty count: ' + type.title)
            .returnType('integer')
            .parentType('Profile')
            .evalFunction(function (root, profile, vars) {
                return countWarranties(root, type.name);
            })
            .build(fields);   // note: build(fields), not build()
    });
}
```

The key difference is `build(fields)` rather than `build()`. Version one fields have the same
pattern through a fourth argument:
`controllerMappings.addTextJourneyField(id, label, evalFunction, fields)`.

Two limits to respect:

- An app is warned as it passes **200** registered fields and blocked past **300**, and
  `build(fields)` skips anything beyond 300 in the supplied list. A loop over account data can hit
  this quickly. Cap what you generate, or generate one field that takes a parameter rather than a
  thousand near-identical ones.
- The function runs whenever the field list is built. Keep it cheap - it is not the place for a slow
  aggregate query.

## How this becomes KCode

A KCode expression is a path of field ids between `*|` and `|*`, walking down the type graph:

```
*|currentUser/firstName|*
*|currentLead/leadCustomerProfile/email|*
*|currentUser/primaryMemberships/firstMem/membershipOrg/uuid|*
```

Reading that left to right:

1. `currentUser` and `currentLead` are **root fields** the platform provides. `currentLead` returns
   a `Lead`; in a journey email the context is the lead, so administrators start there.
2. Each following segment is a field whose `parentType` matches the previous segment's `returnType`.
3. The last segment's `returnType` is what gets rendered.

So the two properties do all the work:

- `parentType` decides **where in the picker your field appears**.
- `returnType` decides **what can be selected after it**.

Register a field with `parentType('Lead')` and it becomes a new branch immediately under
`currentLead`. Give it an object `returnType` and register more fields against that type, and you
have added a whole level to the tree - exactly the shape of
`currentLead/leadClaim/claimOrg/parentOrg/email` in
[Using KCode for task approval in a sales claim approval workflow](https://docs.kademi.co/blogs/docs-kb/using-kcode-for-task-approval-in-a-sales-claim-approval-workflow/),
where each hop is one registered field. For the administrator's view of the picker, see
[Using KCode](https://docs.kademi.co/blogs/docs-kb/using-kcode/).

## Evaluating KCode from your own code

Custom node settings frequently hold a KCode template the administrator typed, for instance "which
profile should receive this". Evaluate it with
[TemplatingManager](https://docs.kademi.co/ref/templating/md/TemplatingManager.md):

```js
function resolveRecipient(kcode, lead, page, funnelEvent) {
    var vars = formatter.newMap();
    vars.put('rootFolder', page);

    var targetProfile = null;
    if (formatter.isNotNull(lead)) {
        vars.put('lead', lead);
        targetProfile = lead.profile;
    }
    if (formatter.isNotNull(funnelEvent)) {
        vars.put('event', funnelEvent);
    }

    var value = services.templatingManager.evaluateAllFields(kcode, targetProfile, vars);
    if (formatter.isEmpty(value)) {
        return null;
    }

    var um = services.userManager;
    return um.findByName(value) || um.findByEmail(value);
}
```

Put `lead` in `vars` or `currentLead` will not resolve. There is a second overload taking a list
that collects log lines produced during evaluation, which is the fastest way to work out why an
expression returned nothing.

## Naming

Field ids are global across every app on an account and are stored in saved KCode, saved segments
and saved queries. Prefix them, and never rename one that has shipped - add a new id and leave the
old one working.
