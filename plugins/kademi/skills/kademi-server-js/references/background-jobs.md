# Background jobs

Work that takes longer than a request should not be done in the request. The platform CPU
governor interrupts long-running requests, and a browser waiting on one eventually gives up.
Hand it to the background job queue instead: submit a job, return its id, and let the browser
poll for progress.

This is engine-neutral. It works the same in `.js` (Nashorn) and `.mjs` (GraalJS); the only
difference is that in GraalJS the task function must be assigned to `globalThis`, like every
other function the platform calls by name.

The browser half of polling (the JavaScript that calls the status endpoint, shows progress and
reloads the page when the job finishes) is covered by the `kademi-admin-ui` skill.

## Start a job

[AsyncJobManager](https://docs.kademi.co/ref/templating/md/AsyncJobManager.md).`newAsyncTask`
puts a named function of your app onto the queue and returns the
[AsyncJob](https://docs.kademi.co/ref/templating/md/AsyncJob.md) it created.

```js
globalThis.startRebuild = (page, params, files, fc) => {
    const vc = fc.newValidationContext();
    const categoryId = vc.validateLong('categoryId', true);
    if (!vc.isValid()) {
        return vc.toJsonResult();
    }

    const taskParams = formatter.newMap();
    taskParams.put('categoryId', categoryId);

    const curUser = services.userManager.currentProfile;
    const job = services.asyncJobManager.newAsyncTask(
        'my-app',                // appId: the app the task function lives in
        'Rebuild the item index', // description shown against the job
        '_rebuildIndex',         // name of the function to run
        taskParams,              // parameters, a Java map
        null,                    // branch, or null to run at account level
        curUser,                 // runBy: who the job is recorded against
        curUser);                // runAs: whose privileges the task runs with

    return views.jsonResult(true, 'Rebuild started', String(job.id));
};
```

- **appId** must be your app's id. The function is looked up in that app, not globally.
- **params** must be a `formatter.newMap()` of serialisable values only: strings, numbers, ids,
  or a JSON string. The map is serialised onto the queue, so never put an entity in it. Put the
  id in and load the entity again inside the task.
- **branch** of `null` runs the task at account level. Pass a website branch when the task needs
  that website's context (its settings, its content).
- **runAs** decides the task's privileges. It is not a request, so there is no logged-in user
  other than this one.

## The task function

```js
globalThis._rebuildIndex = (job, params, jobContext) => {
    const categoryId = params.get('categoryId');
    // ... do the work ...
    return `Indexed ${count} items`;
};
```

- `job` is the job record, `params` is the map you submitted, `jobContext` is a
  [JobContext](https://docs.kademi.co/ref/templating/md/JobContext.md).
- Whatever you return is stored as the job's output and shown against it in the admin console,
  and comes back in the status endpoint's `output`. Return a short string, or nothing.
- The task body runs inside a transaction the platform opened for it. If it throws, those
  database writes roll back, the job is marked **cancelled**, and the exception message is
  recorded in the job's `warnings`. Nobody cancelled it; it failed. Catch what you can handle,
  and let the rest fail loudly rather than half-writing.
- A long task should commit as it goes rather than holding one transaction open for an hour.
  Wrap each batch in `transactionManager.runInTransaction(fn)`.
- Long loops still have to yield: `securityManager.yield()` in GraalJS, `formatter.foreach` in
  Nashorn.

## Report progress

```js
jobContext.setStatus(`Processed ${done} of ${total}`);
```

The message is display only. A scanner copies it onto the job every few seconds, so a poll can
show a value a few seconds old and can miss a message that was replaced quickly. Never branch on
it, and never parse it: keep the real state in your own data and use the status line for humans.

## Check for cancellation

An administrator can cancel a running job from the admin console. That sets a flag; it does not
interrupt your code. A task that never looks at the flag runs to completion regardless.

```js
for (const item of items) {
    if (jobContext.isCancelled()) {
        return `Cancelled after ${done} of ${total}`;
    }
    processItem(item);
    securityManager.yield();
    done++;
}
```

In Nashorn, returning from a `formatter.foreach` callback only skips that one item, so check the
flag at batch boundaries in the outer loop instead.

## What the caller gets back: a job id

Return `job.id`. Do not return `job.taskName`.

The task name is `appId + '-' + functionName`, so every run of that task shares it. A caller
holding only the name, polling in the gap between submitting a run and the queue picking it up,
is answered with the **previous** run, which is complete. It concludes the task finished
instantly and acts on stale data. A job id identifies one run and has no such ambiguity.

The third argument of `views.jsonResult(true, message, nextHref)` is the conventional place to
put it, and the browser reads it from `nextHref`. That argument is a string, and an id is a Java
`Long`, so wrap it: `String(job.id)` in `.mjs`, `'' + job.id` in `.js`.

## Poll for status

`GET /job-manager/?jobId=<id>` returns a
[JsonResult](https://docs.kademi.co/ref/templating/md/JsonResult.md) whose `data` holds:

| Field | Meaning |
|---|---|
| `jobId` | the job asked for |
| `taskName` | the task being run |
| `complete` | true once the job has finished, succeeded, failed or cancelled |
| `cancelled` | true if it was cancelled, which includes failing with an exception |
| `statusMessage` | the latest `jobContext.setStatus` message, or null if the task reports none |
| `output` | what the task function returned, only once complete |
| `warnings` | warnings recorded against the job, including the reason it failed |

Poll it every second or so, stop on `complete`, and treat `cancelled` as a failure. The endpoint
only answers for jobs belonging to the account being administered, and reports anything else as
not found.

Any app can use it; it is not specific to one feature. There is no need to write your own status
endpoint.

## Seeing jobs in the admin console

The admin console lists background tasks with their status, duration and output, and shows the
log lines each job wrote while it ran. That listing is the first place to look when a task did
not do what was expected: see [troubleshooting.md](troubleshooting.md).
