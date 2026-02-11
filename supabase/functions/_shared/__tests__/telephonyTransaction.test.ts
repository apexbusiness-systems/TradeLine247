import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelephonyTransaction, RollbackAction } from '../telephonyTransaction.ts';
import * as twilio from '../twilio.ts';

// Mock Supabase Client
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

const mockSupabase = {
  rpc: mockRpc,
  from: mockFrom
} as any;

// Mock Twilio functions
vi.mock('../twilio.ts', () => ({
  releaseNumber: vi.fn(),
  closeSubaccount: vi.fn(),
  TwilioAuth: {},
}));

describe('TelephonyTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({
      delete: mockDelete,
      update: mockUpdate
    });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });

  it('should process release_number rollback action', async () => {
    const tx = new TelephonyTransaction(mockSupabase, 'test_tx', 'org_123');
    const action: RollbackAction = {
      type: 'release_number',
      payload: {
        subSid: 'sub_123',
        phoneNumberSid: 'pn_123',
        accountSid: 'acc_123',
        authToken: 'auth_123'
      }
    };

    await tx.processRollbackAction(action);

    expect(twilio.releaseNumber).toHaveBeenCalledWith(
      expect.objectContaining({ accountSid: 'acc_123', authToken: 'auth_123' }),
      'sub_123',
      'pn_123'
    );
  });

  it('should process close_subaccount rollback action', async () => {
    const tx = new TelephonyTransaction(mockSupabase, 'test_tx', 'org_123');
    const action: RollbackAction = {
      type: 'close_subaccount',
      payload: {
        subSid: 'sub_123',
        accountSid: 'acc_123',
        authToken: 'auth_123'
      }
    };

    await tx.processRollbackAction(action);

    expect(twilio.closeSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountSid: 'acc_123', authToken: 'auth_123' }),
      'sub_123'
    );
  });

  it('should process delete_supabase_row rollback action', async () => {
    const tx = new TelephonyTransaction(mockSupabase, 'test_tx', 'org_123');
    const action: RollbackAction = {
      type: 'delete_supabase_row',
      payload: {
        table: 'some_table',
        filter: { column: 'id', value: 'row_123' }
      }
    };

    await tx.processRollbackAction(action);

    expect(mockFrom).toHaveBeenCalledWith('some_table');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'row_123');
  });

  it('should execute rollback actions on failure', async () => {
    // Setup generic execute flow
    const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

    // Mock start
    mockRpc.mockResolvedValueOnce({ data: 'tx_123', error: null }); // start
    // Mock fail (called after operation fails)
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // fail
    // Mock rollback
    const rollbackActions: RollbackAction[] = [
      { type: 'delete_supabase_row', payload: { table: 't', filter: { column: 'c', value: 'v' } } }
    ];
    mockRpc.mockResolvedValueOnce({ data: rollbackActions, error: null }); // rollback

    try {
      await TelephonyTransaction.execute(
        mockSupabase,
        'test_tx',
        'org_123',
        operation
      );
    } catch (e: any) {
      expect(e.message).toBe('Operation failed');
    }

    expect(mockRpc).toHaveBeenCalledWith('rollback_telephony_transaction', { p_tx_id: 'tx_123' });
    // Verify processRollbackAction was called (implicitly via side effects)
    expect(mockFrom).toHaveBeenCalledWith('t');
    expect(mockEq).toHaveBeenCalledWith('c', 'v');
  });
});
