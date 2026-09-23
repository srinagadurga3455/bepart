import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const mockContext = (userRole?: string, requiredRoles?: string[]) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles as any);
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: userRole ? { role: userRole } : undefined }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should allow when no roles required', () => {
    const ctx = mockContext('STUDENT', undefined as any);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user has required role', () => {
    const ctx = mockContext('ADMIN', ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject STUDENT accessing ADMIN endpoint', () => {
    const ctx = mockContext('STUDENT', ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should reject ORGANIZER accessing ADMIN endpoint', () => {
    const ctx = mockContext('ORGANIZER', ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow ORGANIZER for ORGANIZER role', () => {
    const ctx = mockContext('ORGANIZER', ['ORGANIZER', 'ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
