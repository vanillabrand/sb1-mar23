import { inspectSchema, inspectTable } from './schema-inspector';

// Inspect the strategy_templates table
export async function inspectStrategyTemplates(): Promise<void> {
  await inspectSchema('strategy_templates');
  await inspectTable('strategy_templates');
}

// Call the function
inspectStrategyTemplates();
