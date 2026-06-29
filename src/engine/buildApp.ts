import { parse } from 'yaml';
import { createElement, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import type {
  NavGroup,
  NavGroupDeclaration,
  NavItem,
  NavItemDeclaration,
  RouteEntry,
  StudioManifest,
} from './types';
import { AppLayout } from '../components/AppLayout';

import platformYaml from '../../studio.platform.yaml?raw';
import adminYaml    from '../../studio.override.yaml?raw';

// Pre-discover all possible components at build time.
// Vite resolves these statically; the YAML selects from this set at runtime.
const components = import.meta.glob<{ default: ComponentType }>([
  '../routes/*/index.tsx',
  '../plugins/*/index.tsx',
]);

const toGlobKey = (componentPath: string) => `../${componentPath}`;

// Internal types for order-assigned nav entries
type OrderedItem  = NavItemDeclaration  & { order: number };
type OrderedGroup = NavGroupDeclaration & { order: number; items: OrderedItem[] };

// ── Manifest merge ─────────────────────────────────────────────────────────────

function mergeManifests(platform: StudioManifest, admin: StudioManifest): StudioManifest {
  // Routes: de-dupe by path — admin entry wins on conflict
  const routeMap = new Map<string, RouteEntry>();
  for (const r of platform.routes ?? []) routeMap.set(r.path, r);
  for (const r of admin.routes ?? []) routeMap.set(r.path, r);  // overwrites

  // Order convention: platform base=0, admin base=100.
  // Explicit order overrides; implicit = list-position × 10 from base.
  // Admin uses order < 100 to position relative to platform entries.
  const withItemOrder = (is: NavItemDeclaration[], base: number) =>
    is.map((item, i) => ({ ...item, order: item.order ?? base + i * 10 }));

  const withGroupOrder = (gs: NavGroupDeclaration[], base: number) =>
    gs.map((g, gi) => ({
      ...g,
      order: g.order ?? base + gi * 10,
      items: withItemOrder(g.items, base).sort((a, b) => a.order - b.order),
    }));

  // Groups: same id = extend (items merged + sorted); different id = independent section.
  // This lets admins inject items into a platform group (e.g. NVIDIA's beta Experiments group)
  // by declaring the same id in studio.yaml with their additional items.
  const mergeGroups = (platformGs: OrderedGroup[], adminGs: OrderedGroup[]): OrderedGroup[] => {
    const map = new Map(platformGs.map(g => [g.id, { ...g, items: [...g.items] }]));
    for (const g of adminGs) {
      const existing = map.get(g.id);
      if (existing) {
        existing.items = [...existing.items, ...g.items].sort((a, b) => a.order - b.order);
      } else {
        map.set(g.id, g);
      }
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  };

  const nav = {
    top: [
      ...withItemOrder(platform.nav?.top ?? [], 0),
      ...withItemOrder(admin.nav?.top ?? [], 100),
    ].sort((a, b) => a.order - b.order),
    groups: mergeGroups(
      withGroupOrder(platform.nav?.groups ?? [], 0),
      withGroupOrder(admin.nav?.groups ?? [], 100),
    ),
    bottom: [
      ...withItemOrder(platform.nav?.bottom ?? [], 0),
      ...withItemOrder(admin.nav?.bottom ?? [], 100),
    ].sort((a, b) => a.order - b.order),
  };

  return {
    flags: { ...(platform.flags ?? {}), ...(admin.flags ?? {}) },
    routes: [...routeMap.values()],
    nav,
  };
}

// ── Route tree ─────────────────────────────────────────────────────────────────

function isAncestor(ancestorPath: string, descendantPath: string): boolean {
  const a = ancestorPath.split('/').filter(Boolean);
  const d = descendantPath.split('/').filter(Boolean);
  return d.length > a.length && a.every((seg, i) => d[i] === seg);
}

function closestAncestor(path: string, allPaths: string[]): string | undefined {
  return allPaths
    .filter(p => isAncestor(p, path))
    .sort((a, b) => b.split('/').length - a.split('/').length)[0];
}

function buildRouteTree(entries: RouteEntry[], flags: Record<string, boolean>): RouteObject[] {
  const active = entries.filter(e => !e.disabled && (!e.gate || flags[e.gate] !== false));

  const paths = active.map(e => e.path);
  const objects = new Map<string, RouteObject>();

  const sorted = [...active].sort(
    (a, b) => a.path.split('/').length - b.path.split('/').length
  );

  for (const entry of sorted) {
    const loader = components[toGlobKey(entry.component)];
    // ponytail: cast — all route components accept no props in this POC
    const element = loader
      ? createElement(
          Suspense, { fallback: null },
          createElement(lazy(loader as () => Promise<{ default: ComponentType<Record<string, never>> }>), {})
        )
      : undefined;
    objects.set(entry.path, { path: entry.path, element });
  }

  for (const entry of sorted) {
    const parentPath = closestAncestor(entry.path, paths);
    if (parentPath) {
      const parent = objects.get(parentPath)!;
      parent.children = [...(parent.children ?? []), objects.get(entry.path)!];
    }
  }

  return sorted
    .filter(e => !closestAncestor(e.path, paths))
    .map(e => objects.get(e.path)!);
}

// ── Nav assembly ───────────────────────────────────────────────────────────────

function toNavItem(decl: NavItemDeclaration, group?: string, section?: 'bottom'): NavItem {
  return { path: decl.path, title: decl.title, icon: decl.icon, group, section };
}

function buildNav(manifest: StudioManifest): { navItems: NavItem[]; groups: NavGroup[] } {
  const { top = [], groups = [], bottom = [], hide = [] } = manifest.nav ?? {};

  // Paths disabled at the route level are also dropped from nav
  const disabledPaths = new Set([
    ...hide,
    ...(manifest.routes ?? []).filter(r => r.disabled).map(r => r.path),
  ]);

  const all: NavItem[] = [
    ...top.map(i => toNavItem(i)),
    ...groups.flatMap(g => g.items.map(i => toNavItem(i, g.id))),
    ...bottom.map(i => toNavItem(i, undefined, 'bottom')),
  ];

  const navItems = all.filter(i => !disabledPaths.has(i.path));
  const navGroups: NavGroup[] = groups.map(g => ({ id: g.id, title: g.title }));
  return { navItems, groups: navGroups };
}

// ── Dev-mode warnings ──────────────────────────────────────────────────────────

function warnPathVariables(manifest: StudioManifest): void {
  if (!import.meta.env.DEV) return;

  const active = (manifest.routes ?? []).filter(r => !r.disabled);
  const declared = new Set(Object.keys(manifest.path_variables ?? {}));
  const paths = active.map(r => r.path);

  // 1. Undefined path variables — used in a path but not declared
  for (const route of active) {
    for (const match of route.path.matchAll(/:([^/]+)/g)) {
      const name = match[1];
      if (!declared.has(name)) {
        console.warn(
          `[studio] Undefined path variable :${name} in "${route.path}"\n` +
          `  → add to path_variables in studio.platform.yaml or studio.override.yaml`
        );
      }
    }
  }

  // 2. Shadowed path variables — sibling routes that use different param names
  // at the same URL position (e.g. /models/:modelId and /models/:modelName/prompts)
  const warned = new Set<string>();
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const segsA = paths[i].split('/').filter(Boolean);
      const segsB = paths[j].split('/').filter(Boolean);
      const len = Math.min(segsA.length, segsB.length);
      for (let k = 0; k < len; k++) {
        if (segsA[k] === segsB[k]) continue;
        if (segsA[k].startsWith(':') && segsB[k].startsWith(':') && segsA[k] !== segsB[k]) {
          const key = [segsA[k], segsB[k]].sort().join('↔');
          if (!warned.has(key)) {
            warned.add(key);
            console.warn(
              `[studio] Path variable shadowing: "${segsA[k]}" in "${paths[i]}" and "${segsB[k]}" in "${paths[j]}" ` +
              `occupy the same URL position — use a consistent name`
            );
          }
        }
        break; // stop at first difference between the two paths
      }
    }
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

export function buildApp() {
  const platform = parse(platformYaml) as StudioManifest;
  const admin = parse(adminYaml) as StudioManifest;
  const merged = mergeManifests(platform, admin);
  warnPathVariables(merged);

  const { navItems, groups } = buildNav(merged);
  const flags = merged.flags ?? {};
  const defaultPath = navItems.find(i => i.section !== 'bottom')?.path ?? '/';

  return {
    router: createBrowserRouter([{
      element: createElement(AppLayout),
      children: [
        { index: true, element: createElement(Navigate, { to: defaultPath, replace: true }) },
        ...buildRouteTree(merged.routes ?? [], flags),
      ],
    }]),
    navItems,
    groups,
  };
}
