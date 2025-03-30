export interface EventTypes {
  'strategy:created': (strategy: Strategy) => void;
  'strategy:updated': (strategy: Strategy) => void;
  'strategy:deleted': (strategyId: string) => void;
  // Add more event types as needed
}