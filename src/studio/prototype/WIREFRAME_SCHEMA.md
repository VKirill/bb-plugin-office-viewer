# BB Wireframe format (v2)

Agents read and write `*.wireframe.json` files in the thread `Prototypes/` folder. Validate against `wireframe.schema.json` in the same folder.

## Document

| Field | Type | Notes |
| --- | --- | --- |
| `format` | `"bb-wireframe"` | Constant |
| `version` | `2` | Constant (v1 is migrated on load) |
| `name` | string | Document title, 1–200 chars |
| `pages` | array | 1–200 pages |
| `activePageId` | string | Must equal an existing `pages[].id` |
| `components` | array? | Reusable masters, max 200 |

## Page

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable id, 1–128 chars |
| `name` | string | Tab label |
| `canvas` | object | `width`, `height` (1–8192), `background` (CSS color) |
| `elements` | array | Max 2000 elements per page |
| `notes` | string? | Page notes, max 8000 chars |

Coordinates use an **8px grid** (`x`, `y`, `w`, `h` are numbers; snap to multiples of 8).

## Element (common)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Unique on the page |
| `type` | enum | See element types below |
| `label` | string | Layer name in the outline |
| `x`, `y`, `w`, `h` | number | Position and size; `w`/`h` > 0, ≤ 8192 |
| `props` | object | Type-specific keys (string, number, boolean, string[], string[][]) |
| `note` | string? | Annotation, max 4000 |
| `hidden`, `locked` | boolean? | Visibility / lock |
| `groupId` | string? | Group membership |
| `parentId`, `parentState` | string? | Nested in DynamicPanel state |
| `style` | object? | `base` patch + `effects` (`hover`, `pressed`, `selected`, `disabled`, `focus`) |
| `interactions` | array? | Max 40 per element |

### Style patch fields

`fill`, `color`, `stroke`, `strokeWidth`, `radius`, `opacity`, `fontSize`, `fontWeight`, `textAlign` (`left` \| `center` \| `right`), `shadow` (boolean).

### Interactions

Each interaction: `id`, `event` (`click` \| `doubleClick` \| `mouseEnter` \| `mouseLeave`), `cases[]` with `id`, optional `name`, and `actions[]`.

Action `type` is one of: `openLink`, `goToPage`, `show`, `hide`, `toggle`, `setPanelState`, `setText`, `setSelected`, `scrollTo`, `wait`. Extra keys on actions are allowed (e.g. `url`, `pageId`, `targetId`, `text`, `ms`).

## Element types and default props

Use the catalog defaults when omitting props (builder uses `CATALOG` in code). Highlights:

| Type | Typical props |
| --- | --- |
| **Box**, **Ellipse** | `fill`, `border`, `radius`, `text` |
| **Heading**, **Text**, **Label**, **Paragraph** | `text`, `level` (heading) |
| **Button** | `text`, `variant` (`default`, `secondary`, `outline`, `ghost`, `destructive`) |
| **TextField**, **TextArea**, **SearchField** | `placeholder`, `value` |
| **ChoicePicker**, **ListBox** | `options[]`, `value` / `selected` |
| **Checkbox**, **Radio**, **Switch** | `text`, `checked` |
| **Image** | `alt`, optional `src` (path under `Prototypes/refs/`) |
| **Icon** | `name` (Hugeicons name), `size`, `color` |
| **Card**, **Modal**, **Alert** | `title`, `text`, `variant` |
| **Nav**, **Tabs**, **Menu**, **Breadcrumbs** | `items[]`, `active` / `orientation` |
| **Table** | `columns`, `rows` |
| **List**, **Tree** | `items[]` |
| **DynamicPanel** | `states[]`, `active` state name; children use `parentId` + `parentState` |
| **Repeater** | `layout`, `columns[]`, `rows` |
| **Connector** | `fromId`, `toId`, anchors, `routing`, arrows, `label` |
| **Instance** | `componentId` (master in `components[]`) |
| **Shape** (flow) | `shape`, `text`, `fill`, `stroke` |
| **HotSpot**, **InlineFrame**, **Snapshot**, form controls | See `wireframe.schema.json` and builder palette |

**Components**: define masters in `components[]` (`id`, `name`, `w`, `h`, `elements`). Place **Instance** elements with `props.componentId`. Optional per-instance text overrides use instance props.

**Connectors**: `fromId` / `toId` reference element ids; routing `elbow` or `straight`.

**Agent trace layer**: optional full-canvas **Image** with `props.agentTrace: true`, `props.src` pointing to a ref image, `locked: true`, `style.base.opacity: 0.3`.

## Minimal example

```json
{
  "format": "bb-wireframe",
  "version": 2,
  "name": "Login",
  "activePageId": "pg_login",
  "pages": [
    {
      "id": "pg_login",
      "name": "Login",
      "canvas": { "width": 1280, "height": 800, "background": "#ffffff" },
      "elements": [
        {
          "id": "el_title",
          "type": "Heading",
          "label": "Heading 1",
          "x": 400,
          "y": 120,
          "w": 480,
          "h": 48,
          "props": { "text": "Sign in", "level": 1 }
        },
        {
          "id": "el_email",
          "type": "TextField",
          "label": "TextField 1",
          "x": 400,
          "y": 200,
          "w": 320,
          "h": 40,
          "props": { "placeholder": "Email", "value": "" }
        },
        {
          "id": "el_btn",
          "type": "Button",
          "label": "Button 1",
          "x": 400,
          "y": 264,
          "w": 160,
          "h": 40,
          "props": { "text": "Continue", "variant": "default" }
        }
      ]
    }
  ]
}
```

## Full example (multi-page, component, interaction)

```json
{
  "format": "bb-wireframe",
  "version": 2,
  "name": "Checkout",
  "activePageId": "pg_cart",
  "components": [
    {
      "id": "cmp_row",
      "name": "Product row",
      "w": 600,
      "h": 72,
      "elements": [
        {
          "id": "cmp_title",
          "type": "Text",
          "label": "Title",
          "x": 0,
          "y": 8,
          "w": 400,
          "h": 32,
          "props": { "text": "Product" }
        },
        {
          "id": "cmp_price",
          "type": "Text",
          "label": "Price",
          "x": 420,
          "y": 8,
          "w": 120,
          "h": 32,
          "props": { "text": "$0" }
        }
      ]
    }
  ],
  "pages": [
    {
      "id": "pg_cart",
      "name": "Cart",
      "canvas": { "width": 1280, "height": 800, "background": "#f8fafc" },
      "elements": [
        {
          "id": "el_row1",
          "type": "Instance",
          "label": "Row 1",
          "x": 80,
          "y": 120,
          "w": 600,
          "h": 72,
          "props": { "componentId": "cmp_row" }
        },
        {
          "id": "el_pay",
          "type": "Button",
          "label": "Pay",
          "x": 80,
          "y": 240,
          "w": 200,
          "h": 40,
          "props": { "text": "Pay now", "variant": "default" },
          "interactions": [
            {
              "id": "ix_pay",
              "event": "click",
              "cases": [
                {
                  "id": "case_default",
                  "actions": [{ "type": "goToPage", "pageId": "pg_done" }]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "pg_done",
      "name": "Done",
      "canvas": { "width": 1280, "height": 800, "background": "#ffffff" },
      "elements": [
        {
          "id": "el_ok",
          "type": "Heading",
          "label": "Done",
          "x": 80,
          "y": 80,
          "w": 400,
          "h": 48,
          "props": { "text": "Thank you", "level": 1 }
        }
      ]
    }
  ]
}
```

When editing an open file, keep `activePageId` valid and preserve existing ids unless intentionally restructuring.
