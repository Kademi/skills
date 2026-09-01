# Glossary

Kademi's vocabulary is mostly borrowed from channel and partner marketing, and a few words mean
something narrower here than you would guess. These are the ones that cause confusion.

## Tenancy and content

**Account** - one Kademi tenant. An account is the top-level administrative organisation, and it
owns everything: users, websites, installed apps, data. Almost every lookup in the platform is
scoped by account. Managed by
[AccountManager](https://docs.kademi.co/ref/templating/md/AccountManager.md), which also captures
an account's configuration as a snapshot so it can be diffed and deployed into another account.

**Organisation** - a node in the account's org tree. The account itself is the root organisation,
and beneath it sit the partner companies, distributors, regions and dealerships you are running
the program for. Organisations nest, which is why permissions are always qualified by the
organisation they apply in. Organisations can be tagged with organisation types - see
[OrgTypeBean](https://docs.kademi.co/ref/templating/md/OrgTypeBean.md) - and managed through
[OrganisationManager](https://docs.kademi.co/ref/templating/md/OrganisationManager.md).

**Website** - a public site served by the account, identified by its own DNS name. One account can
run many. A website is also a versioned content repository, so its pages and assets have history.
See [Website](https://docs.kademi.co/ref/templating/md/Website.md) and
[WebsiteManager](https://docs.kademi.co/ref/templating/md/WebsiteManager.md).

**Repository** - versioned storage, with commits and named branches, backing a website, an app, a
theme or a funnel. If something in Kademi has versions, it is a repository underneath.

**Branch** - a named line of history within a repository. For an installed app the live branch name
is the installed version number, which is why "branch" and "version" are used interchangeably in
`dependencies.json` and in the admin UI. The same app installed into two accounts is two separate
repositories with independent live branches.

## People

**Profile** - a person. One row per human, holding the login, name, contact details and custom
fields. Profiles are account-scoped. The JS-facing view is
[ProfileBean](https://docs.kademi.co/ref/templating/md/ProfileBean.md).

**Group** - a named set of people, and the unit permissions are assigned to. In older parts of the
UI a group is also called a "program", because a group is what content and courses are published
to.

**Membership** - the link that says a profile is in a group **within a particular organisation**.
This qualification is the point: because organisations nest, the same person can hold the same
group in several organisations and each is a separate membership. Bob can be a Sales Rep in the
Southern Region and a Report Viewer at the parent company at the same time. See
[GroupMembership](https://docs.kademi.co/ref/templating/md/GroupMembership.md).

**Group in website** - the link that exposes a group's content on a particular website. Without it,
members cannot reach that content there. See
[GroupInWebsite](https://docs.kademi.co/ref/templating/md/GroupInWebsite.md).

## Extensions

**Repository app** - a versioned bundle of server-side JavaScript, templates and assets, installed
into an account from the Marketplace. This is the unit of extension: everything you build is one.
See [RepositoryApp](https://docs.kademi.co/ref/templating/md/RepositoryApp.md), and
[project-layout.md](project-layout.md) for the file structure.

**Component** - a drag-and-drop block a content editor places on a page in KEditor: a product list,
a chart, a form. An app registers components, and the editor renders their settings form and their
output. See [ComponentBean](https://docs.kademi.co/ref/templating/md/ComponentBean.md) and
[ComponentBuilder](https://docs.kademi.co/ref/templating/md/ComponentBuilder.md).

**Portlet** - a panel one app injects into a named section of a page owned by a different app. The
host page declares a section; any installed app can register a template and a handler function
against that section name. This is how you add a card to a page you do not own. See
[PortletMapping](https://docs.kademi.co/ref/templating/md/PortletMapping.md).

**KCode** - hierarchical field navigation used by content editors, not developers. A KCode is a
path built in the KCode modal in KEditor - for example current user, then primary memberships, then
the organisation's name - and stored on the element as a slash-separated path such as
`currentUser/memberships/firstMem/membershipOrg/fullName`. It is resolved at render time against
the surrounding **context**, and the context is the thing to understand: for website and dashboard
content it is the current user, for a journey email it is the journey's lead. Apps can contribute
the objects and fields a KCode can walk. Guide:
<https://docs.kademi.co/blogs/docs-kb/using-kcode/>

## Journeys and process

**Journey** - the configured path a person or a deal travels: a graph of goals to be reached and
actions to run when they are. Journeys are what most Kademi programs are actually made of.

**Funnel** - the underlying object a journey is stored and executed as: its stages, its goal and
action nodes, its automations, its scoring and its task definitions, held per repository branch.
When the docs say "funnel" they mean the machinery; "journey" is the user-facing word for the same
thing. See [Funnel](https://docs.kademi.co/ref/templating/md/Funnel.md).

**Lead** - one prospect or deal moving through a funnel. It records who it is for (a profile, or
just captured contact details before the person is known), which goal the funnel is currently
trying to have it reach, and what it is worth. Despite the sales-y name, a lead is the generic
"one instance of a journey in progress". See
[Lead](https://docs.kademi.co/ref/templating/md/Lead.md) and
[LeadManager](https://docs.kademi.co/ref/templating/md/LeadManager.md).

**Pipeline** - nothing to do with leads. A pipeline is one run of a configured integration: a chain
of steps that pull, transform and push data, driven on a schedule or on demand. This is the import
and export machinery. See [Pipeline](https://docs.kademi.co/ref/templating/md/Pipeline.md).

**Series** - a sales data series: a named collection users submit numeric records against, with a
unit label and a set of records per user. Used for sales claims, volume reporting and anything
where participants enter periodic figures. See
[SeriesBean](https://docs.kademi.co/ref/templating/md/SeriesBean.md).
