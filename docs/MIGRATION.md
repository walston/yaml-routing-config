# Studio Manifest Migration Guide

All studio manifest files (`studio.platform.yaml`, `studio.override.yaml`, and any
future imports) carry a `version:` field at the top. The engine validates this before
processing and throws with a reference to this file when the declared version does not
match the supported version.

**An agent can perform any migration listed here automatically.** Point it at this
file and the manifest that needs updating; it will translate the file to the target
version.

---

## Version 1 (current)

Introduced with the initial routing system. All existing manifest files should declare:

```yaml
version: 1
```

### Version 1 schema

```yaml
version: 1

flags:
  FLAG_NAME: true | false

path_variables:
  paramName: Human-readable description

routes:
  - path: /some/path
    component: routes/SomePage/index.tsx
    gate: FLAG_NAME          # optional — omit route when flag is false
    disabled: true           # optional — 404 + drop nav item

nav:
  top:
    - path: /some/path
      title: Label
      icon: LucideIconName   # PascalCase lucide-react icon name
      order: 50              # optional — lower appears first; platform anchors at 50

  groups:
    - id: group-id
      title: Group Label
      order: 10              # optional — controls position among all groups
      items:
        - path: /some/path
          title: Label
          icon: LucideIconName
          order: 10

  bottom:
    - path: /some/path
      title: Label
      icon: LucideIconName
      order: 50

  hide:
    - /path/to/hide          # nav only — route still accessible at URL
```

### Version 1 merge semantics

When `studio.platform.yaml` and `studio.override.yaml` are merged:

- **Routes**: de-duped by `path`; the admin (`studio.override.yaml`) entry wins on
  conflict. `disabled: true` in the admin file removes a platform route.
- **Nav groups**: groups with the same `id` have their `items` merged and sorted by
  `order`. Groups with new `id`s are appended.
- **Nav top / bottom**: entries from both files concatenated; sorted by `order`.
  Platform entries default to `base 0` (positions 0, 10, 20 …); admin entries default
  to `base 100` (100, 110 …). Explicit `order` overrides the default.
- **Flags**: admin values override platform values for the same key.
- **`nav.hide`**: union of both files' hide lists.

---

## Future versions

This section documents breaking changes introduced in each new version. Each entry
describes what changed from the previous version and the mechanical steps to migrate
a manifest file.

*No versions beyond 1 exist yet.*

### Migration template (for future maintainers)

When a breaking change is needed, add an entry here following this format:

```markdown
## Version N → Version N+1

**What changed:**
- <concise description of the breaking change and why>

**How to migrate `studio.override.yaml`:**

1. Change `version: N` to `version: N+1` at the top of the file.
2. <specific field rename / restructure / removal steps>
3. Run `npx tsc --noEmit` to confirm the YAML still parses against the new schema.

**Example — before (version N):**
\`\`\`yaml
version: N
# ... old field shape
\`\`\`

**Example — after (version N+1):**
\`\`\`yaml
version: N+1
# ... new field shape
\`\`\`

**Agent instructions:**
Given the above before/after examples and the steps listed, translate the provided
manifest file from version N to version N+1. Preserve all existing route, nav, and
flag entries. Do not change anything not listed in the migration steps.
```
