export class Writable {
  constructor(options = {}) {}
  
  write(chunk: any, encoding?: string, callback?: (error?: Error | null) => void): boolean {
    if (callback) {
      callback();
    }
    return true;
  }
  
  end(callback?: () => void): void {
    if (callback) {
      callback();
    }
  }
}

export default {
  Writable
};