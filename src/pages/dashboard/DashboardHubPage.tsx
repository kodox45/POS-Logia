// Screen: S-016 | Interface: shared | Roles: owner, waiter-cashier, chef

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useShiftManagementStore } from '@/stores/useShiftManagementStore';
import {
  ClipboardList,
  CreditCard,
  LayoutGrid,
  ListOrdered,
  BookOpen,
  BarChart2,
  UtensilsCrossed,
  Package,
  Receipt,
  Users,
  Settings,
  Clock,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/enums';

interface MenuCard {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
  color: string;
  roles: UserRole[];
  permissionKey?: string;
}

const MENU_CARDS: MenuCard[] = [
  // Waiter-Cashier / Owner POS actions
  { label: 'Pesanan', description: 'Kelola pesanan pelanggan', icon: ClipboardList, path: '/pos/orders', color: 'bg-blue-500', roles: ['waiter-cashier', 'owner'] },
  { label: 'Meja', description: 'Lihat peta meja', icon: LayoutGrid, path: '/pos/tables', color: 'bg-teal-500', roles: ['waiter-cashier', 'owner'] },
  { label: 'Pembayaran', description: 'Proses pembayaran', icon: CreditCard, path: '/pos/payment', color: 'bg-green-500', roles: ['waiter-cashier', 'owner'] },

  // Chef actions
  { label: 'Antrian Dapur', description: 'Pesanan masuk & status', icon: ListOrdered, path: '/kitchen/queue', color: 'bg-orange-500', roles: ['chef', 'owner'] },
  { label: 'Resep', description: 'Panduan memasak', icon: BookOpen, path: '/kitchen/recipe', color: 'bg-amber-500', roles: ['chef', 'owner'] },

  // Owner admin actions
  { label: 'Dashboard Admin', description: 'Laporan & analitik', icon: BarChart2, path: '/admin/dashboard', color: 'bg-purple-500', roles: ['owner'] },
  { label: 'Menu', description: 'Kelola menu restoran', icon: UtensilsCrossed, path: '/admin/menu', color: 'bg-rose-500', roles: ['owner'] },
  { label: 'Stok', description: 'Kelola inventaris', icon: Package, path: '/admin/inventory', color: 'bg-cyan-500', roles: ['owner'] },
  { label: 'Transaksi', description: 'Riwayat transaksi', icon: Receipt, path: '/admin/transactions', color: 'bg-indigo-500', roles: ['owner'] },
  { label: 'Pengguna', description: 'Kelola akun pengguna', icon: Users, path: '/admin/users', color: 'bg-pink-500', roles: ['owner'] },
  { label: 'Pengaturan', description: 'Konfigurasi sistem', icon: Settings, path: '/admin/settings', color: 'bg-slate-500', roles: ['owner'] },

  // Cross-role access cards (non-owner accessing admin features via permissions)
  { label: 'Menu', description: 'Lihat menu restoran', icon: UtensilsCrossed, path: '/admin/menu', color: 'bg-rose-500', roles: ['waiter-cashier'], permissionKey: 'perm-view-menu' },
  { label: 'Stok', description: 'Lihat inventaris', icon: Package, path: '/admin/inventory', color: 'bg-cyan-500', roles: ['waiter-cashier'], permissionKey: 'perm-view-stock' },
  { label: 'Resep', description: 'Lihat resep', icon: BookOpen, path: '/admin/recipes', color: 'bg-amber-500', roles: ['waiter-cashier'], permissionKey: 'perm-view-recipe' },
  { label: 'Menu', description: 'Lihat menu restoran', icon: UtensilsCrossed, path: '/admin/menu', color: 'bg-rose-500', roles: ['chef'], permissionKey: 'perm-chef-view-menu' },
  { label: 'Stok', description: 'Lihat inventaris', icon: Package, path: '/admin/inventory', color: 'bg-cyan-500', roles: ['chef'], permissionKey: 'perm-chef-view-stock' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Selamat Pagi';
  if (hour < 17) return 'Selamat Siang';
  return 'Selamat Malam';
}

function formatDate(): string {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function DashboardHubPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const userPermissions = useAuthStore((state) => state.userPermissions);
  const activeShift = useShiftManagementStore((state) => state.activeShift);
  const navigate = useNavigate();

  if (!currentUser) return null;

  const role = currentUser.role;

  // Filter menu cards by role and permissions
  const visibleCards = MENU_CARDS.filter((card) => {
    if (!card.roles.includes(role)) return false;
    // Owner sees all cards without permission checks
    if (role === 'owner') return true;
    // If card requires a permission, check user has it
    if (card.permissionKey) {
      return userPermissions.some(
        (p) => p.permissionKey === card.permissionKey && p.isGranted
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">
          {getGreeting()}, {currentUser.displayName}
        </h1>
        <p className="text-text-secondary text-sm mt-1">{formatDate()}</p>
      </div>

      {/* Shift Status Indicator */}
      {(role === 'waiter-cashier' || role === 'owner') && (
        <div className="flex items-center gap-3">
          {activeShift && activeShift.shiftStatus === 'open' ? (
            <div className="flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-lg text-sm">
              <Clock size={16} />
              <span>Shift aktif: {activeShift.shiftNumber}</span>
            </div>
          ) : (
            <button
              onClick={() => navigate('/shift/open')}
              className="flex items-center gap-2 bg-warning/10 text-warning hover:bg-warning/20 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <PlayCircle size={16} />
              <span>Buka shift untuk mulai transaksi</span>
            </button>
          )}
        </div>
      )}

      {/* Role Menu Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4" role="navigation" aria-label="Menu utama">
        {visibleCards.map((card, index) => (
          <button
            key={`${card.path}-${card.roles.join(',')}-${index}`}
            onClick={() => navigate(card.path)}
            className="bg-surface border border-border rounded-lg p-4 sm:p-5 text-left hover:border-primary/40 hover:shadow-md transition-all group"
            aria-label={`${card.label}: ${card.description}`}
          >
            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg ${card.color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <card.icon size={20} className="text-white sm:hidden" aria-hidden="true" />
              <card.icon size={24} className="text-white hidden sm:block" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-text-primary text-sm sm:text-base">{card.label}</h3>
            <p className="text-text-secondary text-xs mt-0.5 hidden sm:block">{card.description}</p>
          </button>
        ))}
      </div>

      {/* Quick Info Bar */}
      <div className="border-t border-border pt-4">
        {role === 'owner' && activeShift && (
          <div className="flex flex-wrap gap-3">
            <div className="bg-surface border border-border rounded-lg px-4 py-2.5 flex-1 min-w-[140px]">
              <p className="text-text-secondary text-xs">Pendapatan Hari Ini</p>
              <p className="text-text-primary font-semibold text-lg">
                Rp {(activeShift.totalRevenue / 100).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg px-4 py-2.5 flex-1 min-w-[140px]">
              <p className="text-text-secondary text-xs">Total Transaksi</p>
              <p className="text-text-primary font-semibold text-lg">{activeShift.totalTransactions}</p>
            </div>
          </div>
        )}

        {role === 'waiter-cashier' && activeShift && (
          <div className="bg-surface border border-border rounded-lg px-4 py-2.5">
            <p className="text-text-secondary text-xs">Status Shift</p>
            <p className="text-text-primary font-medium">
              Shift {activeShift.shiftNumber} - Aktif sejak{' '}
              {new Date(activeShift.shiftStartTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}

        {role === 'chef' && (
          <div className="bg-surface border border-border rounded-lg px-4 py-2.5">
            <p className="text-text-secondary text-xs">Kitchen Display</p>
            <p className="text-text-primary font-medium">
              Lihat antrian pesanan di Antrian Dapur
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
