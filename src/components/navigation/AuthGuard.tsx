// Guard: AuthGuard — Protects all routes except /login
// Check: Valid session token in useAuthStore

import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function AuthGuard() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useAuthStore((state) => state.currentUser);
  const checkSession = useAuthStore((state) => state.checkSession);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      try {
        await checkSession();
      } catch {
        // Session check failed — will redirect via isAuthenticated
      } finally {
        if (mounted) setChecking(false);
      }
    };
    verify();
    return () => { mounted = false; };
  }, [checkSession]);

  if (checking) {
    return <LoadingSpinner size="lg" message="Memeriksa sesi..." />;
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
