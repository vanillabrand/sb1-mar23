/**
 * Performance Optimizer Service
 * 
 * This service provides utilities to optimize JavaScript execution,
 * reduce main thread blocking, and improve overall application performance.
 */

import { logService } from './log-service';

interface TaskOptions {
  priority?: 'high' | 'normal' | 'low' | 'background';
  timeout?: number;
  signal?: AbortSignal;
}

interface ScheduledTask {
  id: string;
  task: () => Promise<any>;
  priority: number;
  createdAt: number;
  timeout?: number;
  signal?: AbortSignal;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

interface PerformanceMetrics {
  taskExecutionTimes: Map<string, number[]>;
  longTasks: {
    taskId: string;
    duration: number;
    timestamp: number;
  }[];
  frameDrops: {
    timestamp: number;
    frameDelta: number;
  }[];
  memoryUsage: {
    timestamp: number;
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  }[];
}

class PerformanceOptimizer {
  private taskQueue: ScheduledTask[] = [];
  private isProcessingQueue: boolean = false;
  private idCounter: number = 0;
  private metrics: PerformanceMetrics = {
    taskExecutionTimes: new Map(),
    longTasks: [],
    frameDrops: [],
    memoryUsage: []
  };
  private lastFrameTime: number = 0;
  private isMonitoring: boolean = false;
  private monitoringInterval: number | null = null;
  
  // Priority values (higher = more important)
  private readonly PRIORITY_HIGH = 3;
  private readonly PRIORITY_NORMAL = 2;
  private readonly PRIORITY_LOW = 1;
  private readonly PRIORITY_BACKGROUND = 0;
  
  // Constants
  private readonly LONG_TASK_THRESHOLD = 50; // ms
  private readonly FRAME_DROP_THRESHOLD = 33; // ms (30fps)
  private readonly MONITORING_INTERVAL = 10000; // 10 seconds
  
  constructor() {
    // Initialize performance monitoring
    this.initPerformanceMonitoring();
  }
  
  /**
   * Schedule a task to run with the specified priority
   * @param task Function to execute
   * @param options Task options
   * @returns Promise that resolves with the task result
   */
  scheduleTask<T>(task: () => Promise<T> | T, options: TaskOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      // Convert priority string to number
      let priorityValue: number;
      switch (options.priority) {
        case 'high':
          priorityValue = this.PRIORITY_HIGH;
          break;
        case 'low':
          priorityValue = this.PRIORITY_LOW;
          break;
        case 'background':
          priorityValue = this.PRIORITY_BACKGROUND;
          break;
        case 'normal':
        default:
          priorityValue = this.PRIORITY_NORMAL;
          break;
      }
      
      // Generate task ID
      const taskId = `task-${++this.idCounter}`;
      
      // Create scheduled task
      const scheduledTask: ScheduledTask = {
        id: taskId,
        task: () => Promise.resolve().then(() => task()),
        priority: priorityValue,
        createdAt: Date.now(),
        timeout: options.timeout,
        signal: options.signal,
        resolve,
        reject
      };
      
      // Add to queue
      this.taskQueue.push(scheduledTask);
      
      // Sort queue by priority (higher first) and then by creation time
      this.taskQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      });
      
      // Start processing queue if not already processing
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Run a function during browser idle time
   * @param callback Function to execute
   * @param options Idle callback options
   * @returns Promise that resolves when the function is executed
   */
  runWhenIdle<T>(callback: () => T, options?: { timeout?: number }): Promise<T> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        // Use requestIdleCallback if available
        (window as any).requestIdleCallback(
          (deadline: { timeRemaining: () => number; didTimeout: boolean }) => {
            try {
              const result = callback();
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          { timeout: options?.timeout || 1000 }
        );
      } else {
        // Fallback to setTimeout with low priority
        this.scheduleTask(callback, { priority: 'background' })
          .then(resolve)
          .catch(reject);
      }
    });
  }
  
  /**
   * Run a function during the next animation frame
   * @param callback Function to execute
   * @returns Promise that resolves when the function is executed
   */
  runOnNextFrame<T>(callback: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        window.requestAnimationFrame(() => {
          try {
            const result = callback();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      } else {
        // Fallback to setTimeout with high priority
        this.scheduleTask(callback, { priority: 'high' })
          .then(resolve)
          .catch(reject);
      }
    });
  }
  
  /**
   * Debounce a function
   * @param func Function to debounce
   * @param wait Wait time in milliseconds
   * @param immediate Execute on the leading edge instead of trailing
   * @returns Debounced function
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate: boolean = false
  ): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    
    return (...args: Parameters<T>): void => {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      
      timeout = window.setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  }
  
  /**
   * Throttle a function
   * @param func Function to throttle
   * @param limit Limit in milliseconds
   * @returns Throttled function
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeout: number | null = null;
    
    return (...args: Parameters<T>): void => {
      const now = Date.now();
      
      if (now - lastCall < limit) {
        // If we're within the limit, clear any existing timeout
        if (timeout !== null) {
          clearTimeout(timeout);
        }
        
        // Schedule the function to run at the end of the limit
        timeout = window.setTimeout(() => {
          lastCall = Date.now();
          func(...args);
          timeout = null;
        }, limit - (now - lastCall));
      } else {
        // If we're outside the limit, run immediately
        lastCall = now;
        func(...args);
      }
    };
  }
  
  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    
    // Start monitoring interval
    this.monitoringInterval = window.setInterval(() => {
      this.collectMemoryMetrics();
      this.logPerformanceMetrics();
    }, this.MONITORING_INTERVAL);
    
    logService.log('info', 'Started performance monitoring', null, 'PerformanceOptimizer');
  }
  
  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    // Clear monitoring interval
    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logService.log('info', 'Stopped performance monitoring', null, 'PerformanceOptimizer');
  }
  
  /**
   * Get performance metrics
   * @returns Performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.metrics;
  }
  
  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.taskQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Get next task
      const task = this.taskQueue.shift();
      
      if (!task) {
        this.isProcessingQueue = false;
        return;
      }
      
      // Check if task is aborted
      if (task.signal?.aborted) {
        task.reject(new Error('Task aborted'));
        this.isProcessingQueue = false;
        this.processQueue();
        return;
      }
      
      // Execute task with timeout
      try {
        const startTime = performance.now();
        
        // Create timeout promise if needed
        const timeoutPromise = task.timeout
          ? new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Task timed out')), task.timeout);
            })
          : null;
        
        // Execute task with timeout if specified
        const result = await (timeoutPromise
          ? Promise.race([task.task(), timeoutPromise])
          : task.task());
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Record task execution time
        if (!this.metrics.taskExecutionTimes.has(task.id)) {
          this.metrics.taskExecutionTimes.set(task.id, []);
        }
        this.metrics.taskExecutionTimes.get(task.id)!.push(duration);
        
        // Check if this was a long task
        if (duration > this.LONG_TASK_THRESHOLD) {
          this.metrics.longTasks.push({
            taskId: task.id,
            duration,
            timestamp: Date.now()
          });
          
          logService.log('warn', `Long task detected: ${task.id} (${Math.round(duration)}ms)`, null, 'PerformanceOptimizer');
        }
        
        // Resolve task
        task.resolve(result);
      } catch (error) {
        // Reject task
        task.reject(error);
      }
    } finally {
      this.isProcessingQueue = false;
      
      // Continue processing queue if there are more tasks
      if (this.taskQueue.length > 0) {
        // Use setTimeout to avoid blocking the main thread
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }
  
  /**
   * Initialize performance monitoring
   */
  private initPerformanceMonitoring(): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Monitor frame rate
    let lastFrameTime = performance.now();
    
    const frameCallback = () => {
      const now = performance.now();
      const frameDelta = now - lastFrameTime;
      
      // Check for frame drops
      if (frameDelta > this.FRAME_DROP_THRESHOLD) {
        this.metrics.frameDrops.push({
          timestamp: now,
          frameDelta
        });
      }
      
      lastFrameTime = now;
      requestAnimationFrame(frameCallback);
    };
    
    requestAnimationFrame(frameCallback);
    
    // Collect initial memory metrics
    this.collectMemoryMetrics();
  }
  
  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(): void {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }
    
    // Check if memory info is available
    const performance = window.performance as any;
    if (performance.memory) {
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      });
      
      // Keep only the last 100 memory measurements
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage.shift();
      }
    }
  }
  
  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    // Calculate average task execution times
    const avgExecutionTimes: { [taskId: string]: number } = {};
    
    this.metrics.taskExecutionTimes.forEach((times, taskId) => {
      if (times.length > 0) {
        const sum = times.reduce((acc, time) => acc + time, 0);
        avgExecutionTimes[taskId] = sum / times.length;
      }
    });
    
    // Count recent frame drops
    const recentFrameDrops = this.metrics.frameDrops.filter(
      drop => Date.now() - drop.timestamp < this.MONITORING_INTERVAL
    ).length;
    
    // Get latest memory usage
    const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    
    // Log metrics
    logService.log('info', 'Performance metrics', {
      longTasks: this.metrics.longTasks.length,
      recentFrameDrops,
      memoryUsage: latestMemory,
      avgExecutionTimes
    }, 'PerformanceOptimizer');
    
    // Clear old metrics
    this.metrics.longTasks = this.metrics.longTasks.slice(-20);
    this.metrics.frameDrops = this.metrics.frameDrops.slice(-100);
  }
}

// Export a singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
