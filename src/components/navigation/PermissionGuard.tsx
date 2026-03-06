// Guard: PermissionGuard — Protects permission-gated routes
// Check: User has required permission in permission_checklist

import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface PermissionGuardProps {
  requiredPermission: string;
}

export function PermissionGuard({ requiredPermission }: PermissionGuardProps) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const userPermissions = useAuthStore((state) => state.userPermissions);
  const loadPermissions = useAuthStore((state) => state.loadPermissions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'owner') return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        await loadPermissions(currentUser.id);
      } catch {
        // Permission load failed — will deny access
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [currentUser, loadPermissions]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Owner has full access — bypass permission check
  if (currentUser.role === 'owner') {
    return <Outlet />;
  }

  if (loading) {
    return <LoadingSpinner size="md" message="Memeriksa izin..." />;
  }

  // Check if user has the required permission
  const hasPermission = userPermissions.some(
    (p) => p.permissionKey === requiredPermission && p.isGranted
  );

  if (!hasPermission) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
