import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { templateService } from './template-service';
import type { StrategyTemplate } from './types';

class TemplateSync extends EventEmitter {
  private static instance: TemplateSync;
  private templates = new Map<string, StrategyTemplate>();
  private syncInProgress = false;
  private initialized = false;
  private lastSyncTime = 0;
  private readonly SYNC_INTERVAL = 300000; // 5 minutes
  private syncIntervalId: NodeJS.Timeout | null = null;

  private constructor() {
    super();
  }

  static getInstance(): TemplateSync {
    if (!TemplateSync.instance) {
      TemplateSync.instance = new TemplateSync();
    }
    return TemplateSync.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized || this.syncInProgress) return;
    
    try {
      this.syncInProgress = true;
      logService.log('info', 'Initializing template sync', null, 'TemplateSync');

      // Load all templates from the template service.
      const templates = await templateService.getTemplates();

      // Clear existing cache and update it with new templates.
      this.templates.clear();
      templates.forEach(template => {
        this.templates.set(template.id, template);
      });

      this.lastSyncTime = Date.now();
      this.initialized = true;
      this.emit('syncComplete');

      // Start periodic sync.
      this.startPeriodicSync();

      logService.log('info', 'Template sync initialized successfully', null, 'TemplateSync');
    } catch (error) {
      logService.log('error', 'Failed to initialize template sync', error, 'TemplateSync');
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  private startPeriodicSync() {
    // Clear any existing interval.
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    // Start a new periodic sync interval.
    this.syncIntervalId = setInterval(() => {
      if (Date.now() - this.lastSyncTime >= this.SYNC_INTERVAL) {
        this.syncAll();
      }
    }, this.SYNC_INTERVAL);
  }

  async syncAll(): Promise<void> {
    if (this.syncInProgress) return;
    
    try {
      this.syncInProgress = true;
      logService.log('info', 'Starting full template sync', null, 'TemplateSync');

      const templates = await templateService.getTemplates();

      // Update cache with the latest templates.
      templates.forEach(template => {
        this.templates.set(template.id, template);
      });

      this.lastSyncTime = Date.now();
      this.emit('syncComplete');
    } catch (error) {
      logService.log('error', 'Failed to sync all templates', error, 'TemplateSync');
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  getTemplate(id: string): StrategyTemplate | null {
    return this.templates.get(id) || null;
  }

  getAllTemplates(): StrategyTemplate[] {
    return Array.from(this.templates.values());
  }

  hasTemplate(id: string): boolean {
    return this.templates.has(id);
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  cleanup() {
    // Clear the periodic sync interval.
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    this.templates.clear();
    this.syncInProgress = false;
    this.initialized = false;
    this.lastSyncTime = 0;
  }
}

export const templateSync = TemplateSync.getInstance();
