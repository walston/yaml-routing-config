# RFC: Plugin-Driven Routing for NeMo Studio

## 1. Background

- Current routing lives in `web/packages/studio/src/routes/index.tsx` (~780 lines)
- Route paths defined in `constants/routes.ts`, nav items in `WorkspaceSideNav.tsx`, path builder helpers in `routes/utils.ts`
- These three files must be kept in sync manually for every route addition

## 2. Problem Statement

- Adding a route today touches at minimum three files across two directories
- No extension point — admins hosting the platform cannot add routes without forking platform source
- Nav and routing are decoupled by convention, not by contract; they drift
- Path builder helpers (`getWorkspaceDashboardRoute` etc.) are handwritten for every route — no enforcement that they match the actual path constant
- Feature flag gating is manual and scattered across the route tree
- NeMo Studio is open source; there is no mechanism for the community to build and share route-level plugins

## 3. Stakeholder Model

- **NVIDIA** — ships the platform; owns default routes, the engine, and universal path params
- **Admins** — companies hosting the platform for their org; author plugins, write TypeScript
- **Users** (VPs, Execs, Agent Developers) — consume the running app; no authoring capability

## 4. Proposal

### 4.1 Two-file manifest model

All routing and navigation is declared in two YAML files at the repo root:

- **`studio.platform.yaml`** — NVIDIA-authored, ships with the platform. Declares default routes, nav, and path variables.
- **`studio.override.yaml`** — Admin-authored, never overwritten by platform upgrades. Extends and overrides the platform manifest.

Adding a plugin route is adding an entry to `studio.override.yaml` and dropping a component file. No platform source is touched.

### 4.2 Route table

Routes are pure routing declarations — path, component, and optional gate or disabled flag. Nav metadata lives separately.

```yaml
routes:
  - path: /models/:modelId
    component: routes/ModelDetail/index.tsx
    gate: BASE_MODELS_ENABLED   # omit route when flag is false
  - path: /evaluations
    disabled: true              # 404, dropped from nav
```

Route hierarchy is inferred from path prefixes — no explicit parent/child declarations.

### 4.3 Nav as a separate section

Navigation is declared independently of the route table. Three slots: `top:` (ungrouped, above groups), `groups:` (labeled sections), `bottom:` (pinned).

```yaml
nav:
  top:
    - path: /dashboard
      title: Dashboard
      icon: LayoutDashboard
      order: 50
  groups:
    - id: models
      title: Models
      order: 10
      items:
        - path: /models
          title: Models
          icon: Cpu
          order: 10
  bottom:
    - path: /settings
      title: Settings
      icon: Settings
      order: 50
```

### 4.4 Group injection

A group in `studio.override.yaml` with the same `id` as a platform group has its items merged in and sorted by `order`. A new `id` creates an independent section. This lets admins extend an existing NVIDIA-beta group without replacing it.

### 4.5 Ordering

Both groups and items carry an optional `order`. Defaults are assigned at merge time from list position: platform base `0`, admin base `100`. Platform anchors items at `50` to leave room before and after for admin entries.

### 4.6 Route removal and nav hiding

Two independent mechanisms — nav and routing are separate concerns:

- `disabled: true` on a route entry — removes the route (404) and drops its nav item
- `nav.hide: ['/path']` — removes the item from the sidebar only; the route still loads

Neither is access control. Auth gates are a separate layer.

### 4.7 Path variables and dev-mode warnings

`path_variables` in the manifest documents known URL parameter names. The engine runs two checks at startup in development only (tree-shaken from production builds):

- **Undefined variable** — a route uses `:param` not declared in `path_variables`
- **Shadowing** — two routes use different param names at the same URL position (e.g. `:modelId` and `:modelName` both under `/models`)

### 4.8 `AppLayout` as engine convention

The outermost shell is hardcoded in the engine. Every route is a child of it. Admins who need full shell replacement treat this as a theme-level fork.

### 4.9 Code splitting

Route components are discovered via `import.meta.glob` and lazy-loaded. Each component produces a separate JS chunk. The main bundle never includes route code.

## 5. What Goes Away

- `routes/index.tsx` central manifest
- `constants/routes.ts` path constants
- `routes/utils.ts` handwritten path builders
- `WorkspaceSideNav.tsx` hardcoded nav items
- Manual `gateRoutes()` calls — replaced by `gate:` on route entries

## 6. Gotchas

- **`import.meta.glob` patterns are static strings** — glob directories are fixed by convention; cannot be driven from config at runtime
- **`<Outlet>` is not required for URL hierarchy** — only needed when a parent component renders a child route inline (e.g. list + detail panel). Simple path nesting does not require it.
- **Nav hiding is not access control** — `nav.hide` and `disabled: true` suppress UI only. A user who knows the URL can still navigate there. Auth gates are a separate concern.
- **Route override is silent** — an admin entry with the same path as a platform route wins without any acknowledgement. Dev-mode warnings partially address this.
- **Split-view routes** (e.g. Filesets list + panel) are not covered by path-prefix inference alone — the parent component must explicitly render `<Outlet />`. Migration path for these routes needs a separate decision.

## 7. Open Questions

- Migration strategy for existing routes — big bang vs. incremental per feature area
- Split-view / master-detail pattern under the new model
- Whether plugins distributed as npm packages could contribute to the glob — requires a mechanism beyond the current directory convention
- **Multi-manifest ordering** — currently two hardcoded files (`studio.platform.yaml`, `studio.override.yaml`). Supporting additional manifests (e.g. `studio.oracle.yaml`) requires an ordering convention. Three options evaluated: numeric filename prefix, pure alphabetical (fragile), or `extends:` field. Deferred until a concrete third-party manifest use case is confirmed.
- **YAML vs register.ts** — a parallel POC (`~/Repos/routing-registration`) explores a TypeScript-first approach where each route self-registers via `createRoute()` / `createSidenavItem()`. See [`docs/` in that repo](../../routing-registration) for trade-off comparison. The YAML approach offers an explicit auditable manifest and upgrade-safe override story; the register.ts approach offers better DX for authors and typed path building. Recommendation pending RFC review.

## 8. Proposal Gap Analysis

Gaps identified against the NeMo Platform UI Extensibility Proposal (Rob Rhyne, Jun 2026)
and their disposition:

- **Workspace-scoped route overrides** — covered. React Router's static-over-dynamic
  path scoring handles this natively. Nav visibility per workspace is a tracked open
  issue (see `TODO.md`).

- **Component slot overrides** — out of scope for this POC. Platform owns components
  with defined slots; slot extensibility is a separate, Platform-side concern.

- **External package plugins (`NEMO_STUDIO_PLUGINS_ENTRY`)** — explicitly deferred.
  Local `src/plugins/` is sufficient for the use cases being addressed. External
  package bundling via Vite entry points is a deployment concern, not a routing concern.

- **Error / failure isolation** — trivially addressable. React Router's `errorElement`
  on each route already provides boundary-level isolation. Wrapping every plugin
  component in a route-level error boundary is a one-line addition per route and
  is not architecturally novel.

- **Non-sidebar navigation extensibility** (tab bars, action areas, dropdowns) —
  out of scope. These extension points are subordinate to the route and owned by
  the Platform components that render them. Not the responsibility of the routing
  layer.

- **Backend / query plugins** — outside frontend scope. The goal is to *enable*
  backend plugins to have supporting frontend plugins, not to auto-generate them.
  The routing system provides the surface; backend plugin authors wire their own
  frontend accordingly.

- **Rob's existing prototype** — to be evaluated separately.
