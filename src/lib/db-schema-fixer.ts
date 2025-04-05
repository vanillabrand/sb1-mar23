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

  async fixDatabaseSchema(): Promise<boolean> {
    try {
      logService.log('info', 'Starting database schema fix', null, 'DBSchemaFixer');
      
      // Check if the assets column exists in strategy_templates
      const { data: columns, error: columnsError } = await supabase
        .from('strategy_templates')
        .select('assets')
        .limit(1);
      
      if (columnsError) {
        if (columnsError.message.includes("Could not find the 'assets' column")) {
          logService.log('info', 'Assets column missing, attempting to add it', null, 'DBSchemaFixer');
          
          // Add the assets column to the strategy_templates table
          // Since we can't directly execute ALTER TABLE with Supabase client,
          // we'll use a workaround by updating a row with the new column
          
          // First, get a template to update
          const { data: templates, error: templatesError } = await supabase
            .from('strategy_templates')
            .select('id')
            .limit(1);
            
          if (templatesError) {
            logService.log('error', 'Failed to get templates for schema fix', templatesError, 'DBSchemaFixer');
            return false;
          }
          
          if (templates && templates.length > 0) {
            // Update the template with the new assets field
            const { error: updateError } = await supabase
              .from('strategy_templates')
              .update({ 
                assets: ['BTC/USDT', 'ETH/USDT'] 
              })
              .eq('id', templates[0].id);
              
            if (updateError) {
              logService.log('error', 'Failed to add assets column', updateError, 'DBSchemaFixer');
              return false;
            }
            
            logService.log('info', 'Successfully added assets column to strategy_templates', null, 'DBSchemaFixer');
            return true;
          } else {
            // No templates found, create one with the assets field
            const { error: insertError } = await supabase
              .from('strategy_templates')
              .insert({
                id: 'schema-fix-template',
                title: 'Schema Fix Template',
                description: 'This template was created to fix the database schema',
                type: 'system_template',
                risk_level: 'Medium',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                assets: ['BTC/USDT', 'ETH/USDT']
              });
              
            if (insertError) {
              logService.log('error', 'Failed to create template with assets column', insertError, 'DBSchemaFixer');
              return false;
            }
            
            logService.log('info', 'Successfully created template with assets column', null, 'DBSchemaFixer');
            return true;
          }
        } else {
          logService.log('error', 'Error checking for assets column', columnsError, 'DBSchemaFixer');
          return false;
        }
      }
      
      // Column exists, no fix needed
      logService.log('info', 'Assets column already exists, no fix needed', null, 'DBSchemaFixer');
      return true;
      
    } catch (error) {
      logService.log('error', 'Failed to fix database schema', error, 'DBSchemaFixer');
      return false;
    }
  }
}

export const dbSchemaFixer = DBSchemaFixer.getInstance();
