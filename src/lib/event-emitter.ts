type EventCallback = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, Set<EventCallback>>;

  constructor() {
    this.events = new Map();
  }

  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      this.off(event, onceCallback);
      callback.apply(this, args);
    };
    this.on(event, onceCallback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.events.delete(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event: string): number {
    const callbacks = this.events.get(event);
    return callbacks ? callbacks.size : 0;
  }

  listeners(event: string): EventCallback[] {
    const callbacks = this.events.get(event);
    return callbacks ? Array.from(callbacks) : [];
  }
}
