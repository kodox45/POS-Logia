// Guard: ShiftGuard — Protects payment processing routes
// Check: Active shift exists in useShiftManagementStore

import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function ShiftGuard() {
  const activeShift = useShiftManagementStore((state) => state.activeShift);
  const loadShifts = useShiftManagementStore((state) => state.loadShifts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await loadShifts();
      } catch {
        // Load failed — will redirect to open shift
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [loadShifts]);

  if (loading) {
    return <LoadingSpinner size="md" message="Memeriksa shift..." />;
  }

  if (!activeShift || activeShift.shiftStatus !== 'open') {
    return <Navigate to="/shift/open" replace />;
  }

  return <Outlet />;
}
