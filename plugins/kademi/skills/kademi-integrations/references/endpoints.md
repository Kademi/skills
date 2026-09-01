# Endpoints: getting data in and out

A pipeline is inert on its own. An **endpoint** is what connects it to the outside world: a route
that says "when data arrives at this address, run this pipeline", or "when this export fires, send
the result there".

Each endpoint is one
[EndPointMapping](https://docs.kademi.co/ref/templating/md/EndPointMapping.md): an id, a type, a
direction, an address pattern, and the path of the pipeline XML that processes it.

## Where endpoints live

Endpoints belong to a **website** that has the integration app enabled. Kademi recommends a
dedicated website for integrations, separate from the one your users browse, so that inbound
addresses and credentials are not part of your public surface.

Manage them at **Data > Integration > Endpoints**. Two ways to create one:

- **Create Import / Create Export**, a wizard covering SFTP, FTP/S, HTTP/S, email and upload-only.
  This is the right default: no XML, and it writes a sensible starting pipeline for you.
- **Create config / Edit config**, which drops you into the XML for anything the wizard does not
  cover.

Endpoints can only be created or edited on a **draft version** of the website. On the live version
the create and edit buttons are hidden. Only the live version is used for integration processing,
so publish the draft before expecting anything to change.

Full walkthrough:
[Creating and Editing Integration Endpoints in Kademi](https://docs.kademi.co/blogs/docs-kb/creating-and-editing-integration-endpoints-in-kademi/).

## The endpoint manifest

Endpoints are stored as XML. The classic form is a single manifest at `/theme/integration.xml` in
the website's files, listing one `endpoint` element per route; the admin UI also reads and writes
endpoint and pipeline definitions under the website's `/integration` folder.

```xml
<integration>
    <endpoint id="inbound-sales"
              type="http"
              direction="in"
              address="/inbound\/sales (?&lt;month&gt;.*)\.xlsx"
              pipelinePath="/integration/sales-import.xml"
              enabled="true"/>
    <endpoint id="weekly-deals-export"
              type="email"
              direction="out"
              address="ops@example.com"
              pipelinePath="/integration/deals-export.xml"
              fileName="active-deals.csv"
              enabled="true"/>
</integration>
```

## Address patterns and named groups

`address` is a **regular expression**, matched against the request path (HTTP and FTP) or against
the local part of the recipient address (email). Because it lives in XML, `<` must be escaped as
`&lt;`, which is why named groups look like `(?&lt;month&gt;.*)`.

Named capture groups are the useful part: whatever they match is put into the pipeline's attributes
under the group name, where a script can read `pipeline.attributes.month` and a
[Column](https://docs.kademi.co/ref/templating/md/Column.md) can read `attribute="month"`. Use them
to lift a period, a region or a supplier code straight out of the file name.

Addresses, usernames, passwords and other connection fields can reference environment variables and
secrets with `${my.variable}` or `${secret.name}` syntax, resolved when the pipeline runs. Keep
credentials out of the XML.

## Types

### HTTP

`type="http"`. The endpoint appears at its address on the integration website.

**Inbound.** POST the file as a multipart form. The head step of the pipeline receives an
`InputStream` of the uploaded file as its first argument, so the pipeline usually starts with
[`CsvInput`](https://docs.kademi.co/ref/templating/md/CsvInput.md), [`ExcelInputStep`](https://docs.kademi.co/ref/templating/md/ExcelInputStep.md) or [`FixedWidthInput`](https://docs.kademi.co/ref/templating/md/FixedWidthInput.md). Form and query parameters are copied into the
pipeline attributes. The caller's IP is recorded as the source address. The response is a JSON
document reporting whether the run succeeded, plus its failures, warnings and info messages, so a
remote system can tell immediately whether its file was accepted.

**Outbound.** A GET on the address runs the pipeline with no input and streams the pipeline output
back. The response content type comes from the endpoint's `contentType`, defaulting to `text/csv`,
unless a step such as `VelocityOutput` sets its own. An outbound HTTP endpoint can also push:
it posts the exported file to a remote URL as a multipart form, using `fieldName` as the form field
name.

Authentication uses the endpoint's `username` and `password`.

### SFTP

`type="sftp"`. The most common choice for enterprise batch file exchange.

Inbound fetches files from a remote path on a schedule; outbound pushes the exported file. Set
`username` plus either `password` or `privateKey`, a PEM-encoded private key.

### FTP and FTP/S

`type="ftp"`. Supported, but treat it as legacy and prefer SFTP. `security` set to `SSL` or `TLS`
opens an FTPS connection, and `securityMode` selects `Implicit` or explicit. Blank means plain FTP,
with credentials and content in the clear.

### Email

`type="email"`.

**Inbound.** The address pattern is matched against the local part of an address at the website's
domain, so a pattern of `sales-.*` catches `sales-north@yourwebsite`. The sender's address must
resolve to an existing profile in the account, otherwise the run fails; this is the access control.
The head step receives the received message, the sender is recorded as the source address, and any
named groups from the pattern land in the attributes.

**Outbound.** The exported file is emailed as an attachment. Recipients come from the address list
in the endpoint's `address` field, plus every profile in any group named in its `recipientGroups`
attribute. An address with no matching profile is still emailed. `fromAddress` and
`replyToAddress` set the envelope.

### Upload only

Files are uploaded by hand through the admin: no listener, no scheduled fetch. Good for a monthly
file someone sends by email, and good for developing a pipeline before the transport exists.

## Direction

`direction="in"` means the Kademi account receives data; `direction="out"` means it sends data. It
selects which handler runs, so getting it wrong produces an endpoint that matches but does nothing
useful.

## File naming and storing

`fileName` is a template for the file being produced or consumed, evaluated against the pipeline's
attributes at run time and able to contain field placeholders. `storeFile` keeps the processed file
in the file store afterwards, so it can be downloaded from the run's result page later. Turn it on
while you are getting a feed working.

## Duplicate prevention

Three settings work together:

- `recordExecution` (default on) writes a
  [PipelineExecution](https://docs.kademi.co/ref/templating/md/PipelineExecution.md) row for every
  run. Everything else depends on it.
- `execIdTemplate` is an MVEL template producing an id that uniquely identifies the data, not the
  run. Something like a points file for a given day should produce the same id every time it is
  loaded. It uses MVEL template syntax, `@{...}`, evaluated with the pipeline as its context and
  with `pipeline`, `formatter` and `services` in scope, so
  `sales-@{pipeline.attributes.month}` and `@{fileName}` both work.
- `preventDuplicates` refuses a run when an execution with that id has already run or is in
  progress.

The equivalent inside a pipeline is
[RecordExecutionStep](https://docs.kademi.co/ref/templating/md/RecordExecutionStep.md), which does
the same thing at step level.

Turn this on for anything that awards points, money or stock. An accidental re-upload of yesterday's
file is the single most common integration incident.

## Running and watching a run

- Endpoints that support manual triggering show a **Run** button in the endpoints list.
- **Upload** in the row's dropdown pushes a file through an inbound endpoint by hand.
- Scheduled endpoints fire on their own; see [sync-jobs.md](sync-jobs.md).
- **Integration history** lists recent runs with status, pipeline, start time, duration, website and
  source or destination. Opening one shows the execution id, the output file, every failure and
  warning, a step-by-step info log, and a **Re-process** action.

An endpoint can be disabled without deleting it. A disabled endpoint still matches its address, but
refuses to process the request.

## Access control

Two roles govern integrations:

- [IntegrationExecutorRole](https://docs.kademi.co/ref/templating/md/IntegrationExecutorRole.md)
  lets a user run existing jobs.
- [IntegrationManagerRole](https://docs.kademi.co/ref/templating/md/IntegrationManagerRole.md)
  adds read and write access to endpoints and integration configuration.

Grant the executor role to the people who operate feeds and keep the manager role for the people who
change them.

## Managing endpoints from code

[IntegrationManager](https://docs.kademi.co/ref/templating/md/IntegrationManager.md) is available to
server JavaScript as `services.integrationManager`. It has a builder per endpoint type
(`newSFTPEndpointBuilder`, `newFTPEndpointBuilder`, `newHTTPEndpointBuilder`,
`newEmailEndpointBuilder`, `newUploadOnlyEndpointBuilder`), plus `saveEndpointMapping`,
`deleteEndpointMapping`, `findEndpoint`, and the pipeline methods `findPipelineStep`, `toXml`,
`fromXml`, `savePipelineStep` and `persistPipeline`.
[PipelineBuilder](https://docs.kademi.co/ref/templating/md/PipelineBuilder.md) builds the simple
export-only pipeline shape the wizard produces: a transaction step wrapping either a query export
or a table uploader.

`EndPointMapping` is immutable. Its `with*` methods return a modified copy, so edits look like
`endpoint = endpoint.withEnabled(false)` followed by a save.

Use this when your app needs to provision its own integration on install, or expose a simplified
configuration screen of its own. For one-off setup, use the admin UI.

## Reacting to runs

[PipelineProcessEvent](https://docs.kademi.co/ref/templating/md/PipelineProcessEvent.md) fires when
a pipeline starts, completes or fails. Listen for it if an app needs to act on the outcome of an
import, for example to refresh a cached total or notify a team once a feed has landed.
