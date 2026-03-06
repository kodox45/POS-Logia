# Technical Proposal: POS Restoran UMKM Logia

**Generated:** 2026-03-04
**App Type:** Offline-First PWA
**Complexity:** Complex (19 entities, 74 endpoints, 4 interfaces)
**Team:** 5 sub-agents + 3 validation checkpoints (all passed)

## Executive Summary

A full-featured Point of Sale system for UMKM restaurants, designed to work **99% offline** using IndexedDB as the primary data store with PostgreSQL sync backup. The system supports 3 roles (Owner, Waiter-Cashier, Chef) across 4 specialized interfaces optimized for different devices and workflows.

**Key Architecture Decision:** All operations run locally via Dexie.js (IndexedDB wrapper). No JWT -- authentication uses bcrypt hash comparison stored on-device. The server exists only as a sync target for backup and multi-device data sharing.

**Coverage:** 18/18 features fully covered (12 must-have, 5 should-have, 1 could-have). Zero gaps. Zero blocking issues.

---

## 1. Data Model Overview

**19 entities** across 10 domain groups with 253 fields and 44 relationships.

```
User (E-001) ──1:N──> UserPermission (E-002) [junction]
MenuItem (E-003) ──N:1──> MenuCategory (E-004)
Recipe (E-005) ──1:N──> RecipeIngredient (E-006) [junction] ──N:1──> InventoryItem (E-009)
Recipe (E-005) ──1:N──> RecipeStep (E-007)
Order (E-011) ──1:N──> OrderItem (E-012)
Order (E-011) ──N:1──> Table (E-010)
Order (E-011) ──1:1──> Transaction (E-013)
Shift (E-014) ──1:N──> VoidRecord (E-015)
PosSettings (E-018) ──1:N──> EwalletProvider (E-019)
```

**6 state machines:** Table.status, Order.orderStatus, OrderItem.cookingStatus, Transaction.transactionStatus, Shift.shiftStatus, InventoryItem.stockStatus

**Key Decision:** Stock deduction at order submission with reversal on cancel/void (D-001). Prevents overselling while maintaining data integrity.

> See `entities.json` for full attribute list and relationship details.

---

## 2. API Design Overview

**74 endpoints** across 12 domain groups (split format):

| Domain | Endpoints | Key Operations |
|--------|-----------|----------------|
| auth | 4 | Login, logout, PIN verify, session |
| user-management | 6 | CRUD users, permission toggle |
| menu | 9 | CRUD items + categories |
| recipe | 5 | CRUD recipes with ingredients/steps |
| inventory | 10 | CRUD, restock, adjust, movements, low-stock alerts |
| order-management | 10 | CRUD orders, add items, status transitions, tables |
| kitchen | 5 | Queue, start-cooking, mark-ready, notifications |
| payment | 6 | Process, void, transaction history/detail/export |
| shift-management | 6 | Open/close, active shift, summary, history |
| reporting | 2 | Dashboard, sales summary |
| settings | 8 | POS settings, e-wallet providers, discounts |
| sync | 3 | Push, pull, status |

**Auth model:** `local-auth-hash` (bcrypt) -- NO JWT. 14 permission-gated endpoints supporting 9 toggleable permissions across waiter-cashier and chef roles.

**Business rules:** PPN calculation (`subtotal x ppn_rate`), recipe-based stock deduction (multi-step with reversal), shift cash reconciliation.

> See `api-design.json` domain_index to navigate by domain. Split files: `api-design-{domain}.json`.

---

## 3. Technology Decisions

| Layer | Choice | Source | Rationale |
|-------|--------|--------|-----------|
| Frontend Framework | React 18 + TypeScript | default | 17 screens, SPA comfort zone |
| Styling | Tailwind CSS 3 | default | Utility-first, responsive |
| State Management | Zustand + persist | override:key_signals | Offline-first needs persist-to-IndexedDB |
| Offline Storage | Dexie.js (IndexedDB) | override:key_signals | Primary data store for offline-first |
| Routing | React Router v6 | default | SPA routing with nested layouts |
| PWA | Workbox + Service Worker | override:nfr | 99% offline requirement |
| Auth | local-auth-hash (bcrypt) | override:key_signals | JWT incompatible with offline-first |
| Backend | Express.js 4 + TypeScript | default | Sync target only, low traffic |
| Server DB | PostgreSQL + Prisma | default | Sync backup, multi-device access |
| Testing | Jest + RTL + Supertest | default | Full stack coverage |

**Override justifications:**
- **Zustand over React Context:** 15 entities + offline-first requires persistent state. React Context cannot persist to IndexedDB. 10 domain-specific stores needed.
- **local-auth-hash over JWT:** JWT requires server for token issuance/refresh. Offline-first means auth MUST work without server.
- **Dexie.js as PRIMARY storage:** PostgreSQL is sync target only, not the primary database. All reads/writes go through Dexie first.

> See `tech-stack.json` for complete package list and version details.

---

## 4. Architecture

### Folder Structure

```
src/
  components/     Shared UI components
  pages/          Page components (17 screens)
  stores/         Zustand stores (10 domain stores)
  db/             Dexie database schema + migrations
  services/       Sync service, auth service
  hooks/          Custom React hooks
  layouts/        4 interface layouts
  utils/          Helpers, formatters
  types/          TypeScript type definitions
server/
  routes/         Express sync endpoints
  middleware/     Auth, validation
  prisma/         Schema + migrations (sync target)
tests/
  unit/           Store + service tests
  component/      React component tests
  api/            Sync endpoint tests
```

### Auth Flow (Offline-First)

```
User enters credentials
  -> bcrypt.compare(password, user.passwordHash) in Dexie
  -> If match: create session token in IndexedDB
  -> Store { userId, role, permissions, sessionToken } in useAuthStore
  -> BroadcastChannel syncs auth state across tabs
```

### Data Flow

```
Component -> Zustand store action
  -> Write to Dexie table (primary)
  -> Update store state (reactive UI)
  -> Queue change for sync
  -> When online: push to Express -> PostgreSQL
  -> Pull server changes -> merge into Dexie
```

### 4 Interfaces

| Interface | Layout | Target | Navigation |
|-----------|--------|--------|------------|
| Dashboard Hub | Fullscreen grid | All roles | Card-based navigation |
| Waiter-Cashier UI | Bottom tabs | Waiter/Cashier | Tab bar (Orders, Tables, Menu, More) |
| Kitchen Display | Fullscreen | Chef | Queue view, no navigation |
| Admin Panel | Sidebar | Owner | Sidebar menu |

> See `architecture.json` for screen_mapping (17 screens), seed_data, and route definitions.

---

## 5. Decisions Requiring Approval

22 decisions across 4 categories. All have recommended defaults.

### Critical Decisions (require explicit approval)

| ID | Decision | Recommended | Impact |
|----|----------|-------------|--------|
| D-001/D-030/D-064 | Stock deduction timing | At order submission with reversal | Inventory accuracy vs phantom deductions |
| D-053 | Auth model: local-auth-hash (NO JWT) | local-auth-hash | Foundational -- affects all auth flows |
| D-031 | Sync conflict resolution | LWW + financial merge | Data integrity for transactions |
| D-003 | Dual cooking status (order + item level) | Both levels | Kitchen display granularity |

### Standard Decisions (recommended defaults likely acceptable)

| ID | Decision | Recommended |
|----|----------|-------------|
| D-002 | Single PIN per user | Yes (simpler) |
| D-004 | Denormalized transaction data | Yes (immutable receipts) |
| D-032 | Client-side receipt printing | Yes (offline-compatible) |
| D-033 | Client-side Excel export | Yes (SheetJS, offline) |
| D-050-D-056 | Tech stack choices | All defaults/overrides as listed |
| D-060-D-066 | Architecture patterns | All as designed |

> See `technical-proposal.json` for the full `all_decisions_requiring_approval[]` array with options and rationale.

---

## 6. Coverage Report

### Priority Coverage Matrix

| Priority | Total | Fully Covered | Partially | Gaps | UI Only |
|----------|-------|---------------|-----------|------|---------|
| Must-Have | 12 | 12 | 0 | 0 | 0 |
| Should-Have | 5 | 5 | 0 | 0 | 0 |
| Could-Have | 1 | 1 | 0 | 0 | 0 |
| **Total** | **18** | **18** | **0** | **0** | **0** |

**Zero gaps.** All must-have features have entity mappings, API endpoints, and business rules fully specified.

### Cross-Domain Flows Validated

5 cross-domain flows resolved with endpoint mappings:

1. **UF-001: Order-to-Payment** (order -> kitchen -> payment -> inventory) -- stock deduction timing resolved
2. **UF-006: Insufficient Stock Warning** (order -> inventory) -- stock check at order submit
3. **UF-007: Full Cashier Journey** (auth -> shift -> order -> payment) -- PIN gates mapped
4. **UF-008: Kitchen Ready to Waiter** (kitchen -> order) -- notification push mapped
5. **UF-010: Void Paid Transaction** (order -> payment -> shift) -- reversal flow mapped

> See `integration-map.json` for detailed step-by-step endpoint mappings, timing resolutions, and store-service map.

---

## 7. Next Steps

1. **Review** this proposal and the 5 artifact files
2. **Approve** decisions (or modify) via BA Agent
3. **Implement** -- the foundation builder will use these specs to generate code

### Validation Summary

| Checkpoint | Checks | Passed | Fixed | Issues |
|------------|--------|--------|-------|--------|
| V1 (Post Layer 1) | 30 | 27 | 6 | 4 (low, non-blocking) |
| V2 (Post Layer 2) | 17 | 15 | 0 | 2 (warnings, non-blocking) |
| V3 (Final) | 14 | 14 | 0 | 0 |
| **Total** | **61** | **56** | **6** | **6** |

All validation checkpoints passed. No blocking issues found.
