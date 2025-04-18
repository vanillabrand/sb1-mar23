/**
 * Performance Monitor
 * 
 * This module provides utilities for measuring and reporting application performance.
 */

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private startTimes: Map<string, number> = new Map();
  private endTimes: Map<string, number> = new Map();
  private durations: Map<string, number> = new Map();
  private isEnabled: boolean = true;

  private constructor() {
    // Start measuring app initialization time immediately
    this.startMeasurement('app_initialization');
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start measuring performance for a specific operation
   * @param operationName The name of the operation to measure
   */
  startMeasurement(operationName: string): void {
    if (!this.isEnabled) return;
    
    this.startTimes.set(operationName, performance.now());
    console.log(`[Performance] Started measuring: ${operationName}`);
  }

  /**
   * End measuring performance for a specific operation
   * @param operationName The name of the operation to measure
   * @returns The duration in milliseconds
   */
  endMeasurement(operationName: string): number {
    if (!this.isEnabled) return 0;
    
    const endTime = performance.now();
    this.endTimes.set(operationName, endTime);
    
    const startTime = this.startTimes.get(operationName);
    if (startTime === undefined) {
      console.warn(`[Performance] No start time found for: ${operationName}`);
      return 0;
    }
    
    const duration = endTime - startTime;
    this.durations.set(operationName, duration);
    
    console.log(`[Performance] ${operationName}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Get the duration of a specific operation
   * @param operationName The name of the operation
   * @returns The duration in milliseconds, or undefined if not measured
   */
  getDuration(operationName: string): number | undefined {
    return this.durations.get(operationName);
  }

  /**
   * Get all measured durations
   * @returns A map of operation names to durations
   */
  getAllDurations(): Map<string, number> {
    return new Map(this.durations);
  }

  /**
   * Report all measured durations to the console
   */
  reportAllDurations(): void {
    if (!this.isEnabled) return;
    
    console.group('[Performance Report]');
    
    const sortedDurations = Array.from(this.durations.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by duration (descending)
    
    sortedDurations.forEach(([operation, duration]) => {
      console.log(`${operation}: ${duration.toFixed(2)}ms`);
    });
    
    console.groupEnd();
  }

  /**
   * Enable or disable performance monitoring
   * @param enabled Whether performance monitoring should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if performance monitoring is enabled
   * @returns Whether performance monitoring is enabled
   */
  isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.startTimes.clear();
    this.endTimes.clear();
    this.durations.clear();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
