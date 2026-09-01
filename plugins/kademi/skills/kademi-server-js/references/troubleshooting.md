# Troubleshooting on a hosted account

Server-side JavaScript runs on the server, so a failure does not appear in the browser console.
This is where it does appear, and what you can see of it with an ordinary administrator login on
your own account.

## Where an exception surfaces

**Not in the response.** An uncaught exception in a controller function becomes a 500, and the
error page shows the status code only: no message, no stack, no line number. That is deliberate.
An AJAX POST gets the same page instead of JSON, so from the browser side the symptom is just a
form whose success handler never runs.

**In a debug session. Start here.** A debug session is the tool built for this, and it beats
reading the log for almost every problem. It captures matching web requests and async tasks for a
short window: the request URL, method, parameters and headers, who was authenticated, timings,
and every log line written during that one operation - including levels the account log does not
keep at all. Start one from the admin console's developer tools, scoped to a path prefix or a
task name, reproduce the problem, then read the captured operations. It needs the Website
Administrator or Debugger role.

Why it beats the log: it is scoped to your operation rather than the whole account, so there is
nothing to filter out; it keeps debug-level lines the account log discards; and it shows you the
request that caused the failure - the actual parameters and the authenticated user - which the
log does not record. That makes it the only practical tool for "it fails for one user, on one
URL, sometimes".

The classes behind it are listed under **Debugging** in
`https://docs.kademi.co/ref/templating/md/index.md`, starting with
[DebugManager](https://docs.kademi.co/ref/templating/md/DebugManager.md) and
[DebugSession](https://docs.kademi.co/ref/templating/md/DebugSession.md).

**In the account log, for anything a session did not capture.** The admin console has a **Logs**
screen (under Website Manager) which searches and live-tails the log for your account and nobody
else's, filtered by level or keyword. It needs the Administrator or Website Administrator role.
The exception message and stack trace go here too, along with everything your app logged around
it. It is account-wide and busy, so filter to your app's
prefix. Use it when a failure is not reproducible on demand, or to see what happened before and
after the operation a session captured.

If you would rather build a screen of your own on top of it, the same search and tail is exposed
as [LogsManager](https://docs.kademi.co/ref/templating/md/LogsManager.md).

**For a background job, on the job.** A job that throws is not shown as failed; it is shown as
**cancelled**, with the exception message in its `warnings`. So "cancelled and nobody cancelled
it" means it threw. The admin console's background tasks listing shows each job's status,
warnings, output and the log lines it wrote while it ran; the same lines are available from
[AsyncJobManager](https://docs.kademi.co/ref/templating/md/AsyncJobManager.md)`.listJobLogs(job)`.
See [background-jobs.md](background-jobs.md).

## What your own logging gets you

Everything at INFO and above is kept in your account's log, tagged with your app.

```js
console.log(`myapp rebuildIndex: starting for category ${categoryId}`);  // GraalJS (.mjs)
log.info('myapp rebuildIndex: starting for category {}', categoryId);    // Nashorn (.js)
```

`console` follows the browser rules, so it takes `%s` style substitution and template literals,
not the `{}` placeholders `log` uses.

`console.log` and `console.info` record at INFO, `console.warn` at WARN, `console.error` at
ERROR. Anything below INFO is not retained, so do not rely on a debug level existing: log at
info and remove the noisy lines afterwards.

The log is account-wide and busy. Prefix your messages with something unique to your app and the
operation (`'myapp rebuildIndex: ...'`) so the keyword filter can pull your lines out of it.

Log values, not just milestones. A Java object logged as-is is unreadable and
`JSON.stringify` on one gives `{}`; use `formatter.toJson(obj)`.

## Syntax error or runtime error

The two fail completely differently, and the symptom tells you which one you have before you read
a single log line.

**A syntax error takes out the whole file.** Script files are evaluated when the app's engine
initialises. A file that does not parse never runs, so nothing it registers exists: its routes
404, `services.thatService` is undefined, its menu item is missing, its lifecycle callback never
fires. The app looks half-installed or not installed at all. There is one error at
initialisation and nothing per request, so hitting the URL again produces no new log line.

An easy way to produce exactly the same symptom without a syntax error: the wrong file extension
for the engine. A `.mjs` file in an app declared `engineVersion="1.1"` is never loaded, and a
`.js` file in a `2.0` app is not the entrypoint anything imports. Check `engineVersion` and the
extension before hunting for a parse error.

**A runtime error takes out one path.** Everything else in the app works, one URL or one button
fails, and every attempt writes a fresh stack trace to the log. If retrying produces a new log
entry, it is a runtime error.

## The silent null

`services.*`, `formatter`, `views`, `page`, the form context and every entity are Java objects
dispatched dynamically at the moment the line runs. Three different failures look similar:

- **A property that does not exist reads as `undefined`, silently.** Property access on a Java
  object never throws. `profile.emailAddress` when the getter is called something else is not an
  error, it is `undefined`, and it stays undefined all the way into whatever you built from it.
- **A method that does not exist throws** `TypeError: <name> is not a function`, on that line, on
  that path only.
- **A method that exists but whose signature you did not match** is the one that produces a
  silent `null`. Arguments are converted from JS values to the Java parameter types, and a call
  that matches no signature, or matches a different overload from the one you meant, either
  throws a `TypeError` about argument count or types, or runs a lookup that was never going to
  find anything and hands back `null`.

So a `null` out of a manager method almost always means the call ran with an argument that
matched nothing: a name that does not exist in this account, an id of the wrong type, a JS array
where a Java list was wanted, a string where an entity was wanted. It rarely means the data is
missing.

Two habits that catch it:

- Look the method up before calling it, in
  `https://docs.kademi.co/ref/templating/md/<ClassName>.md`, and check the argument order, the
  parameter types and the return type. Use the `kademi-api-reference` skill.
- Log both sides when a comparison misbehaves. An id arrives as a Java `Long`, so `===` against a
  JS number is always false. Use `formatter.eq(a, b)` for ids, and
  [Formatter](https://docs.kademi.co/ref/templating/md/Formatter.md)'s null-safe comparisons for
  anything else Java-backed.

## A workable order to attack it in

1. Does anything else in the app work? No: suspect a parse error or the wrong extension, and look
   at the log from the moment the app was last enabled or updated.
2. Start a debug session scoped to the path or task name, and reproduce. Read the captured
   operation: the parameters, the authenticated user, and every log line the operation wrote.
3. No log line at all from your code? The code never ran. Check that the route matched, that the
   POST parameter named in `addMethod` is really in the body, and that the function name is
   spelled the same in the mapping and on `globalThis`.
4. A stack trace with a `TypeError`: a method or signature that does not exist. Look it up.
5. Values that are wrong rather than missing: log them with `formatter.toJson`, both sides of the
   comparison, before the line that goes wrong.
6. Not reproducible on demand, so a session has nothing to catch: fall back to the Logs screen,
   filtered to your app's prefix, and read around the time it last happened.
