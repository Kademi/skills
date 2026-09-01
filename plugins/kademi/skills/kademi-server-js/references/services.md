# JS services

A JS service is the only supported way for one Kademi app to call another. There is no
`application.call`, no cross-app `import`, and no way to reach another app's globals.

## Publishing a service

Build a plain object of functions and register it at module top level with
[JsServiceBuilder](https://docs.kademi.co/ref/templating/md/JsServiceBuilder.md).

```js
// APP-INF/services.mjs
import { queryTickets } from './tickets.mjs';

const ticketManager = {
    findOpenTickets(ownerId) {
        return queryTickets({ ownerId, state: 'open' }).map((t) => ({
            id: t.id,
            title: t.title,
            openedDate: t.openedDate
        }));
    },

    closeTicket(ticketId, reason) {
        return queryTickets({ id: ticketId })[0]?.close(reason) ?? false;
    }
};

controllerMappings.newServiceBuilder('ticketManager').serviceObject(ticketManager).build();
```

Registration only works during engine init, so this must run when the file loads.

## Consuming a service

```js
const tickets = services.ticketManager.findOpenTickets(profileId);
```

From a Velocity template:

```velocity
#set( $tickets = $services.ticketManager.findOpenTickets($profileId) )
```

Your own app's internal functions are not services. Call them directly - importing a module (or,
under Nashorn, calling a function in another loaded `.js` file) is far cheaper than a service
call.

## Design rules

A service call crosses the JS/Java bridge, so its shape matters more than an internal function's.

- **Expose stable, high-level operations meant for other apps.** "Find the open tickets for this
  profile", not "read this app setting".
- **Do not expose internal helpers.** Settings accessors, CSV writers, array converters and
  private lookups belong inside your app, not on the service object.
- **Implement the method on the object itself.** Do not register a service whose methods are
  pointers to functions defined somewhere else; it makes the contract impossible to read.
- **Return encapsulated values.** Plain objects, maps and lists with named fields.
- **Never return raw backend objects.** A search response, a Hibernate entity or an internal DTO
  couples every future caller to your implementation.

```js
// Bad: leaks the search response shape to every caller forever
findTickets(query) {
    return services.jsonDatabaseManagerV2.query(db, query);
}

// Good: a documented shape you can keep stable
findTickets(query) {
    const results = services.jsonDatabaseManagerV2.query(db, query);
    return (results?.hits?.hits ?? []).map((hit) => ({
        id: hit.source.id,
        title: hit.source.title
    }));
}
```

Under Nashorn build the return value with `formatter.newArrayList()` and `formatter.newMap()`
instead of JS literals, and iterate with `formatter.foreach`.

## Changing a published signature

Once a service is published, callers you cannot see may depend on it: other apps in the account,
and Velocity templates calling `$services.yourService.method(...)`. Nothing catches a broken call
at build time. Velocity is rendered at request time and JS dispatch is dynamic, so a missed caller
fails only when someone loads that page.

Treat a published service signature as a public API:

- Add parameters as optional trailing arguments rather than changing the existing ones.
- Add a new method rather than repurposing an existing name.
- If you must break a signature, publish the replacement under a new name, leave the old one
  delegating to it, and remove the old one in a later release.
- Search your own app for callers, including its Velocity templates, before you change anything.

The equivalent care is not needed for functions that are only called inside your own app - those
you can refactor freely.

## Declaring a dependency on another app

If your app calls another app's service, that app has to be installed. Declare it so it is, using
a `deps.xml` in your app carrying the app id and optionally a version. See
[Dependency](https://docs.kademi.co/ref/templating/md/Dependency.md) and
[DependencyMappingBuilder](https://docs.kademi.co/ref/templating/md/DependencyMappingBuilder.md).
Client-side asset dependencies are a separate mechanism, declared in `dependencies.json`
alongside your admin or website assets.
