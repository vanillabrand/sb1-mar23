abstract class BaseService {
  protected async executeOperation<T>(
    operation: string,
    handler: () => Promise<T>
  ): Promise<T> {
    const isDemo = demoService.isInDemoMode();
    
    try {
      // Log operation start
      logService.log('debug', `Starting ${operation}`, { isDemo }, this.constructor.name);
      
      // Execute appropriate handler based on mode
      const result = await handler();
      
      // Add demo flag to results if needed
      if (isDemo && typeof result === 'object') {
        result.isDemoTrade = true;
      }
      
      return result;
    } catch (error) {
      logService.log('error', `Error in ${operation}`, error, this.constructor.name);
      throw error;
    }
  }

  protected getExchangeInstance() {
    return demoService.isInDemoMode() 
      ? demoService.getTestNetExchange()
      : exchangeService.getActiveExchange();
  }

  protected emitEvent(eventName: string, payload: any) {
    const enhancedPayload = {
      ...payload,
      isDemoTrade: demoService.isInDemoMode(),
      timestamp: Date.now()
    };
    
    eventBus.emit(eventName, enhancedPayload);
    websocketService.emit(eventName, enhancedPayload);
  }
}