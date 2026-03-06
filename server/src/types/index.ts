import { Request } from 'express';

export interface SessionUser {
  id: string;
  username: string;
  role: string;
  displayName: string;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
  sessionToken?: string;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
