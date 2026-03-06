// ============================================================
// Constants — Roles, permissions, and app configuration
// Role type imported from enums.ts to avoid duplication
// ============================================================

import type { UserRole } from '@/types/enums';

export interface RoleDefinition {
  id: UserRole;
  name: string;
  description: string;
  permissions: string[];
  restrictions: string[];
}

export const ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner / Admin',
    description: 'Restaurant owner with full system access.',
    permissions: [
      'Full access to all system modules',
      'Manage menu items, pricing, and categories',
      'Manage recipes and cooking guides',
      'View and manage inventory/stock',
      'View all reports and analytics',
      'Process orders and payments',
      'Manage table assignments',
      'Configure user accounts and access permissions',
      'Access control panel with toggleable checklist per user',
    ],
    restrictions: [],
  },
  {
    id: 'waiter-cashier',
    name: 'Waiter / Cashier',
    description: 'Front-of-house staff handling customer service and payments.',
    permissions: [
      'Create and manage customer orders',
      'Process payments and generate receipts',
    ],
    restrictions: [
      'Cannot access access control settings',
      'Cannot delete transaction history',
    ],
  },
  {
    id: 'chef',
    name: 'Chef / Cook',
    description: 'Kitchen staff responsible for food preparation.',
    permissions: [
      'View incoming orders on Kitchen Display',
      'Update order status (cooking, ready)',
      'View recipes and cooking guides',
    ],
    restrictions: [
      'Cannot access access control settings',
      'Cannot process payments',
      'Cannot delete transaction history',
    ],
  },
];

export interface PermissionDefinition {
  id: string;
  name: string;
  defaultValue: boolean;
  role: UserRole;
}

export const PERMISSIONS: PermissionDefinition[] = [
  // Waiter/Cashier toggleable permissions
  { id: 'perm-view-stock', name: 'View Inventory / Stock', defaultValue: false, role: 'waiter-cashier' },
  { id: 'perm-view-menu', name: 'View / Browse Menu Management', defaultValue: true, role: 'waiter-cashier' },
  { id: 'perm-view-recipe', name: 'View Recipes / Cooking Guides', defaultValue: false, role: 'waiter-cashier' },
  { id: 'perm-view-tables', name: 'View and Manage Tables', defaultValue: true, role: 'waiter-cashier' },
  { id: 'perm-view-reports', name: 'View Sales Reports', defaultValue: false, role: 'waiter-cashier' },
  { id: 'perm-view-transactions', name: 'View Transaction History', defaultValue: false, role: 'waiter-cashier' },
  // Chef toggleable permissions
  { id: 'perm-chef-view-stock', name: 'View Inventory / Stock', defaultValue: false, role: 'chef' },
  { id: 'perm-chef-view-menu', name: 'View Menu Management', defaultValue: true, role: 'chef' },
  { id: 'perm-chef-manage-recipe', name: 'Edit Recipes / Cooking Guides', defaultValue: false, role: 'chef' },
];

export const ROLE_HIERARCHY: UserRole[] = ['chef', 'waiter-cashier', 'owner'];
