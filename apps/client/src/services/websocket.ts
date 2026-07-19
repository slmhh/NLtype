import type { WSMessage } from "../types/multiplayer";

type MessageHandler = (msg: WSMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string = "";
  private connected = false;
  private reconnectAttempts = 0;
  private pendingMessages: string[] = [];
  userId: number | null = null;

  connect(token?: string) {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.DEV ? "localhost:3001" : location.host;
    this.url = `${protocol}//${host}/api/ws${token ? `?token=${token}` : ""}`;
    // Decode userId from JWT if available
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        this.userId = payload.userId || null;
      } catch { /* ignore */ }
    }
    this.doConnect();
  }

  private doConnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit("connect", {});
      // Flush pending messages
      const pending = this.pendingMessages;
      this.pendingMessages = [];
      for (const msg of pending) {
        this.ws?.send(msg);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const typeHandlers = this.handlers.get(msg.type);
        if (typeHandlers) {
          typeHandlers.forEach((h) => h(msg));
        }
        // Also notify wildcard handlers
        const allHandlers = this.handlers.get("*");
        if (allHandlers) {
          allHandlers.forEach((h) => h(msg));
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      // Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, ... max 30s)
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.reconnectAttempts = 0;
    this.pendingMessages = [];
  }

  send(type: string, payload?: any) {
    const msg = JSON.stringify({ type, payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  private emit(type: string, payload?: any) {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach((h) => h({ type, payload }));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  isConnected() {
    return this.connected;
  }
}

export const wsClient = new WebSocketClient();
