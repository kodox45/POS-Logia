import prisma from '../../prisma';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword, hashPin } from '../auth';

const CORE_PERMISSIONS: Record<string, string[]> = {
  'waiter-cashier': ['perm-view-menu', 'perm-view-tables'],
  chef: ['perm-chef-view-menu'],
};

const DEFAULT_PERMISSIONS: Record<string, { key: string; granted: boolean }[]> = {
  'waiter-cashier': [
    { key: 'perm-view-stock', granted: false },
    { key: 'perm-view-menu', granted: true },
    { key: 'perm-view-recipe', granted: false },
    { key: 'perm-view-tables', granted: true },
    { key: 'perm-view-reports', granted: false },
    { key: 'perm-view-transactions', granted: false },
  ],
  chef: [
    { key: 'perm-chef-view-stock', granted: false },
    { key: 'perm-chef-view-menu', granted: true },
    { key: 'perm-chef-manage-recipe', granted: false },
  ],
};

function mapRole(prismaRole: string): string {
  return prismaRole.replace('_', '-');
}

function toPrismaRole(role: string): 'owner' | 'waiter_cashier' | 'chef' {
  if (role === 'waiter-cashier') return 'waiter_cashier';
  return role as 'owner' | 'chef';
}

export async function listUsers(filters: { role?: string; isActive?: boolean }) {
  const where: any = {};
  if (filters.role) {
    where.role = toPrismaRole(filters.role);
  }
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: mapRole(u.role),
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    total: users.length,
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      permissions: {
        select: { permissionKey: true, isGranted: true },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: mapRole(user.role),
    isActive: user.isActive,
    hasPinSet: !!user.pinHash,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    permissions: user.permissions.map((p) => ({
      permissionKey: p.permissionKey,
      isGranted: p.isGranted,
    })),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function createUser(data: {
  username: string;
  password: string;
  displayName: string;
  role: string;
  pin?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { username: data.username },
  });
  if (existing) {
    throw new AppError(409, 'USERNAME_EXISTS', 'Username already taken');
  }

  const passwordHash = await hashPassword(data.password);
  const pinHash = data.pin ? await hashPin(data.pin) : undefined;
  const prismaRole = toPrismaRole(data.role);

  const roleDefaults = DEFAULT_PERMISSIONS[data.role] || [];

  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      pinHash,
      role: prismaRole,
      displayName: data.displayName,
      permissions: {
        create: roleDefaults.map((p) => ({
          permissionKey: p.key,
          isGranted: p.granted,
        })),
      },
    },
    include: {
      permissions: {
        select: { permissionKey: true, isGranted: true },
      },
    },
  });

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: mapRole(user.role),
    isActive: user.isActive,
    permissions: user.permissions.map((p) => ({
      permissionKey: p.permissionKey,
      isGranted: p.isGranted,
    })),
  };
}

export async function updateUser(
  id: string,
  data: {
    displayName?: string;
    password?: string;
    pin?: string;
    isActive?: boolean;
  },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const updateData: any = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password) updateData.passwordHash = await hashPassword(data.password);
  if (data.pin) updateData.pinHash = await hashPin(data.pin);

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      username: true,
      displayName: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    username: updated.username,
    displayName: updated.displayName,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function getUserPermissions(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const role = mapRole(user.role);
  const roleDefaults = DEFAULT_PERMISSIONS[role] || [];

  const dbPermissions = await prisma.userPermission.findMany({
    where: { userId },
    select: { id: true, permissionKey: true, isGranted: true },
  });

  const dbPermMap = new Map(dbPermissions.map((p) => [p.permissionKey, p]));

  const permissions = roleDefaults.map((def) => {
    const dbPerm = dbPermMap.get(def.key);
    return {
      id: dbPerm?.id ?? null,
      permissionKey: def.key,
      name: def.key,
      isGranted: dbPerm?.isGranted ?? def.granted,
      isDefault: def.granted,
    };
  });

  return {
    userId,
    role,
    permissions,
  };
}

export async function updateUserPermissions(
  userId: string,
  permissions: { permissionKey: string; isGranted: boolean }[],
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const role = mapRole(user.role);
  const corePerms = CORE_PERMISSIONS[role] || [];

  for (const perm of permissions) {
    if (corePerms.includes(perm.permissionKey) && !perm.isGranted) {
      throw new AppError(400, 'CORE_PERMISSION_PROTECTED', 'Core permissions cannot be removed');
    }
  }

  const results = [];
  for (const perm of permissions) {
    const result = await prisma.userPermission.upsert({
      where: {
        userId_permissionKey: {
          userId,
          permissionKey: perm.permissionKey,
        },
      },
      update: { isGranted: perm.isGranted },
      create: {
        userId,
        permissionKey: perm.permissionKey,
        isGranted: perm.isGranted,
      },
      select: { permissionKey: true, isGranted: true },
    });
    results.push(result);
  }

  return {
    userId,
    updatedPermissions: results,
    updatedAt: new Date().toISOString(),
  };
}
