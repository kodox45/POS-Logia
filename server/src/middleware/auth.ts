import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, SessionUser } from '../types';
import prisma from '../prisma';

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

// In-memory session store. In production, use Redis or a persistent store.
const sessions = new Map<string, { user: SessionUser; createdAt: number }>();

export function createSession(user: SessionUser): string {
  const token = generateToken();
  sessions.set(token, { user, createdAt: Date.now() });
  return token;
}

export function destroySession(token: string): boolean {
  return sessions.delete(token);
}

export function getSession(token: string): SessionUser | null {
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_TIMEOUT_MS) {
    sessions.delete(token);
    return null;
  }

  return session.user;
}

export async function refreshSessionUser(token: string): Promise<SessionUser | null> {
  const session = sessions.get(token);
  if (!session) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, role: true, displayName: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    sessions.delete(token);
    return null;
  }

  const updated: SessionUser = {
    id: dbUser.id,
    username: dbUser.username,
    role: dbUser.role.replace('_', '-'),
    displayName: dbUser.displayName,
    isActive: dbUser.isActive,
  };

  session.user = updated;
  return updated;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'No active session' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const user = getSession(token);

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'No active session' },
    });
    return;
  }

  if (!user.isActive) {
    destroySession(token);
    res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_DEACTIVATED', message: 'User account has been deactivated' },
    });
    return;
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'No active session' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
      return;
    }

    next();
  };
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
