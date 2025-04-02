import { supabase } from './supabase';
import { logService } from './log-service';

/**
 * Directly delete a strategy and all its related records from the database
 * This is a nuclear option that bypasses all normal deletion logic
 * @param strategyId The ID of the strategy to delete
 */
export async function directDeleteStrategy(strategyId: string): Promise<boolean> {
  console.log(`NUCLEAR DELETION: Strategy ${strategyId}`);

  try {
    // 0. Get current user session and verify ownership
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      console.error('No authenticated user found');
      return false;
    }

    const userId = session.user.id;

    // Verify that the strategy belongs to the current user
    const { data: strategyData, error: verifyError } = await supabase
      .from('strategies')
      .select('id, user_id')
      .eq('id', strategyId)
      .single();

    if (verifyError) {
      console.error(`Error verifying strategy ownership: ${verifyError.message}`);
      return false;
    }

    if (!strategyData) {
      console.error(`Strategy ${strategyId} not found`);
      return false;
    }

    if (strategyData.user_id !== userId) {
      console.error(`Strategy ${strategyId} does not belong to the current user`);
      return false;
    }

    console.log(`Verified ownership of strategy ${strategyId} for user ${userId}`);

    // 1. First, delete all trades for this strategy
    console.log(`Step 1: Deleting trades for strategy ${strategyId}`);
    try {
      const { error: tradesError } = await supabase
        .from('trades')
        .delete()
        .eq('strategy_id', strategyId);

      if (tradesError) {
        // Check if the error is because the trades table doesn't exist
        if (tradesError.message.includes('relation "trades" does not exist')) {
          console.log('Trades table does not exist, skipping trade deletion');
        } else {
          console.warn(`Error deleting trades: ${tradesError.message}`);
        }
      } else {
        console.log(`Successfully deleted trades for strategy ${strategyId}`);
      }
    } catch (e) {
      console.warn(`Exception deleting trades: ${e}`);
    }

    // 2. Delete any trade signals
    console.log(`Step 2: Deleting trade signals for strategy ${strategyId}`);
    try {
      const { error: signalsError } = await supabase
        .from('trade_signals')
        .delete()
        .eq('strategy_id', strategyId);

      if (signalsError) {
        // Check if the error is because the trade_signals table doesn't exist
        if (signalsError.message.includes('relation "trade_signals" does not exist')) {
          console.log('Trade signals table does not exist, skipping trade signals deletion');
        } else {
          console.warn(`Error deleting trade signals: ${signalsError.message}`);
        }
      } else {
        console.log(`Successfully deleted trade signals for strategy ${strategyId}`);
      }
    } catch (e) {
      console.warn(`Exception deleting trade signals: ${e}`);
    }

    // 3. Delete any monitoring status records
    console.log(`Step 3: Deleting monitoring status for strategy ${strategyId}`);
    try {
      const { error: monitoringError } = await supabase
        .from('monitoring_status')
        .delete()
        .eq('strategy_id', strategyId);

      if (monitoringError) {
        // Check if the error is because the monitoring_status table doesn't exist
        if (monitoringError.message.includes('relation "monitoring_status" does not exist')) {
          console.log('Monitoring status table does not exist, skipping monitoring status deletion');
        } else {
          console.warn(`Error deleting monitoring status: ${monitoringError.message}`);
        }
      } else {
        console.log(`Successfully deleted monitoring status for strategy ${strategyId}`);
      }
    } catch (e) {
      console.warn(`Exception deleting monitoring status: ${e}`);
    }

    // 4. Delete any strategy performance records
    console.log(`Step 4: Deleting performance records for strategy ${strategyId}`);
    try {
      const { error: performanceError } = await supabase
        .from('strategy_performance')
        .delete()
        .eq('strategy_id', strategyId);

      if (performanceError) {
        console.warn(`Error deleting performance records: ${performanceError.message}`);
      } else {
        console.log(`Successfully deleted performance records for strategy ${strategyId}`);
      }
    } catch (e) {
      console.warn(`Exception deleting performance records: ${e}`);
    }

    // 5. Delete the strategy itself
    console.log(`Step 5: Deleting strategy ${strategyId}`);
    const { error: strategyError } = await supabase
      .from('strategies')
      .delete()
      .eq('id', strategyId)
      .eq('user_id', userId); // Ensure we only delete if it belongs to the current user

    if (strategyError) {
      console.error(`Error deleting strategy: ${strategyError.message}`);

      // Try a raw SQL delete as a last resort
      console.log(`Attempting raw SQL delete for strategy ${strategyId}`);
      try {
        // This requires the execute_sql function to be created in Supabase
        const { error: sqlError } = await supabase.rpc('execute_sql', {
          query: `DELETE FROM strategies WHERE id = '${strategyId}' AND user_id = '${userId}'`
        });

        if (sqlError) {
          console.error(`Raw SQL delete failed: ${sqlError.message}`);
          return false;
        } else {
          console.log(`Successfully deleted strategy ${strategyId} via raw SQL`);
          return true;
        }
      } catch (sqlExecError) {
        console.error(`SQL execution error: ${sqlExecError}`);
        return false;
      }
    } else {
      console.log(`Successfully deleted strategy ${strategyId}`);
      return true;
    }
  } catch (error) {
    console.error(`Unexpected error in directDeleteStrategy: ${error}`);
    logService.log('error', `Failed to delete strategy ${strategyId}`, error, 'directDeleteStrategy');
    return false;
  }
}
