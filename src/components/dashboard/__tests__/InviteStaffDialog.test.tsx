import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteStaffDialog } from '../InviteStaffDialog';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { ensureMembership } from '@/lib/ensureMembership';
import React from 'react';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ensureMembership', () => ({
  ensureMembership: vi.fn(),
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('InviteStaffDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    (ensureMembership as any).mockResolvedValue({
      orgId: 'org-123',
    });
  });

  it('renders correctly when open', () => {
    render(<InviteStaffDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
  });

  it('calls backend with correct parameters', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { message: 'Success' },
      error: null,
    });

    render(<InviteStaffDialog open={true} onOpenChange={onOpenChange} />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const submitButton = screen.getByRole('button', { name: /Send Invitation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(ensureMembership).toHaveBeenCalled();
      expect(supabase.functions.invoke).toHaveBeenCalledWith('invite-staff', {
        body: {
          email: 'test@example.com',
          role: 'member',
          name: '',
          organization_id: 'org-123',
        },
      });
    });
  });
});
