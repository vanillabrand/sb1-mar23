import { EventEmitter } from './event-emitter';

export interface InitializationStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number;
  message?: string;
}

class InitializationProgress extends EventEmitter {
  private static instance: InitializationProgress;
  private steps: Map<string, InitializationStep> = new Map();
  private totalProgress: number = 0;

  private constructor() {
    super();
  }

  static getInstance(): InitializationProgress {
    if (!InitializationProgress.instance) {
      InitializationProgress.instance = new InitializationProgress();
    }
    return InitializationProgress.instance;
  }

  addStep(id: string, name: string): void {
    this.steps.set(id, {
      id,
      name,
      status: 'pending',
      progress: 0
    });
    this.emit('stepAdded', this.steps.get(id));
    this.updateTotalProgress();
  }

  startStep(id: string): void {
    const step = this.steps.get(id);
    if (step) {
      step.status = 'in_progress';
      step.progress = 0;
      this.steps.set(id, step);
      this.emit('stepStarted', step);
      this.updateTotalProgress();
    }
  }

  updateStep(id: string, progress: number, message?: string): void {
    const step = this.steps.get(id);
    if (step) {
      step.progress = Math.min(100, Math.max(0, progress));
      if (message) step.message = message;
      this.steps.set(id, step);
      this.emit('stepUpdated', step);
      this.updateTotalProgress();
    }
  }

  completeStep(id: string): void {
    const step = this.steps.get(id);
    if (step) {
      step.status = 'completed';
      step.progress = 100;
      this.steps.set(id, step);
      this.emit('stepCompleted', step);
      this.updateTotalProgress();
    }
  }

  errorStep(id: string, message: string): void {
    const step = this.steps.get(id);
    if (step) {
      step.status = 'error';
      step.message = message;
      this.steps.set(id, step);
      this.emit('stepError', step);
      this.updateTotalProgress();
    }
  }

  private updateTotalProgress(): void {
    if (this.steps.size === 0) {
      this.totalProgress = 0;
      return;
    }

    const totalProgress = Array.from(this.steps.values()).reduce((sum, step) => {
      return sum + step.progress;
    }, 0);

    this.totalProgress = Math.round(totalProgress / this.steps.size);
    this.emit('progressUpdated', this.totalProgress);
  }

  getTotalProgress(): number {
    return this.totalProgress;
  }

  getSteps(): InitializationStep[] {
    return Array.from(this.steps.values());
  }

  reset(): void {
    this.steps.clear();
    this.totalProgress = 0;
    this.emit('reset');
  }
}

export const initializationProgress = InitializationProgress.getInstance();