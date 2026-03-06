---
name: prototype
description: Single-agent prototype generator. Reads BA specification files and generates a fully interactive single-file HTML prototype.
trigger:
  - prototype-request.json
  - prototype-iteration.json
output: prototype/index.html
strategy: single-agent
technology: HTML + Tailwind CSS (CDN) + Alpine.js v3 (CDN) + Alpine Focus Plugin (CDN) + Lucide Icons (CDN)
---

# Prototype Generator

## What To Build

A single `prototype/index.html` file that is:
- **Interactive** — navigation, modals, form validation, toasts, data tables with sort/filter/pagination
- **Responsive** — adapts to primary_device from nfr.json; sidebar collapses on mobile
- **Role-switchable** — dropdown to switch between all roles; sections show/hide per role_visibility
- **Domain-realistic** — mock data derived from BA files (entity names, field values, locale formatting)
- **Accessible** — ARIA landmarks, focus trapping in modals, keyboard navigation, contrast compliance

---

## Step 1: Ingest BA Files

Read ALL source files from the trigger's `sources{}`. Form a complete mental model BEFORE writing any code.

**Read in this order** (domain context first, then constraints, then visual, then behavior):

### 1.1 problem.json (`.ba/discovery/problem.json`)
- Extract: `statement`, `current_process.steps[].description`
- Derive: Domain vocabulary — entity names, action verbs, business terminology
- Derive: App name from problem context
- IF not found → RECOVERABLE: use project name from trigger

### 1.2 roles.json (`.ba/requirements/roles.json`)
- Extract: `roles[].id`, `roles[].name`, `hierarchy.chain[]`
- Build: Role list for role switcher, ordered by hierarchy (least→most privileged)
- Note: First role in hierarchy is the default active role

### 1.3 features.json (`.ba/requirements/features.json`)
- Extract: `must_have[]`, `should_have[]` (ignore `could_have`/`wont_have` for prototype)
- Per must_have feature: `title`, `fields[]`, `fields[].required`, `fields[].options[]`, `business_rules[]`, `acceptance_criteria[]`, `screen_refs[]`, `roles_allowed[]`
- Note: `should_have` features may omit `fields` and `business_rules` (they are optional)
  - IF should_have lacks `fields[]` → skip form field generation for that feature
  - IF should_have lacks `business_rules[]` → skip validation rule derivation
  - Always use `acceptance_criteria[]` and `screen_refs[]` if present
- Build: Required field list → form validation rules (@blur checks)
- Build: Dropdown options → `<select>` option lists
- Build: Feature-to-screen map from `screen_refs[]`

### 1.4 nfr.json (`.ba/requirements/nfr.json`)
- Extract: `usability.primary_device`, `usability.accessibility`, `security.authentication`
- Derive: `primary_device` → responsive emphasis (mobile-first vs desktop-first)
- Derive: `authentication` → include/exclude login screen elements
- IF not found → RECOVERABLE: default desktop, WCAG AA, auth=true

### 1.5 layout.json (`.ba/design/layout.json`)
- FIRST: Check if `interfaces` key exists (multi-interface layout)
- IF `interfaces` exists (multi-interface):
  - Extract: Each `interfaces.{key}` with `name`, `type`, `target_roles[]`, `navigation`, `sidebar` (if applicable)
  - Build: Role-to-interface mapping from `target_roles[]`
  - Each interface is a separate layout shell in the prototype
- ELSE (single-interface):
  - Extract: `type` (sidebar|topnav|hybrid|minimal)
- Extract (per interface or single): `navigation.primary[]`, `navigation.secondary[]` — each with `label`, `icon`, `screen_ref`, `roles[]`
- Extract: `sidebar` config (position, width, behavior, mobile_behavior)
- Extract: `responsive.mobile_navigation` (bottom-tabs|hamburger|drawer)
- Extract: `responsive.breakpoints`, `content.max_width`, `content.padding`

### 1.6 style.json (`.ba/design/style.json`)
- Extract ALL 7 categories: feel, colors (12), typography, spacing, borders, shadows, components
- Build: Tailwind config block (Step 3.A)
- Build: Token mapping (15 tokens → style.json values)
- Note `components.buttons` (filled|outlined|text|mixed) and `components.corners` (sharp|slightly-rounded|rounded|pill) for pattern selection

### 1.7 screens.json (`.ba/design/screens.json`)
- Extract: `screens[].id`, `name`, `purpose`, `priority`, `feature_refs[]`, `role_access[]`
- Per screen, per section: `name`, `position`, `description`, `components[]`, `role_visibility[]`
- Build: Screen rendering order (Step 2.B)
- Build: Section visibility map (section → which roles see it)
- RULE: If `role_visibility` is omitted → section visible to ALL roles in `role_access`
- RULE: If `role_visibility` specified → section visible ONLY to those roles

### 1.8 components.json (`.ba/design/components.json`)
- Extract: `components[].id`, `name`, `purpose`, `used_in[]`, `states[]`, `variants[]`, `behavior`
- Build: State rendering map — for each component with states[], generate x-show conditions
- Build: Variant color map — for each variant, map `color` to style.json semantic colors
- Example: status-badge with variant `{value: "approved", color: "success"}` → `bg-success/10 text-success`

### 1.9 flows.json (`.ba/design/flows.json`)
- Extract: `flows[].steps[]` with `screen_ref`, `action`, `result`, `actor_switch`
- Build: Navigation wiring — which @click leads to which screen
- Build: Actor switch points — steps where role changes (for multi-role demo flows)
- Build: Form submit targets — which forms navigate where on success

### 1.10 manifest.json (`.ba/design/manifest.json`) — OPTIONAL
- Extract: `assets[]` — array of `{id, filename, type, path, description, used_in}`
- Extract: `brand_materials` — `{app_name, tagline, icon_style, logo_rationale}` (optional)
- Extract: `design_references[]` — reference apps and inspiration (optional)
- Use logo asset (`type: "logo"`) in sidebar/header branding if provided
- Use `brand_materials.app_name` for app title; `brand_materials.tagline` for subtitle
- Use `brand_materials.icon_style` to choose icon rendering (outline vs filled)
- IF not found → skip, use text-only branding derived from problem.json

---

## Step 2: Plan

Before generating any HTML, derive these from the ingested data:

### A. Layout Mode Detection
```
FIRST: Check for multi-interface layout
IF layout.interfaces exists:
  FOR EACH interface_key in layout.interfaces:
    Extract: name, type, target_roles[], navigation, sidebar config
    Generate a SEPARATE layout shell for each interface
    Wrap each shell in: x-show="currentInterface === '{interface_key}'"
  Screen `interface` field determines which shell it renders inside
  Role switching changes currentInterface automatically via role→interface map
  IMPORTANT: Each interface has its OWN navigation items from its own navigation{}

ELSE (single-interface layout):
  IF layout.type == "sidebar"  → use sidebar-layout-shell + sidebar-navigation
  IF layout.type == "topnav"   → use topnav-layout-shell + topnav-navigation
  IF layout.type == "hybrid"   → sidebar-navigation + topnav header bar
  IF layout.type == "minimal"  → topnav-layout-shell (simplified, no persistent nav)

Mobile adaptation (applies per interface in multi-interface mode):
  IF mobile_navigation == "bottom-tabs" → add mobile-bottom-tabs at viewport < 640px
  IF mobile_navigation == "hamburger"   → sidebar collapses to hamburger menu
  IF mobile_navigation == "drawer"      → sidebar becomes slide-in drawer
```

### B. Screen Rendering Order
```
Single-interface:
  1. Screens referenced in navigation.primary[] (in nav order)
  2. Screens referenced in navigation.secondary[] (in nav order)
  3. Unreferenced screens (by screens[] array order)
  Each screen: <div id="{screen.id}" x-show="currentScreen === '{screen.id}'" x-transition x-cloak>

Multi-interface:
  Group screens by their `interface` field, then apply the same ordering per interface.
  Each screen: <div id="{screen.id}" x-show="currentScreen === '{screen.id}'" x-transition x-cloak>
  Navigation only links to screens within the active interface, so no extra x-show guard needed.
```

### C. Data Strategy (Domain-Derived, Never Hardcoded)
```
FROM problem.json: domain vocabulary → entity names, action verbs
FROM features.json: field names → table columns, form labels
FROM features.json: fields[].options[] → dropdown values, badge labels, filter options
FROM roles.json: role names → demo user names per role
FROM nfr.json + problem.json: derive locale context → currency format, date format

Generate per data table/list:
  - 8-12 mock records with realistic variety
  - Mix of statuses from fields[].options[]
  - Names appropriate to locale context
  - Dates spread across recent timeline (last 30 days)
  - At least 1 edge case (long name, zero value, empty optional field)
```

### D. Interaction Map
```
FROM flows.json steps:
  Map step.action → @click="navigateTo('{step.screen_ref}')"
  Map step with actor_switch → comment: "// Actor: {role}" for role-aware demo
  Map form submit steps → @submit.prevent="handleSubmit(); navigateTo('{next_screen}')"

FROM components.json states:
  Map component states → x-show conditions in appState
  Example: clock-in-button states → toggleable via appState.clockedIn boolean

FROM features.json business_rules:
  Map validation rules → @blur handlers on form fields
```

---

## Step 3: Configure

### A. Tailwind Config (from style.json)

Generate inline `<script>` block that extends Tailwind with exact style.json values:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary:   '{colors.primary}',
        secondary: '{colors.secondary}',
        accent:    '{colors.accent}',
        surface:   '{colors.surface}',
        border:    '{colors.border}',
        error:     '{colors.error}',
        warning:   '{colors.warning}',
        success:   '{colors.success}',
        info:      '{colors.info}',
      },
      fontFamily: {
        sans: ['{typography.font_family}'],
      },
      borderRadius: {
        sm:  '{borders.radius_sm}',
        DEFAULT: '{borders.radius}',
        lg:  '{borders.radius_lg}',
        full: '{borders.radius_full}',
      },
      boxShadow: {
        sm: '{shadows.sm}',
        DEFAULT: '{shadows.md}',
        lg: '{shadows.lg}',
      }
    }
  }
}
```

Use `colors.background` for page bg, `colors.surface` for cards, `colors.text_primary` and `colors.text_secondary` for text via Tailwind arbitrary values or custom classes.

### B. Alpine appState Template

```javascript
function appState() {
  return {
    // Navigation
    currentScreen: '{first navigation.primary screen_ref}',
    screenHistory: [],
    sidebarCollapsed: false,
    mobileMenuOpen: false,

    // Multi-interface (only if layout.interfaces exists, otherwise omit)
    // currentInterface: '{first interface key matching first role}',
    // interfaceMap: { '{role-id}': '{interface-key}', ... },

    // Roles (from roles.json)
    currentRole: '{first role id}',
    roles: [ /* {id, name} for each role */ ],

    // Toast System
    toasts: [],
    toastId: 0,
    addToast(type, message) {
      const id = ++this.toastId;
      this.toasts.push({ id, type, message, visible: true });
      setTimeout(() => this.removeToast(id), 4000);
    },
    removeToast(id) {
      const t = this.toasts.find(t => t.id === id);
      if (t) t.visible = false;
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, 300);
    },

    // Modal System
    activeModal: null,
    modalData: {},
    openModal(name, data = {}) { this.activeModal = name; this.modalData = data; },
    closeModal() { this.activeModal = null; this.modalData = {}; },

    // Confirmation Dialog
    confirmOpen: false,
    confirmMessage: '',
    confirmAction: null,
    confirm(message, action) {
      this.confirmMessage = message;
      this.confirmAction = action;
      this.confirmOpen = true;
    },

    // Navigation helpers
    navigateTo(screen) {
      this.screenHistory.push(this.currentScreen);
      this.currentScreen = screen;
      this.mobileMenuOpen = false;
      window.scrollTo(0, 0);
    },
    goBack() {
      if (this.screenHistory.length) this.currentScreen = this.screenHistory.pop();
    },
    switchRole(role) {
      this.currentRole = role;
      // Multi-interface: switch interface based on role→interface map
      if (this.interfaceMap && this.interfaceMap[role]) {
        this.currentInterface = this.interfaceMap[role];
      }
      // Navigate to first screen accessible by this role
      const firstScreen = this.getFirstScreenForRole(role);
      if (firstScreen) this.navigateTo(firstScreen);
    },
    getFirstScreenForRole(role) {
      // navItems: built from layout.json navigation.primary[]
      // Each item: { screen_ref, roles (optional array) }
      const navItems = this._navItems || [];
      const match = navItems.find(item => !item.roles || item.roles.includes(role));
      return match ? match.screen_ref : this.currentScreen;
    },
    // _navItems: populated from layout.json navigation.primary[]
    // Example: [{ screen_ref: 'S-001', roles: null }, { screen_ref: 'S-005', roles: ['manager','hr-admin'] }]
    _navItems: [ /* generated from layout.json */ ],

    // Mock Data arrays (generated per domain)
    // ... populated from features.json entities

    // Formatting helpers
    formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString('{locale}', { year: 'numeric', month: 'short', day: 'numeric' });
    },
    formatCurrency(amount) {
      return new Intl.NumberFormat('{locale}', { style: 'currency', currency: '{currency}' }).format(amount);
    },
  }
}
```

### C. CDN Order (CRITICAL — exact order required)

```html
<!-- 1. Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>
<!-- 2. Tailwind Config (inline) -->
<script>tailwind.config = { ... }</script>
<!-- 3. Google Fonts (if typography.font_family needs it) -->
<link href="https://fonts.googleapis.com/css2?family={font}&display=swap" rel="stylesheet">
<!-- 4. Alpine.js Focus Plugin (BEFORE Alpine core) -->
<script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/focus@3/dist/cdn.min.js"></script>
<!-- 5. Alpine.js (defer) -->
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
<!-- 6. Lucide Icons (pin to specific version, never use @latest) -->
<script src="https://unpkg.com/lucide@0.460.0"></script>
```

---

## Step 4: Generate (Incremental Writing)

Write `prototype/index.html` in 7 sequential chunks. NEVER write the entire file at once.

### Chunk 1: Foundation (~30 lines)
```
WRITE prototype/index.html:
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{App Name} — Prototype</title>
    CDN links (Step 3.C order)
    <style>
      [x-cloak] { display: none !important; }
      html { scroll-behavior: smooth; }
      /* Custom scrollbar, transition utilities */
    </style>
  </head>
```

### Chunk 2: App State (~80-120 lines)
```
APPEND:
  <script>
    function appState() { ... }  // Full template from Step 3.B, filled with derived data
  </script>

  <body x-data="appState()" class="min-h-screen" style="background-color: {colors.background}">
    CRITICAL: x-data on body, NO x-cloak on body

    <!-- Toast Container (z-[55]: above sidebar z-30 but below modals z-50 backdrop) -->
    <!-- Note: Toasts triggered from modals will queue and show after modal closes -->
    <div class="fixed top-4 right-4 z-[55] space-y-2 pointer-events-none">
      <template x-for="toast in toasts" :key="toast.id">
        <div x-show="toast.visible" x-transition class="pointer-events-auto"
             :class="{ 'bg-green-50 border-green-200': toast.type==='success',
                       'bg-red-50 border-red-200': toast.type==='error',
                       'bg-yellow-50 border-yellow-200': toast.type==='warning',
                       'bg-blue-50 border-blue-200': toast.type==='info' }"
             class="flex items-start gap-3 p-4 border rounded-lg shadow-lg w-80" role="alert">
          <!-- icon + message + close button -->
        </div>
      </template>
    </div>
```

### Chunk 3: Layout Shell (~60-100 lines)
```
APPEND:
  Multi-interface: Generate one layout shell PER interface, each wrapped in:
    <div x-show="currentInterface === '{interface_key}'" x-cloak>
      ... layout shell for this interface ...
    </div>

  Single-interface: Generate one layout shell (no x-show wrapper needed).

  PER layout shell (sidebar or topnav), based on the interface's type:

  IF sidebar layout:
    <aside> with sidebar-navigation pattern
      - Nav items from navigation.primary[], each with:
        @click="navigateTo('{screen_ref}')"
        x-show="['{role1}','{role2}'].includes(currentRole)" (if roles[] specified)
        :class for active state (currentScreen === screen_ref)
      - Secondary nav items from navigation.secondary[]
      - Role switcher (use role-switcher pattern from navigation.html)
    </aside>
    <div class="lg:hidden"> mobile hamburger bar </div>
    <main class="lg:ml-64 min-h-screen">

  IF topnav layout:
    <header> with topnav-navigation pattern
      - Same nav item logic
      - Role switcher in header right section
      - Notification bell if applicable (use notification-bell pattern)
    </header>
    <main class="pt-16">
```

### Chunks 4-6: Screens (dynamic batching)
```
Screen batch allocation:
  ≤ 5 screens:   Chunk 4 only (all screens in one batch)
  6-15 screens:   Chunks 4-5 (split roughly evenly)
  16+ screens:    Chunks 4-6 (split into ~5-7 per chunk)
  Adjust progress percentages proportionally.

FOR EACH screen in rendering order (Step 2.B):
  APPEND:
    <!-- Screen: {screen.name} ({screen.id}) -->
    <div id="{screen.id}"
         x-show="currentScreen === '{screen.id}'"
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-cloak
         class="p-4 sm:p-6 lg:p-8">

      <!-- Page header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold" style="color: {colors.text_primary}">{screen.name}</h1>
        <p class="mt-1 text-sm" style="color: {colors.text_secondary}">{screen.purpose}</p>
      </div>

      FOR EACH section in screen.sections (ordered by position):

        IF section.role_visibility exists AND is not empty:
          <div x-show="['{role1}','{role2}'].includes(currentRole)">
        ELSE:
          <div>  <!-- visible to all roles in role_access -->

        <!-- Section: {section.name} -->
        RENDER section content based on section.components[]:

        FOR EACH component_ref in section.components:
          LOOKUP component in components.json
          SELECT appropriate pattern from pattern library
          GENERATE with:
            - Mock data from Step 2.C
            - Component states from components[].states[]
              → x-show for each state condition
            - Component variants from components[].variants[]
              → :class binding for color variants
            - Interaction handlers from Step 2.D
              → @click, @submit, @blur from flows + features
            - Form fields from features.json fields[]
              → x-model, @blur validate, inline error messages
              → IF field.required → show "*" in label, validate on blur
              → IF field.options[] → render as <select> with options
            - Data tables: add search filter, column sort headers, pagination (10/page)
            - Lists: add empty state check (x-show="items.length === 0")

        </div>  <!-- close section wrapper -->

    </div>  <!-- close screen wrapper -->

  After every ~5 screens: READ back and VERIFY no unclosed tags
```

### Chunk 7: Closing (~30 lines)
```
APPEND:
  <!-- Shared Confirmation Dialog -->
  (confirmation-dialog pattern from feedback.html)
  Wired to appState.confirmOpen, confirmMessage, confirmAction

  </main>  <!-- close main content area -->

  <!-- Lucide Icons Init -->
  <script>
    document.addEventListener('DOMContentLoaded', () => { lucide.createIcons(); });
  </script>

  </body>
  </html>
```

---

## Step 5: Validate (15-Point Checklist)

READ `prototype/index.html` back in full. CHECK all 15 points. FIX any failures (max 2 iterations).

### Structure Checks
1. File starts with `<!DOCTYPE html>` and ends with `</html>`
2. CDN order: Tailwind CSS → Tailwind config → Alpine Focus (defer) → Alpine.js (defer) → Lucide
3. `x-data="appState()"` on `<body>`, NO `x-cloak` on `<body>`

### Completeness Checks
4. Every screen from screens.json has `<div id="{screen.id}" x-show="currentScreen === '{screen.id}'">`
5. Every must_have feature from features.json is represented in at least one screen's content
6. Every role from roles.json appears as an option in the role switcher
7. Every `navigation.primary[]` item has a nav link with `@click="navigateTo(...)"`

### Functionality Checks
8. Every `navigateTo('{id}')` call references a screen id that exists as a `<div id="{id}">`
9. Every function called in `@click` / `@submit` handlers exists in `appState()` (e.g., addToast, openModal, confirm)
10. Every `x-model` references a property initialized in `appState()` or local `x-data`
11. Modal/confirm state variables (`activeModal`, `confirmOpen`) are initialized in `appState()`

### Quality Checks
12. No unreplaced `{placeholder}` tokens remain (search for `/{[a-z]+-[a-z]+}/` pattern)
13. All HTML tags are properly closed (count `<div>` vs `</div>`, `<template>` vs `</template>`)
14. Toast container with `x-for="toast in toasts"` template exists
15. Role-restricted sections use `x-show="[...].includes(currentRole)"` with correct role arrays

**On failure:** Log "[FAIL] Check #{N}: {description}", fix the issue, re-validate (max 2 fix iterations).

---

## Step 6: Export

### Status Update
Write to path from trigger's `output.status_file`:
```json
{
  "operation": "prototype",
  "version": "1.0",
  "status": {
    "current": "completed",
    "started_at": "{ISO-8601}",
    "updated_at": "{ISO-8601}",
    "completed_at": "{ISO-8601}"
  },
  "progress": {
    "percentage": 100,
    "step": "Complete",
    "message": "Prototype generated successfully"
  },
  "output": {
    "path": "prototype/index.html",
    "screens_generated": ["{screen IDs}"],
    "features_covered": ["{feature IDs}"]
  },
  "error": null,
  "iteration": 1
}
```

### Trigger Cleanup
DELETE the processed trigger file from `.ba/triggers/`.

### Progress Milestones (update status at each)
| Step | Progress | Message |
|------|----------|---------|
| Start (Step 1) | 5% | Reading BA specification files |
| After Step 2 | 15% | Planning generation strategy |
| After Step 3 | 20% | Configuring design tokens |
| After Chunk 3 | 35% | Layout shell generated |
| After Chunk 4 | 55% | Generating screens (batch 1) |
| After Chunk 5 | 70% | Generating screens (batch 2) |
| After Chunk 6 | 85% | Generating screens (batch 3) |
| After Step 5 | 95% | Validating prototype |
| After Step 6 | 100% | Complete |

---

## Iteration Mode

When trigger is `prototype-iteration.json`:

```
1. READ iteration payload: changes_requested[], iteration number, keep_unchanged[]
2. BACKUP: copy prototype/index.html → prototype/index.v{N-1}.html
3. RE-READ all 10 BA files (they may have changed between iterations)
4. IDENTIFY affected screens/sections from changes_requested[].component
5. RE-GENERATE only affected sections using marker-based replacement:
   a. READ prototype/index.html in full
   b. For each affected screen, find: <!-- Screen: {name} ({id}) -->
   c. Find the matching closing: </div>  <!-- close screen wrapper -->
   d. Replace everything between these markers (inclusive) with new content
   e. WRITE the complete updated file back
   f. Technique: Use comment markers as anchors. Never attempt partial string replacement
      without reading the full file first.
6. VERIFY keep_unchanged[] items were NOT modified (diff before/after for those screen ids)
7. RE-RUN Step 5 validation (full 15-point checklist)
8. EXPORT status with iteration number incremented
9. DELETE iteration trigger file
```

---

## Pattern Reference

Read patterns at `.claude/skills/prototype/patterns/*.html` as **STYLE REFERENCE**.
Adapt structure, classes, and ARIA attributes to each screen's actual content.
Do NOT do mechanical copy-paste-replace of patterns.

| File | Patterns | Use For |
|------|----------|---------|
| navigation.html | sidebar-navigation, topnav-navigation, mobile-bottom-tabs, breadcrumbs, **tabs**, **role-switcher**, **notification-bell** | Layout shell, screen switching, tab navigation, role demo, alerts |
| data-display.html | data-table, **data-table-dynamic**, card-grid, list-view, stat-card, badge, avatar, empty-state, **tabs-panel**, **timeline** | Content display, metrics, event history |
| forms.html | text-input, select-dropdown, checkbox-group, radio-group, textarea, toggle-switch, search-input, form-section, form-wizard, **date-picker**, **file-upload**, **login-form** | Forms, filters, search, calendars, authentication |
| feedback.html | modal-dialog, toast-notification, inline-alert, loading-spinner, skeleton-loader, progress-bar, empty-state-message, **confirmation-dialog**, **tooltip** | Feedback, loading, modals, help text |
| actions.html | button-primary, button-group, dropdown-menu, fab, search-bar, filter-bar | Actions, menus, buttons |
| layout.html | page-container, responsive-grid, section-header, sidebar-layout-shell, topnav-layout-shell, card-container, spacing-utilities, **accordion** | Page structure, grids, cards |

---

## Token Mapping

These 15 tokens appear in pattern files. Replace with Tailwind classes derived from style.json.

| Token | Source (style.json) | Tailwind Mapping |
|-------|--------------------|--------------------|
| `{primary-color}` | `colors.primary` | Nearest Tailwind shade (500-600) or custom `primary` |
| `{primary-hover}` | `colors.primary` | One shade darker (600-700) or custom `primary-dark` |
| `{primary-light}` | `colors.primary` | Shade 50 or custom `primary-light` |
| `{secondary-color}` | `colors.secondary` | Custom `secondary` from config |
| `{accent-color}` | `colors.accent` | Custom `accent` from config |
| `{background-color}` | `colors.background` | Page background |
| `{surface-color}` | `colors.surface` | Card/panel backgrounds |
| `{text-primary}` | `colors.text_primary` | Main text color |
| `{text-secondary}` | `colors.text_secondary` | Muted text color |
| `{border-color}` | `colors.border` | Lines, dividers |
| `{font-family}` | `typography.font_family` | Font stack in Tailwind config |
| `{border-radius}` | `borders.radius` | `rounded-md` / `rounded-lg` / `rounded-xl` |
| `{shadow}` | `shadows.md` | `shadow` or `shadow-md` |
| `{shadow-sm}` | `shadows.sm` | `shadow-sm` |
| `{shadow-lg}` | `shadows.lg` | `shadow-lg` |

---

## Critical Rules

1. **NO x-cloak on `<body>`** — causes permanent white screen if Alpine CDN is slow
2. **ONE x-data="appState()" on `<body>`** — single global state; local x-data OK for small widgets
3. **NO unreplaced `{placeholder}` tokens** in final output
4. **ALL screens** need `x-show="currentScreen === '{id}'"` + `x-transition` + `x-cloak`
5. **Read ALL 10 BA files** BEFORE generating any HTML
6. **Use forward slashes** in all file paths (never backslashes)
7. **Write incrementally** in 7 chunks — NEVER the entire file at once
8. **Self-verify** after writing — read back and check structure
9. **Mock data must be domain-realistic** — derive from problem.json and features.json, never use lorem ipsum
10. **Every list/table must have an empty state** — show "No {items} found" with CTA when data is empty or filtered to zero results
11. **Use inline SVGs, never `<i data-lucide>` tags** — Lucide's tag-based rendering fails with Alpine x-show/x-cloak on initially hidden elements. Copy SVG markup from patterns and use Lucide icon names from navigation[].icon only for icon selection. The `lucide.createIcons()` call in Chunk 7 is a fallback for any data-lucide tags that slip through, not the primary rendering method.
12. **Toast z-index below modals** — Toast container uses `z-[55]` (above sidebar z-30, below modal z-50 backdrop). If a modal action triggers a toast, queue the toast via addToast() AFTER closeModal() so it appears when the modal is dismissed.
