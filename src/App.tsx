// ============================================================
// App — Root component with routing tree
// Guard chain: AuthGuard > RoleGuard > PermissionGuard > PinGateModal > ShiftGuard
// ============================================================

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AuthGuard } from '@/components/navigation/AuthGuard';
import { RoleGuard } from '@/components/navigation/RoleGuard';
import { PinGateModal } from '@/components/navigation/PinGateModal';
import { ShiftGuard } from '@/components/navigation/ShiftGuard';
import { DashboardHubLayout } from '@/components/layout/DashboardHubLayout';
import { WaiterCashierLayout } from '@/components/layout/WaiterCashierLayout';
import { KitchenLayout } from '@/components/layout/KitchenLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const DashboardHubPage = lazy(() => import('@/pages/dashboard/DashboardHubPage'));
const OrderListPage = lazy(() => import('@/pages/pos/OrderListPage'));
const CreateOrderPage = lazy(() => import('@/pages/pos/CreateOrderPage'));
const PaymentPage = lazy(() => import('@/pages/pos/PaymentPage'));
const TableMapPage = lazy(() => import('@/pages/pos/TableMapPage'));
const KitchenQueuePage = lazy(() => import('@/pages/kitchen/KitchenQueuePage'));
const RecipeViewerPage = lazy(() => import('@/pages/kitchen/RecipeViewerPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const MenuManagementPage = lazy(() => import('@/pages/admin/MenuManagementPage'));
const RecipeManagementPage = lazy(() => import('@/pages/admin/RecipeManagementPage'));
const InventoryManagementPage = lazy(() => import('@/pages/admin/InventoryManagementPage'));
const TransactionHistoryPage = lazy(() => import('@/pages/admin/TransactionHistoryPage'));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'));
const SystemSettingsPage = lazy(() => import('@/pages/admin/SystemSettingsPage'));
const OpenShiftPage = lazy(() => import('@/pages/shift/OpenShiftPage'));
const CloseShiftPage = lazy(() => import('@/pages/shift/CloseShiftPage'));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" message="Memuat halaman..." />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* All authenticated routes wrapped in AuthGuard */}
        <Route element={<AuthGuard />}>
          {/* Dashboard Hub — all roles */}
          <Route element={<DashboardHubLayout />}>
            <Route path="/dashboard" element={<DashboardHubPage />} />
          </Route>

          {/* Shift pages — standalone (no persistent nav) */}
          <Route
            element={<RoleGuard allowedRoles={['waiter-cashier', 'owner']} />}
          >
            <Route path="/shift/open" element={<OpenShiftPage />} />
            <Route path="/shift/close" element={<CloseShiftPage />} />
          </Route>

          {/* POS routes — waiter-cashier + owner, with PinGate and ShiftGuard */}
          <Route
            element={<RoleGuard allowedRoles={['waiter-cashier', 'owner']} />}
          >
            <Route element={<PinGateModal />}>
              <Route element={<ShiftGuard />}>
                <Route element={<WaiterCashierLayout />}>
                  <Route path="/pos/orders" element={<OrderListPage />} />
                  <Route path="/pos/orders/new" element={<CreateOrderPage />} />
                  <Route path="/pos/payment/:orderId" element={<PaymentPage />} />
                  <Route path="/pos/tables" element={<TableMapPage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Kitchen routes — chef + owner */}
          <Route
            element={<RoleGuard allowedRoles={['chef', 'owner']} />}
          >
            <Route element={<KitchenLayout />}>
              <Route path="/kitchen/queue" element={<KitchenQueuePage />} />
              <Route path="/kitchen/recipe/:recipeId" element={<RecipeViewerPage />} />
            </Route>
          </Route>

          {/* Admin routes — owner (cross-role access via PermissionGuard handled per-page in Session 2) */}
          <Route
            element={<RoleGuard allowedRoles={['owner']} />}
          >
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/menu" element={<MenuManagementPage />} />
              <Route path="/admin/recipes" element={<RecipeManagementPage />} />
              <Route path="/admin/inventory" element={<InventoryManagementPage />} />
              <Route path="/admin/transactions" element={<TransactionHistoryPage />} />
              <Route path="/admin/users" element={<UserManagementPage />} />
              <Route path="/admin/settings" element={<SystemSettingsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
