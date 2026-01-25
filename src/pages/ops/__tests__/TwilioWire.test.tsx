import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import TwilioWire from '../TwilioWire';

vi.mock('@/integrations/supabase/client.ts', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { numbers: [] }, error: null }),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('TwilioWire', () => {
  it('renders voice frontdoor webhook for Twilio wiring', async () => {
    render(<TwilioWire />);
    expect(
      await screen.findByText(/functions\/v1\/voice-frontdoor/i)
    ).toBeInTheDocument();
  });
});
