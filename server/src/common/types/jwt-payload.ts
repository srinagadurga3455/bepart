import { Role } from '../constants/roles';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  userId: string;
  id: string;
  email: string;
  role: Role;
}
