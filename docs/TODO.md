# Open Issues

## ~~1. Removal / hiding~~ ✓
Implemented: `disabled: true` on a route entry removes the route (404) and drops its nav item.
`nav.hide: ['/path']` removes from the sidebar only — route still accessible.
Both patterns are documented with commented examples in `studio.yaml`.

## 2. Conflict DX
When `studio.yaml` declares a route with the same path as `platform.studio.yaml`,
the admin entry wins silently. Need: dev-mode surface that makes the override visible
(console warning at minimum, ideally a UI indicator showing which file owns which route).

## 3. gate: on nav items
The `gate:` field exists on route entries but not on nav items. A route gated by a
feature flag still shows its nav item. Nav items should respect the same gate.

## 4. Workspace-scoped nav visibility
Route overrides scoped to a specific workspace (e.g. `/workspaces/oracle-db-agents/models`)
work via React Router's static-over-dynamic scoring. Nav items do not yet have a
`workspace:` filter — a workspace-specific route's nav item currently appears in
the sidebar for all workspaces. Need a `workspace` field on nav item declarations
that the SideNav checks against the current `useParams().workspaceId`.
