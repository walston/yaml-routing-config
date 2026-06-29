// ── Manifest types (YAML shape) ───────────────────────────────────────────────

export type RouteEntry = {
  path: string;
  component: string;
  gate?: string;       // feature flag name — route omitted when flag is false
  disabled?: boolean;  // disables route (404) and drops its nav item
};

export type NavItemDeclaration = {
  path: string;
  title: string;
  icon: string;
  order?: number;   // optional — defaults assigned at merge time by list position
};

export type NavGroupDeclaration = {
  id: string;
  title: string;
  order?: number;          // optional — defaults assigned at merge time by list position
  items: NavItemDeclaration[];
};

export type NavManifest = {
  top?: NavItemDeclaration[];
  groups?: NavGroupDeclaration[];
  bottom?: NavItemDeclaration[];
  hide?: string[];     // paths to remove from the nav only — route still accessible
};

export type StudioManifest = {
  version?: number;
  flags?: Record<string, boolean>;
  path_variables?: Record<string, string>;
  routes?: RouteEntry[];
  nav?: NavManifest;
};

// ── Runtime types (passed to components) ──────────────────────────────────────

export type NavItem = {
  path: string;
  title: string;
  icon: string;
  group?: string;        // group id — undefined for ungrouped top-level items
  section?: 'bottom';
};

export type NavGroup = {
  id: string;
  title: string;
};

// Named type for nav data returned by buildApp
export type AppConfig = {
  navItems: NavItem[];
  groups: NavGroup[];
};
