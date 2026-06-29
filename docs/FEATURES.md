# yaml-routing — Feature Set

## Two-file manifest model

All routing and navigation is declared in two YAML files at the repo root:

- **`studio.platform.yaml`** — NVIDIA-authored. Ships with the platform, updated on each release. Do not edit directly.
- **`studio.override.yaml`** — Admin-authored. Never touched by platform upgrades. Extends and overrides the platform manifest.

---

## Route table

Routes are pure routing declarations: path, component, and optional gate or disabled flag.

```yaml
routes:
  - path: /models
    component: routes/Models/index.tsx

  - path: /models/:modelId
    component: routes/ModelDetail/index.tsx
    gate: BASE_MODELS_ENABLED   # omitted when flag is false

  - path: /evaluations
    disabled: true              # route returns 404, dropped from nav
```

Route hierarchy is **inferred from path prefixes** — `/models/:modelId` is automatically nested under `/models` in the React Router tree. No explicit parent/child declarations.

---

## Navigation as a separate section

The `nav:` section is independent of the route table. A route can exist without a nav entry (child routes, detail pages, disabled entries).

```yaml
nav:
  top:       # ungrouped items rendered above all groups
    - path: /dashboard
      title: Dashboard
      icon: LayoutDashboard
      order: 50

  groups:    # labeled sections
    - id: models
      title: Models
      order: 10
      items:
        - path: /models
          title: Models
          icon: Cpu
          order: 10

  bottom:    # pinned below all groups
    - path: /settings
      title: Settings
      icon: Settings
      order: 50
```

---

## Ordering

Both groups and items carry an optional `order` number. Defaults are assigned at merge time from list position:

- Platform entries: base `0` → `0, 10, 20, ...`
- Admin entries: base `100` → `100, 110, 120, ...`

Setting `order: 50` on platform anchors leaves room for admin items before (`< 50`) or after (`> 50`).

---

## Group injection

A group declared in `studio.override.yaml` with the same `id` as a platform group has its items **merged in and sorted by order** — it does not replace the group.

```yaml
# studio.override.yaml — injects into platform's models group
nav:
  groups:
    - id: models
      items:
        - path: /trace-view
          title: Trace View
          icon: Activity
          order: 15   # appears between Models(10) and Evaluations(20)
```

A group with a new `id` creates an independent section.

---

## Route replacement

An admin entry with the same path as a platform route silently replaces it — last declaration wins.

```yaml
# studio.override.yaml
routes:
  - path: /dashboard
    component: plugins/CustomDashboard/index.tsx
```

---

## Route removal

`disabled: true` removes the route from the router (404) and automatically drops its nav item.

```yaml
routes:
  - path: /evaluations
    disabled: true
```

---

## Nav hiding

`nav.hide` removes paths from the sidebar only. The route still loads at its URL — this is not access control.

```yaml
nav:
  hide:
    - /evaluations
```

---

## Feature flag gating

`gate:` on a route entry references a feature flag name. The route (and its nav item) is omitted when the flag resolves to `false`.

```yaml
routes:
  - path: /models/:modelId
    component: routes/ModelDetail/index.tsx
    gate: BASE_MODELS_ENABLED
```

---

## Code splitting

Every route component is lazy-loaded. Vite produces a separate JS chunk per component — the main bundle never includes route code. Navigation to a route loads its chunk on demand.

---

## Path variables

`path_variables` documents known URL parameter names. Used by dev-mode validation only — descriptions are for authors.

```yaml
path_variables:
  modelId: Unique model identifier
  workspace: Workspace slug
```

---

## Dev-mode warnings

Two checks run at startup in development (`import.meta.env.DEV`). Both are tree-shaken out of production builds.

### Undefined path variable

Fires when a route path uses a `:param` name not declared in `path_variables`.

```
[studio] Undefined path variable :experimentId in "/experiments/:experimentId"
  → add to path_variables in studio.platform.yaml or studio.override.yaml
```

### Shadowed path variable

Fires when two routes use different param names at the same URL position.

```
[studio] Path variable shadowing: ":modelId" in "/models/:modelId" and
":modelName" in "/models/:modelName/prompts" occupy the same URL position
— use a consistent name
```

---

## Workspace-scoped route overrides

React Router v6 scores static path segments (10 pts) above dynamic ones (3 pts),
so a fully-static route always wins over a parameterised one at the same position.
A plugin can silently override a platform route for a single workspace by declaring
a static path — no special engine handling needed.

```yaml
# studio.platform.yaml
routes:
  - path: /workspaces/:workspaceId/models
    component: routes/Models/index.tsx

# studio.override.yaml — wins for oracle-db-agents only
routes:
  - path: /workspaces/oracle-db-agents/models
    component: plugins/OracleModels/index.tsx
```

Scores: `/workspaces/oracle-db-agents/models` = 30 (10+10+10) vs
`/workspaces/:workspaceId/models` = 23 (10+3+10). React Router matches the
higher-scoring route first.

**Nav visibility** is a separate concern — a nav item for a workspace-specific
route should include a `workspace` filter so it only appears in the sidebar when
the correct workspace is active. This is not yet implemented; see `TODO.md`.

---

## AppLayout convention

The application shell (side nav + content area) is hardcoded in the engine. Every route is a child of it. Admins who need full shell replacement should treat this as a theme-level fork.

---

## Open issues

See [`TODO.md`](../TODO.md).
