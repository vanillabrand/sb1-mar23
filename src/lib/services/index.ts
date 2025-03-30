import { MonitoringService } from '../monitoring-service';
import { strategyService } from '../strategy-service';
import { tradeService } from '../trade-service';
import { marketService } from '../market-service';
import { tradeGenerator } from '../trade-generator';
import { tradeEngine } from '../trade-engine';
import { logService } from '../log-service';
import { strategyMonitor } from '../strategy-monitor';
import { bitmartService } from '../bitmart-service';
import { marketMonitor } from '../market-monitor';
import { analyticsService } from '../analytics-service';

// Export all services
export { 
    strategyService,
    tradeService,
    marketService,
    tradeGenerator,
    tradeEngine,
    logService,
    strategyMonitor,
    bitmartService,
    marketMonitor,
    analyticsService,
    MonitoringService
};

// Export the singleton instance
export const monitoringService = MonitoringService.getInstance();
