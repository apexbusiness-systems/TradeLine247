/**
 * Admin Role Authorization Middleware
 *
 * Validates that the authenticated user has admin privileges.
 * Must be used after authenticateRequest middleware.
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Extended Request interface with auth context
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    supabaseClient: SupabaseClient;
  };
}

/**
 * Middleware to verify user has admin role
 *
 * @throws 401 if user is not authenticated
 * @throws 403 if user is authenticated but not admin
 * @throws 500 if database query fails
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Ensure user is authenticated (should be done by prior middleware)
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized - Authentication required'
      });
      return;
    }

    // Query user role from database
    const { data: roleRow, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', req.auth.userId)
      .maybeSingle(); // Use maybeSingle() instead of single() for graceful null handling

    // Handle database errors
    if (error) {
      console.error('[Auth] Role check database error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify permissions'
      });
      return;
    }

    // Verify admin role exists and matches
    if (!roleRow || roleRow.role !== 'admin') {
      console.warn(`[Auth] Forbidden access attempt by user ${req.auth.userId} - role: ${roleRow?.role || 'none'}`);
      res.status(403).json({
        success: false,
        error: 'Forbidden - Admin role required'
      });
      return;
    }

    // User is admin, proceed to route handler
    console.info(`[Auth] Admin access granted for user ${req.auth.userId}`);
    next();
  } catch (error) {
    console.error('[Auth] Admin check exception:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during authorization'
    });
  }
};

/**
 * Helper function for programmatic admin checks (non-middleware usage)
 *
 * @param userId - The user ID to check
 * @returns true if user is admin, false otherwise
 */
export const checkAdminRole = async (userId: string): Promise<boolean> => {
  try {
    const { data: roleRow, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Auth] checkAdminRole error:', error);
      return false;
    }

    return roleRow?.role === 'admin';
  } catch (error) {
    console.error('[Auth] checkAdminRole exception:', error);
    return false;
  }
};
