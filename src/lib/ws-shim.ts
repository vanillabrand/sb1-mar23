// Re-export the browser's native WebSocket
const WS = window.WebSocket;

// Add missing properties that ccxt expects
class WebSocket extends WS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
  }
}

// Export both named and default export
export { WebSocket };
export default WebSocket;