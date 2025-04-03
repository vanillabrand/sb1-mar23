import { supabase } from './supabase';
import { logService } from './log-service';

export class DbSchemaFixer {
  private static instance: DbSchemaFixer;
  private isFixing = false;

  private constructor() {}

  static getInstance(): DbSchemaFixer {
    if (!DbSchemaFixer.instance) {
      DbSchemaFixer.instance = new DbSchemaFixer();
    }
    return DbSchemaFixer.instance;
  }

  async fixDatabaseSchema(): Promise<boolean> {
    if (this.isFixing) {
      logService.log('info', 'Database schema fix already in progress', null, 'DbSchemaFixer');
      return false;
    }

    try {
      this.isFixing = true;
      logService.log('info', 'Starting database schema fix', null, 'DbSchemaFixer');

      // Check if the strategies table exists
      const { error: tableError } = await supabase
        .from('strategies')
        .select('id')
        .limit(1);

      if (tableError) {
        logService.log('warn', 'Error checking strategies table', tableError, 'DbSchemaFixer');
        // Table might not exist, we'll create it
      }

      // Add title column to strategies table if it doesn't exist
      try {
        const { error: alterError } = await supabase.rpc('execute_sql', {
          query: `
            DO $$
            BEGIN
              -- Add title column if it doesn't exist
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'strategies' AND column_name = 'title'
              ) THEN
                ALTER TABLE strategies ADD COLUMN "title" TEXT;
                RAISE NOTICE 'Added title column to strategies table';
              ELSE
                RAISE NOTICE 'title column already exists in strategies table';
              END IF;

              -- Add name column if it doesn't exist
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'strategies' AND column_name = 'name'
              ) THEN
                ALTER TABLE strategies ADD COLUMN "name" TEXT;
                RAISE NOTICE 'Added name column to strategies table';
              ELSE
                RAISE NOTICE 'name column already exists in strategies table';
              END IF;
            END $$;
          `
        });

        if (alterError) {
          logService.log('error', 'Failed to add title column', alterError, 'DbSchemaFixer');

          // If the execute_sql function doesn't exist, we need to create it
          if (alterError.message && alterError.message.includes('function execute_sql() does not exist')) {
            logService.log('info', 'Creating execute_sql function', null, 'DbSchemaFixer');

            // Create the execute_sql function
            const { error: createFunctionError } = await supabase.rpc('create_execute_sql_function', {});

            if (createFunctionError) {
              // If this fails too, we're out of options through the API
              logService.log('error', 'Failed to create execute_sql function', createFunctionError, 'DbSchemaFixer');
              return false;
            }

            // Try again with the newly created function
            const { error: retryError } = await supabase.rpc('execute_sql', {
              query: `ALTER TABLE strategies ADD COLUMN IF NOT EXISTS "title" TEXT;`
            });

            if (retryError) {
              logService.log('error', 'Failed to add title column after creating function', retryError, 'DbSchemaFixer');
              return false;
            }
          } else {
            return false;
          }
        }
      } catch (error) {
        logService.log('error', 'Exception adding title column', error, 'DbSchemaFixer');
        return false;
      }

      // Add description column to strategies table if it doesn't exist
      try {
        const { error: alterError } = await supabase.rpc('execute_sql', {
          query: `ALTER TABLE strategies ADD COLUMN IF NOT EXISTS description TEXT;`
        });

        if (alterError) {
          logService.log('error', 'Failed to add description column', alterError, 'DbSchemaFixer');
          return false;
        }
      } catch (error) {
        logService.log('error', 'Exception adding description column', error, 'DbSchemaFixer');
        return false;
      }

      // Add risk_level column to strategies table if it doesn't exist
      try {
        const { error: alterError } = await supabase.rpc('execute_sql', {
          query: `ALTER TABLE strategies ADD COLUMN IF NOT EXISTS risk_level TEXT;`
        });

        if (alterError) {
          logService.log('error', 'Failed to add risk_level column', alterError, 'DbSchemaFixer');
          return false;
        }
      } catch (error) {
        logService.log('error', 'Exception adding risk_level column', error, 'DbSchemaFixer');
        return false;
      }

      // Add selected_pairs column to strategies table if it doesn't exist
      try {
        const { error: alterError } = await supabase.rpc('execute_sql', {
          query: `ALTER TABLE strategies ADD COLUMN IF NOT EXISTS selected_pairs JSONB DEFAULT '[]'::JSONB;`
        });

        if (alterError) {
          logService.log('error', 'Failed to add selected_pairs column', alterError, 'DbSchemaFixer');
          return false;
        }
      } catch (error) {
        logService.log('error', 'Exception adding selected_pairs column', error, 'DbSchemaFixer');
        return false;
      }

      // Add strategy_config column to strategies table if it doesn't exist
      try {
        const { error: alterError } = await supabase.rpc('execute_sql', {
          query: `ALTER TABLE strategies ADD COLUMN IF NOT EXISTS strategy_config JSONB DEFAULT '{}'::JSONB;`
        });

        if (alterError) {
          logService.log('error', 'Failed to add strategy_config column', alterError, 'DbSchemaFixer');
          return false;
        }
      } catch (error) {
        logService.log('error', 'Exception adding strategy_config column', error, 'DbSchemaFixer');
        return false;
      }

      // Refresh the schema cache to ensure the new columns are recognized
      try {
        const { error: refreshError } = await supabase.rpc('execute_sql', {
          query: `SELECT pg_catalog.pg_reload_conf();`
        });

        if (refreshError) {
          logService.log('error', 'Failed to refresh schema cache', refreshError, 'DbSchemaFixer');
          return false;
        }
      } catch (error) {
        logService.log('error', 'Exception refreshing schema cache', error, 'DbSchemaFixer');
        return false;
      }

      logService.log('info', 'Database schema fix completed successfully', null, 'DbSchemaFixer');
      return true;
    } catch (error) {
      logService.log('error', 'Failed to fix database schema', error, 'DbSchemaFixer');
      return false;
    } finally {
      this.isFixing = false;
    }
  }
}

export const dbSchemaFixer = DbSchemaFixer.getInstance();
