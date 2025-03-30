const copyTemplate = async (templateId: string) => {
  try {
    await templateManager.copyTemplateToUserStrategy(templateId, user.id);
    
    // Force refresh all strategies
    await Promise.all([
      strategySync.initialize(),
      marketService.syncStrategies(),
      tradeManager.syncTrades()
    ]);
    
    // Emit event for real-time updates
    eventBus.emit('strategy:created');
    
    toast.success('Strategy template copied successfully!');
  } catch (error) {
    toast.error('Failed to copy template');
    console.error('Copy template error:', error);
  }
};
