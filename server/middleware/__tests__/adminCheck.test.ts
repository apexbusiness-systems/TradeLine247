import { Request, Response } from 'express';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock needs to be defined before imports that use it if not hoisted correctly,
// but vi.mock is hoisted. We use a factory to prevent original module execution.
vi.mock('../../supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Now import the module under test
import { requireAdmin, checkAdminRole } from '../adminCheck';
import { supabase } from '../../supabase/client';

describe('requireAdmin middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: any;

  beforeEach(() => {
    mockRequest = {
      // @ts-ignore
      auth: {
        userId: 'test-user-id',
        supabaseClient: supabase,
      },
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    nextFunction = vi.fn();
  });

  it('should call next() when user is admin', async () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      }),
    });

    await requireAdmin(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user is not admin', async () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'user' },
            error: null,
          }),
        }),
      }),
    });

    await requireAdmin(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Forbidden - Admin role required',
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 when auth is missing', async () => {
    // @ts-ignore
    mockRequest.auth = undefined;

    await requireAdmin(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  describe('checkAdminRole helper', () => {
    it('should return true when user is admin', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkAdminRole('test-user-id');
      expect(result).toBe(true);
    });

    it('should return false when user is not admin', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkAdminRole('test-user-id');
      expect(result).toBe(false);
    });
  });
});
