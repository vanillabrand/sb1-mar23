import { supabase } from './supabase';
import { logService } from './log-service';

/**
 * Utility to inspect the database schema
 */
export async function inspectSchema(tableName: string): Promise<void> {
  try {
    // Query the information_schema to get column information
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', tableName);
    
    if (error) {
      logService.log('error', `Failed to inspect schema for table ${tableName}`, error, 'SchemaInspector');
      return;
    }
    
    logService.log('info', `Schema for table ${tableName}:`, data, 'SchemaInspector');
  } catch (error) {
    logService.log('error', `Error inspecting schema for table ${tableName}`, error, 'SchemaInspector');
  }
}

/**
 * Utility to inspect a specific table's data
 */
export async function inspectTable(tableName: string, limit: number = 1): Promise<void> {
  try {
    // Query the table to get a sample row
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);
    
    if (error) {
      logService.log('error', `Failed to inspect data for table ${tableName}`, error, 'SchemaInspector');
      return;
    }
    
    if (data && data.length > 0) {
      // Log the column names from the first row
      const columns = Object.keys(data[0]);
      logService.log('info', `Columns in table ${tableName}:`, columns, 'SchemaInspector');
      
      // Log a sample row
      logService.log('info', `Sample data from table ${tableName}:`, data[0], 'SchemaInspector');
    } else {
      logService.log('info', `No data found in table ${tableName}`, null, 'SchemaInspector');
    }
  } catch (error) {
    logService.log('error', `Error inspecting data for table ${tableName}`, error, 'SchemaInspector');
  }
}
