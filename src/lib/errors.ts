export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExchangeError';
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}