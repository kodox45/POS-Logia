// Screen: S-013 | Interface: admin-panel | Roles: owner
import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { db } from '@/db/database';
import { PERMISSIONS } from '@/lib/constants';
import bcrypt from 'bcryptjs';
import { format } from 'date-fns';
import {
  Search, Plus, X, UserCheck, UserX, Shield, Edit2, Key,
} from 'lucide-react';
import clsx from 'clsx';
import type { User, UserPermission } from '@/types';
import type { UserRole } from '@/types/enums';

function generateId(): string {
  return crypto.randomUUID();
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner / Admin',
  'waiter-cashier': 'Waiter / Kasir',
  chef: 'Chef / Koki',
};

export default function UserManagementPage() {
  const { users, loading, error, loadUsers, currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [permUser, setPermUser] = useState<User | null>(null);
  const [permList, setPermList] = useState<UserPermission[]>([]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.role === roleFilter);
    }
    return list;
  }, [users, search, roleFilter]);

  const openPermissions = async (user: User) => {
    setPermUser(user);
    const existing = await db.userPermissions.where('userId').equals(user.id).toArray();
    setPermList(existing);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Manajemen Pengguna</h1>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Tambah Pengguna
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pengguna..." className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
          <option value="all">Semua Role</option>
          <option value="owner">Owner / Admin</option>
          <option value="waiter-cashier">Waiter / Kasir</option>
          <option value="chef">Chef / Koki</option>
        </select>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left px-4 py-3 font-medium">Nama</th>
                <th className="text-left px-4 py-3 font-medium">Username</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Login Terakhir</th>
                <th className="text-center px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && !users.length ? (
                <tr><td colSpan={6} className="text-center py-12 text-text-secondary">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-text-secondary">Tidak ada pengguna ditemukan</td></tr>
              ) : filtered.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-background/50">
                  <td className="px-4 py-3 text-text-primary font-medium">{user.displayName}</td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs">{user.username}</td>
                  <td className="px-4 py-3 text-text-secondary">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                      {user.isActive ? <><UserCheck size={12} /> Aktif</> : <><UserX size={12} /> Nonaktif</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'dd/MM/yy HH:mm') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditUser(user)} title="Edit" className="p-1.5 hover:bg-primary/10 rounded text-primary"><Edit2 size={16} /></button>
                      <button onClick={() => openPermissions(user)} title="Izin Akses" className="p-1.5 hover:bg-yellow-500/10 rounded text-yellow-400"><Shield size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {(showAddModal || editUser) && (
        <UserFormModal
          user={editUser}
          currentUserId={currentUser?.id}
          onClose={() => { setShowAddModal(false); setEditUser(null); }}
          onSave={async () => {
            await loadUsers();
            setShowAddModal(false);
            setEditUser(null);
          }}
        />
      )}

      {/* Permission Checklist Modal */}
      {permUser && (
        <PermissionModal
          user={permUser}
          permissions={permList}
          onClose={() => setPermUser(null)}
          onSave={async () => {
            await loadUsers();
            setPermUser(null);
          }}
        />
      )}
    </div>
  );
}

function UserFormModal({ user, currentUserId, onClose, onSave }: {
  user: User | null;
  currentUserId?: string;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'waiter-cashier');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isEdit = !!user;
  const isSelf = user?.id === currentUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (isEdit) {
        const updates: Partial<User> = {
          displayName: displayName.trim(),
          isActive,
          updatedAt: now,
          syncStatus: 'pending' as const,
        };
        if (password) updates.passwordHash = await bcrypt.hash(password, 10);
        if (pin) updates.pinHash = await bcrypt.hash(pin, 10);
        await db.users.update(user.id, updates);
      } else {
        // Check uniqueness
        const existing = await db.users.where('username').equals(username.trim()).first();
        if (existing) { setFormError('Username sudah digunakan'); setSaving(false); return; }
        if (!password) { setFormError('Password wajib diisi'); setSaving(false); return; }
        const passwordHash = await bcrypt.hash(password, 10);
        const pinHash = pin ? await bcrypt.hash(pin, 10) : undefined;
        const newUser: User = {
          id: generateId(),
          username: username.trim(),
          passwordHash,
          pinHash,
          role,
          displayName: displayName.trim(),
          isActive: true,
          syncId: generateId(),
          syncStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        };
        await db.users.add(newUser);

        // Create default permissions
        const defaultPerms = PERMISSIONS.filter((p) => p.role === role);
        for (const perm of defaultPerms) {
          await db.userPermissions.add({
            id: generateId(),
            userId: newUser.id,
            permissionKey: perm.id,
            isGranted: perm.defaultValue,
            syncId: generateId(),
            syncStatus: 'pending',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      await onSave();
    } catch (err) {
      setFormError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{isEdit ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
        </div>
        {formError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg mb-4 text-sm">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Nama Tampilan</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
            </div>
          )}
          <div>
            <label className="block text-sm text-text-secondary mb-1">{isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!isEdit} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1 flex items-center gap-1"><Key size={12} /> PIN (4-6 digit, opsional)</label>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6} pattern="\d{4,6}" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary">
                <option value="waiter-cashier">Waiter / Kasir</option>
                <option value="chef">Chef / Koki</option>
              </select>
            </div>
          )}
          {isEdit && !isSelf && (
            <div className="flex items-center justify-between">
              <label className="text-sm text-text-secondary">Status Aktif</label>
              <button type="button" onClick={() => setIsActive(!isActive)} className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', isActive ? 'bg-green-500' : 'bg-border')}>
                <span className={clsx('inline-block h-4 w-4 rounded-full bg-white transition-transform', isActive ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-text-secondary px-4 py-2 rounded-lg text-sm hover:bg-background">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PermissionModal({ user, permissions, onClose, onSave }: {
  user: User;
  permissions: UserPermission[];
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const rolePerms = PERMISSIONS.filter((p) => p.role === user.role);
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const p of rolePerms) {
      const existing = permissions.find((up) => up.permissionKey === p.id);
      map[p.id] = existing ? existing.isGranted : p.defaultValue;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  const togglePerm = (key: string) => {
    setLocalPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    for (const perm of rolePerms) {
      const existing = permissions.find((up) => up.permissionKey === perm.id);
      if (existing) {
        await db.userPermissions.update(existing.id, {
          isGranted: localPerms[perm.id] ?? perm.defaultValue,
          updatedAt: now,
          syncStatus: 'pending',
        });
      } else {
        await db.userPermissions.add({
          id: generateId(),
          userId: user.id,
          permissionKey: perm.id,
          isGranted: localPerms[perm.id] ?? perm.defaultValue,
          syncId: generateId(),
          syncStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    await onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Izin Akses</h2>
            <p className="text-sm text-text-secondary">{user.displayName} ({ROLE_LABELS[user.role]})</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
        </div>

        {rolePerms.length === 0 ? (
          <p className="text-sm text-text-secondary py-4">Role ini memiliki akses penuh (Owner) atau tidak memiliki izin yang dapat diatur.</p>
        ) : (
          <div className="space-y-3 mb-6">
            {rolePerms.map((perm) => (
              <div key={perm.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-primary">{perm.name}</p>
                  <p className="text-xs text-text-secondary">Default: {perm.defaultValue ? 'Aktif' : 'Nonaktif'}</p>
                </div>
                <button type="button" onClick={() => togglePerm(perm.id)} className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', localPerms[perm.id] ? 'bg-primary' : 'bg-border')}>
                  <span className={clsx('inline-block h-4 w-4 rounded-full bg-white transition-transform', localPerms[perm.id] ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-border text-text-secondary px-4 py-2 rounded-lg text-sm hover:bg-background">Batal</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}
