// Telephony Transaction Manager
// Provides atomic multi-step operations with rollback

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { releaseNumber, closeSubaccount, TwilioAuth } from "./twilio.ts";

export type RollbackActionType =
  | 'release_number'
  | 'close_subaccount'
  | 'delete_supabase_row'
  | 'update_supabase_row';

export interface RollbackAction {
  type: RollbackActionType;
  payload: any;
}

export interface TransactionStep {
  step: string;
  data: any;
  rollbackAction?: RollbackAction;
}

export class TelephonyTransaction {
  private txId: string | null = null;
  private supabase: SupabaseClient;
  private transactionType: string;
  private orgId: string;
  private metadata: any;

  constructor(
    supabase: SupabaseClient,
    transactionType: string,
    orgId: string,
    metadata: any = {}
  ) {
    this.supabase = supabase;
    this.transactionType = transactionType;
    this.orgId = orgId;
    this.metadata = metadata;
  }

  /**
   * Start the transaction
   */
  async start(): Promise<string> {
    const { data, error } = await this.supabase.rpc('start_telephony_transaction', {
      p_transaction_type: this.transactionType,
      p_org_id: this.orgId,
      p_metadata: this.metadata
    });

    if (error) {
      throw new Error(`Failed to start transaction: ${error.message}`);
    }

    this.txId = data as string;
    console.log(`Transaction started: ${this.txId} (${this.transactionType})`);
    return this.txId;
  }

  /**
   * Record a completed step
   */
  async recordStep(stepName: string, stepData: any, rollbackAction?: any): Promise<void> {
    if (!this.txId) {
      throw new Error('Transaction not started');
    }

    const { error } = await this.supabase.rpc('record_transaction_step', {
      p_tx_id: this.txId,
      p_step_name: stepName,
      p_step_data: stepData,
      p_rollback_action: rollbackAction || null
    });

    if (error) {
      console.error(`Failed to record step ${stepName}:`, error);
      // Don't throw - allow operation to continue
    } else {
      console.log(`Transaction step recorded: ${stepName}`);
    }
  }

  /**
   * Complete the transaction
   */
  async complete(): Promise<void> {
    if (!this.txId) {
      throw new Error('Transaction not started');
    }

    const { error } = await this.supabase.rpc('complete_telephony_transaction', {
      p_tx_id: this.txId
    });

    if (error) {
      console.error('Failed to complete transaction:', error);
    } else {
      console.log(`Transaction completed: ${this.txId}`);
    }
  }

  /**
   * Fail the transaction
   */
  async fail(errorMessage: string): Promise<void> {
    if (!this.txId) {
      throw new Error('Transaction not started');
    }

    const { error } = await this.supabase.rpc('fail_telephony_transaction', {
      p_tx_id: this.txId,
      p_error_message: errorMessage
    });

    if (error) {
      console.error('Failed to mark transaction as failed:', error);
    } else {
      console.log(`Transaction failed: ${this.txId} - ${errorMessage}`);
    }
  }

  /**
   * Rollback the transaction
   */
  async rollback(): Promise<RollbackAction[]> {
    if (!this.txId) {
      throw new Error('Transaction not started');
    }

    const { data, error } = await this.supabase.rpc('rollback_telephony_transaction', {
      p_tx_id: this.txId
    });

    if (error) {
      console.error('Failed to rollback transaction:', error);
      return [];
    }

    console.log(`Transaction rolled back: ${this.txId}`);
    return data as RollbackAction[];
  }

  /**
   * Process a single rollback action
   */
  async processRollbackAction(action: RollbackAction): Promise<void> {
    console.log(`Processing rollback action: ${action.type}`, action.payload);

    try {
      switch (action.type) {
        case 'release_number': {
          const { subSid, phoneNumberSid, accountSid, authToken } = action.payload;
          if (!subSid || !phoneNumberSid) throw new Error('Missing payload for release_number');

          const auth: TwilioAuth = {
            accountSid: accountSid || Deno.env.get("TWILIO_ACCOUNT_SID") || "",
            authToken: authToken || Deno.env.get("TWILIO_AUTH_TOKEN") || ""
          };

          if (!auth.accountSid || !auth.authToken) {
            throw new Error('Twilio credentials missing for rollback');
          }

          await releaseNumber(auth, subSid, phoneNumberSid);
          break;
        }
        case 'close_subaccount': {
          const { subSid, accountSid, authToken } = action.payload;
          if (!subSid) throw new Error('Missing subSid for close_subaccount');

          const auth: TwilioAuth = {
            accountSid: accountSid || Deno.env.get("TWILIO_ACCOUNT_SID") || "",
            authToken: authToken || Deno.env.get("TWILIO_AUTH_TOKEN") || ""
          };

          await closeSubaccount(auth, subSid);
          break;
        }
        case 'delete_supabase_row': {
          const { table, filter } = action.payload;
          if (!table || !filter || !filter.column || !filter.value) {
            throw new Error('Invalid payload for delete_supabase_row');
          }

          const { error } = await this.supabase
            .from(table)
            .delete()
            .eq(filter.column, filter.value);

          if (error) throw error;
          break;
        }
        case 'update_supabase_row': {
          const { table, data, filter } = action.payload;
          if (!table || !data || !filter || !filter.column || !filter.value) {
            throw new Error('Invalid payload for update_supabase_row');
          }

          const { error } = await this.supabase
            .from(table)
            .update(data)
            .eq(filter.column, filter.value);

          if (error) throw error;
          break;
        }
        default:
          console.warn(`Unknown rollback action type: ${(action as any).type}`);
      }
    } catch (error) {
      console.error(`Failed to execute rollback action ${action.type}:`, error);
      throw error;
    }
  }

  /**
   * Execute transaction with automatic rollback on failure
   */
  static async execute<T>(
    supabase: SupabaseClient,
    transactionType: string,
    orgId: string,
    operation: (tx: TelephonyTransaction) => Promise<T>,
    metadata: any = {}
  ): Promise<T> {
    const tx = new TelephonyTransaction(supabase, transactionType, orgId, metadata);

    try {
      await tx.start();
      const result = await operation(tx);
      await tx.complete();
      return result;
    } catch (error) {
      console.error('Transaction operation failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      await tx.fail(errorMsg);

      // Attempt rollback
      try {
        const rollbackActions = await tx.rollback();
        console.log('Rollback actions to execute:', rollbackActions);

        for (const action of rollbackActions) {
          try {
            await tx.processRollbackAction(action);
          } catch (e) {
            console.error(`Rollback action failed:`, e);
            // Continue with other actions despite failure
          }
        }
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      throw error;
    }
  }
}
