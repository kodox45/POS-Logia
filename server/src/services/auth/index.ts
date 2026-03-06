import bcrypt from 'bcryptjs';
import prisma from '../../prisma';
import { SessionUser } from '../../types';
import { createSession, destroySession, getSession } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';

const BCRYPT_ROUNDS = 10;

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      permissions: {
        select: { permissionKey: true, isGranted: true },
      },
    },
  });

  if (!user) {
    console.warn(`Failed login attempt for username: ${username}`);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect');
  }

  if (!user.isActive) {
    console.warn(`Login attempt for deactivated account: ${username}`);
    throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'User account has been deactivated');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    console.warn(`Failed login attempt (wrong password) for username: ${username}`);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    role: user.role.replace('_', '-'),
    displayName: user.displayName,
    isActive: user.isActive,
  };

  const sessionToken = createSession(sessionUser);

  const grantedPermissions = user.permissions
    .filter((p) => p.isGranted)
    .map((p) => p.permissionKey);

  return {
    user: {
      id: user.id,
      username: user.username,
      role: sessionUser.role,
      displayName: user.displayName,
      isActive: user.isActive,
    },
    sessionToken,
    permissions: grantedPermissions,
  };
}

export async function logout(token: string) {
  const success = destroySession(token);
  if (!success) {
    throw new AppError(401, 'NOT_AUTHENTICATED', 'No active session');
  }
  return { message: 'Logged out successfully' };
}

export async function verifyPin(
  userId: string,
  pin: string,
  context: 'shift_open' | 'pos_entry' | 'void_operation',
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, pinHash: true, role: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (!user.pinHash) {
    throw new AppError(404, 'PIN_NOT_SET', 'User does not have a PIN configured');
  }

  const pinValid = await bcrypt.compare(pin, user.pinHash);
  if (!pinValid) {
    throw new AppError(401, 'INVALID_PIN', 'PIN is incorrect');
  }

  return {
    verified: true,
    verifiedAt: new Date().toISOString(),
  };
}

export async function getSessionInfo(token: string) {
  const user = getSession(token);
  if (!user) {
    throw new AppError(401, 'NOT_AUTHENTICATED', 'No active session');
  }

  const permissions = await prisma.userPermission.findMany({
    where: { userId: user.id, isGranted: true },
    select: { permissionKey: true },
  });

  const activeShift = await prisma.shift.findFirst({
    where: {
      picCashierId: user.id,
      shiftStatus: 'open',
    },
    select: { id: true, shiftNumber: true, shiftStartTime: true },
    orderBy: { shiftStartTime: 'desc' },
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    },
    permissions: permissions.map((p) => p.permissionKey),
    activeShift: activeShift
      ? {
          id: activeShift.id,
          shiftNumber: activeShift.shiftNumber,
          startTime: activeShift.shiftStartTime.toISOString(),
        }
      : null,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}
