# KEditor components

A component is a block a content author drags from the KEditor palette onto a page. Any app can
contribute components. The app registers the component in its server-side JavaScript; Kademi
derives the file paths from the app id and component id.

---

## Registering a component

```javascript
// APP-INF/app.js, loaded from the app's controllers.xml
controllerMappings.addComponent("myapp", "priceTable", "html", "Shows the current price table", "My app");
```

| Argument | Meaning |
|---|---|
| `appId` | folder the component's files live under, normally the app name |
| `compId` | globally unique component id, and the base name of every file |
| `type` | the resource type the component may be placed on |
| `desc` | text shown in the component picker |
| `categories` | comma separated tags that group it in the picker (optional) |

Overloads and their argument lists are on
[ControllerMappingList](https://docs.kademi.co/ref/templating/md/ControllerMappingList.md). The
component ids are global across the account, so prefix them with something specific to your app -
`myappPriceTable`, not `table`.

`type` is matched against the resource being edited. `html` is a normal web page. Other values in
use include `edm` and `email` for email templates. A component can support several types:

```javascript
controllerMappings.addComponent("myapp", "priceTable", ["html", "email"], "Price table", "My app");
```

### The builder, for default attributes

When the component needs default settings applied the moment it is dropped in, use the two
argument form to get a
[ComponentBuilder](https://docs.kademi.co/ref/templating/md/ComponentBuilder.md):

```javascript
controllerMappings.addComponent("myapp", "priceTable")
    .types(["html"])
    .desc("Shows the current price table")
    .categories("My app,Commerce")
    .addDefaultAtt("data-show-title", "true")
    .addDefaultAtt("data-row-limit", "10")
    .build();
```

`addType(...)` appends one type, but only after `types(...)` has established the list - call
`types` first. `build()` registers the component and returns the mapping list so you can chain
more calls.

---

## File naming convention

`addComponent("myapp", "priceTable", ...)` resolves to these files under
`common/theme/apps/myapp/` (or `website/theme/apps/myapp/` if the component is website-only):

| File | Required | Purpose |
|---|---|---|
| `priceTableComponent.html` | yes | Velocity template rendering the component with live data |
| `priceTableSettings.html` | no | HTML form for the settings panel |
| `priceTableComponent.js` | no | browser code registering the component with KEditor |
| `priceTable.png` | no | thumbnail in the component palette |

The placeholder Kademi inserts when the component is dropped in is
`<div data-dynamic-href='_components/priceTable'></div>`. It is replaced by the rendered output.

---

## The render template

This is a **plain fragment** - no `<html>`/`<body>` wrapper, unlike page templates.

Variables in scope:

| Variable | What it is |
|---|---|
| `$page` | the page the component is on; absent in some preview contexts, so guard it |
| `$folder`, `$rootFolder` | the page's parent folder and the website root |
| `$formatter`, `$services`, `$applications`, `$user` | as on any page |
| `$keditorUniqueId` | a stable id unique to this instance of the component on the page |
| `$componentData` | authored content stored inside the component |
| one variable per `data-` attribute | see below |

**Every `data-` attribute on the component element becomes a camel-cased variable.**
`data-show-title` becomes `$showTitle`, `data-row-limit` becomes `$rowLimit`. Values arrive as
strings, so coerce them and supply a default:

```velocity
#set( $showTitle = $formatter.toBool($showTitle, true) )
#set( $rowLimit  = $formatter.toInteger($formatter.ifNull($rowLimit, "10")) )
#set( $listTitle = $formatter.ifNull($listTitle, "Prices") )

#if( $page )
    ## findPrices is a function this app exposes from its own server-side code
    #set( $products = $applications.get("myapp").call("findPrices", $page) )
    <div class="price-table" id="pt-$!keditorUniqueId">
        #if( $showTitle )
            <h3>$formatter.htmlEncode($listTitle)</h3>
        #end
        <table class="table">
            #foreach( $p in $products )
                #if( $foreach.count > $rowLimit )
                    #break
                #end
                <tr>
                    <td>$formatter.htmlEncode($p.title)</td>
                    <td>$formatter.formatCurrency($p.price)</td>
                </tr>
            #end
        </table>
    </div>
#else
    <div class="price-table"><h3>Prices</h3><p>Example price table</p></div>
#end
```

The `#if( $page ) ... #else` shape is the standard way to give the palette and the editor
something sensible to show when there is no real page context.

---

## The settings panel

Two pieces: an HTML form, and browser JavaScript that reads and writes the component's `data-`
attributes.

**`priceTableSettings.html`** - a plain form fragment, no Velocity needed:

```html
<form class="form-horizontal">
    <div class="form-group">
        <label class="col-sm-12">
            <input type="checkbox" class="show-title" /> Show title
        </label>
    </div>
    <div class="form-group">
        <label class="col-sm-12" for="list-title">Title</label>
        <div class="col-sm-12">
            <input type="text" id="list-title" class="form-control list-title" />
        </div>
    </div>
</form>
```

**`priceTableComponent.js`** - registers the component with KEditor in the browser:

```javascript
(function ($) {
    var KEditor = $.keditor;

    KEditor.components['priceTable'] = {
        settingEnabled: true,
        settingTitle: 'Price table settings',

        // Called once, to build the settings panel.
        initSettingForm: function (form, keditor) {
            return $.ajax({
                url: '_components/priceTable?settings',
                type: 'get',
                dataType: 'HTML',
                success: function (resp) {
                    form.html(resp);

                    form.find('.show-title').on('change', function () {
                        var component = keditor.getSettingComponent();
                        component.attr('data-show-title', this.checked);
                        keditor.initDynamicContent(component.find('[data-dynamic-href]'));
                    });

                    form.find('.list-title').on('change', function () {
                        var component = keditor.getSettingComponent();
                        component.attr('data-list-title', this.value);
                        keditor.initDynamicContent(component.find('[data-dynamic-href]'));
                    });
                }
            });
        },

        // Called each time the panel opens, to load current values into it.
        showSettingForm: function (form, component, keditor) {
            var atts = keditor.getDataAttributes(component, ['data-type'], false);
            form.find('.show-title').prop('checked', atts['data-show-title'] !== 'false');
            form.find('.list-title').val(atts['data-list-title'] || 'Prices');
        },

        // Optional: called when the component is first initialised in the editor.
        init: function (contentArea, container, component, keditor) {
            component.children('.keditor-component-content').css('min-height', 30);
        }
    };
})(jQuery);
```

The loop that makes this work:

1. The settings control writes a `data-` attribute onto the component element.
2. `keditor.initDynamicContent(...)` re-POSTs to `_components/<compId>`, sending every `data-`
   attribute as parameters.
3. The server renders `priceTableComponent.html` with those attributes as variables and returns
   the HTML.
4. KEditor swaps the returned HTML into the page, so the author sees the change immediately.

`_components/<compId>?settings` returns the settings form. `getDataAttributes(component,
excludeList, false)` reads the component's current attributes.

Declare the JS file in the app's `dependencies.json` so it loads in the editor - see
[dependencies-json.md](dependencies-json.md).

---

## Rendering a component outside the page builder

From any template:

```velocity
#renderComponent("priceTable")
#renderComponent("priceTable", "showTitle=false; rowLimit=5")
```

The second argument is `name=value` pairs separated by `;`, and the names arrive in the render
template exactly as written.

---

## Contributing page templates

`controllerMappings.addTemplate(parentPath, fileName, description, contentTemplate)` registers a
template from your app repository so content editors can choose it when creating a page.

`templateDefBuilder()` is the fuller form, when you need to say what kind of page it is and which
editor opens it:

```js
controllerMappings.templateDefBuilder()
    .path('/theme/apps/myapp/')
    .name('campaign-landing')
    .title('Campaign landing page')
    .pageType('WebPage')
    .isContent(true)
    .isTheme(false)
    .editor('keditor')
    .build();
```

For an **email** template use `addEdmTemplate(...)` instead - same idea, but it opens in the EDM
editor and is backed by a dummy EDM resource rather than a website page. See
[TemplateDefBuilder](https://docs.kademi.co/ref/templating/md/TemplateDefBuilder.md).

## Appearing in resource pickers

`controllerMappings.browseResourcesFunction(fn)` registers a function that lists your app's own
resources for a given website path, so they show up in resource browsers - the link picker, for
instance. The function is called with the website root folder, the path, and the list to add
resource beans to.

Without it, an author linking to something your app owns has to know and type its URL. With it, your
app's resources are browsable like any other content.

## Checklist

- Component id is globally unique and prefixed for your app.
- Render template is a bare fragment, guarded with `#if( $page )`.
- Every `data-` attribute has a default in the template - authors will drop the component in
  before configuring it.
- Every value from an attribute or an entity is passed through `$formatter.htmlEncode`.
- The component JS is declared in `dependencies.json`.
- A `<compId>.png` exists, or the palette shows a blank tile.
