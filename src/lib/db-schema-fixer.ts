import { supabase } from './supabase';
import { logService } from './log-service';

class DBSchemaFixer {
  private static instance: DBSchemaFixer;

  private constructor() {}

  static getInstance(): DBSchemaFixer {
    if (!DBSchemaFixer.instance) {
      DBSchemaFixer.instance = new DBSchemaFixer();
    }
    return DBSchemaFixer.instance;
  }

  async fixStrategyTemplatesSchema(): Promise<void> {
    try {
      // Check if assets column exists
      const { error: columnsError } = await supabase
        .from('strategy_templates')
        .select('assets')
        .limit(1);

      if (columnsError && columnsError.message.includes('column "assets" does not exist')) {
        logService.log('info', 'Assets column missing, attempting to fix schema', null, 'DBSchemaFixer');
        
        // Execute schema fix SQL
        const { error: fixError } = await supabase.rpc('fix_strategy_templates_schema');
        
        if (fixError) {
          logService.log('error', 'Failed to fix strategy templates schema', fixError, 'DBSchemaFixer');
          throw fixError;
        }
        
        logService.log('info', 'Successfully fixed strategy templates schema', null, 'DBSchemaFixer');
      }
    } catch (error) {
      logService.log('error', 'Error fixing strategy templates schema', error, 'DBSchemaFixer');
      throw error;
    }
  }
}

export const dbSchemaFixer = DBSchemaFixer.getInstance();
