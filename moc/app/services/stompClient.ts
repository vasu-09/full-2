/*
 * Minimal STOMP client tailored for the MoC mobile application.
 * Supports CONNECT, SUBSCRIBE, SEND and graceful reconnects without
 * relying on external npm dependencies (offline environments).
 */

import { Platform } from 'react-native';

import { buildWsUrl } from './apiClient';
import { getAccessToken } from './authStorage';

type RNWebSocketConstructor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => WebSocket;

type FrameHandler = (frame: StompFrame) => void;

export type StompFrame = {
  command: string;
  headers: Record<string, string>;
  body: string;
};

type SubscriptionEntry = {
  destination: string;
  callback: FrameHandler;
  id: string;
};

const HEARTBEAT = '10000,10000';

class SimpleStompClient {
  private url: string;
  private token?: string | null;
  private ws: WebSocket | null = null;
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private resolveConnect?: () => void;
  private rejectConnect?: (err: unknown) => void;
  private subscriptions = new Map<string, FrameHandler>();
  private subscriptionSeq = 0;
  public onDisconnect?: () => void;
  public onConnectCallback?: () => void;

  constructor(url: string, token?: string | null) {
    this.url = url;
    this.token = token;
  }

  isConnected() {
    return this.connected;
  }

  async connect() {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.resolveConnect = resolve;
      this.rejectConnect = reject;
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      try {
        // RN WebSocket constructor accepts headers as third argument (not web).
        const wsUrl = this.token
          ? `${this.url}?access_token=${encodeURIComponent(this.token)}`
          : this.url;
        const socket: WebSocket =
          Platform.OS === 'web'
            ? new WebSocket(wsUrl)
            : new (WebSocket as unknown as RNWebSocketConstructor)(
                wsUrl,
                undefined,
                { headers },
              );
        this.ws = socket;

        socket.onopen = () => {
          this.sendFrame('CONNECT', {
            'accept-version': '1.2',
            'heart-beat': HEARTBEAT,
          });
        };

        socket.onmessage = event => {
          if (typeof event.data !== 'string') {
            return;
          }
          const payload = event.data;
          if (payload === '\n' || payload === '\r\n') {
            return; // heartbeat
          }
          this.handleRawData(payload);
        };

        socket.onclose = () => {
          this.connected = false;
          this.connectPromise = null;
          if (this.onDisconnect) {
            this.onDisconnect();
          }
        };

        socket.onerror = err => {
          if (this.rejectConnect) {
            this.rejectConnect(err);
          }
        };
      } catch (err) {
        if (this.rejectConnect) {
          this.rejectConnect(err);
        }
      }
    });

    return this.connectPromise;
  }

  disconnect() {
    if (this.ws) {
      try {
        this.sendFrame('DISCONNECT', {});
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.connected = false;
    this.connectPromise = null;
  }

  private handleRawData(data: string) {
    const frames = data.split('\0');
    frames.forEach(raw => {
      if (!raw || !raw.trim()) {
        return;
      }
      const frame = this.parseFrame(raw);
      if (!frame) {
        return;
      }

      if (frame.command === 'CONNECTED') {
        this.connected = true;
        if (this.resolveConnect) {
          this.resolveConnect();
        }
        if (this.onConnectCallback) {
          this.onConnectCallback();
        }
        this.resolveConnect = undefined;
        this.rejectConnect = undefined;
        return;
      }

      if (frame.command === 'MESSAGE') {
        const subId = frame.headers['subscription'];
        if (subId && this.subscriptions.has(subId)) {
          try {
            this.subscriptions.get(subId)?.(frame);
          } catch (err) {
            console.warn('STOMP subscription handler error', err);
          }
        }
        return;
      }

      if (frame.command === 'ERROR') {
        console.warn('STOMP error frame', frame.body || frame.headers['message']);
        return;
      }
    });
  }

  private parseFrame(raw: string): StompFrame | null {
    const trimmed = raw.replace(/\u0000/g, '');
    const commandEnd = trimmed.indexOf('\n');
    const command = (commandEnd >= 0 ? trimmed.slice(0, commandEnd) : trimmed).trim();
    if (!command) {
      return null;
    }

    const remainder = commandEnd >= 0 ? trimmed.slice(commandEnd + 1) : '';
    const headerEnd = remainder.indexOf('\n\n');
    let headerPart = '';
    let bodyPart = '';
    if (headerEnd >= 0) {
      headerPart = remainder.slice(0, headerEnd);
      bodyPart = remainder.slice(headerEnd + 2);
    } else {
      headerPart = remainder;
    }

    const headers: Record<string, string> = {};
    if (headerPart) {
      headerPart.split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > -1) {
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          headers[key] = value;
        }
      });
    }

    return { command, headers, body: bodyPart.replace(/\u0000/g, '') };
  }

  private sendFrame(command: string, headers: Record<string, unknown>, body = '') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    let frame = `${command}\n`;
    Object.entries(headers).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      frame += `${key}:${value}\n`;
    });
    frame += '\n';
    if (body) {
      frame += body;
    }
    frame += '\u0000';
    this.ws.send(frame);
  }

  send(destination: string, body: string, headers: Record<string, unknown> = {}) {
    this.sendFrame('SEND', { destination, ...headers }, body);
  }

  subscribe(destination: string, callback: FrameHandler, id?: string) {
    const subId = id ?? `sub-${++this.subscriptionSeq}`;
    this.subscriptions.set(subId, callback);
    this.sendFrame('SUBSCRIBE', { destination, id: subId, ack: 'auto' });
    return subId;
  }

  unsubscribe(id: string) {
    if (!this.subscriptions.has(id)) {
      return;
    }
    this.subscriptions.delete(id);
    this.sendFrame('UNSUBSCRIBE', { id });
  }
}

class StompManager {
  private client: SimpleStompClient | null = null;
  private initPromise: Promise<SimpleStompClient> | null = null;
  private reconnectDelay = 5000;
  private subscriptions = new Map<string, SubscriptionEntry>();
  private desired = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idCounter = 0;
  private lastToken: string | null = null;

  private async initClient(explicitToken?: string | null): Promise<SimpleStompClient> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const token = explicitToken ?? (await getAccessToken());
      const url = buildWsUrl();
      const client = new SimpleStompClient(url, token ?? undefined);
      this.lastToken = token ?? null;
      client.onDisconnect = () => {
        this.client = null;
        this.initPromise = null;
        this.lastToken = null;
        if (this.desired) {
          this.scheduleReconnect();
        }
      };
      client.onConnectCallback = () => {
        this.resubscribe(client);
      };
      await client.connect();
      this.client = client;
      return client;
    })();

    try {
      const readyClient = await this.initPromise;
      return readyClient;
    } finally {
      this.initPromise = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.desired) {
        return;
      }
      try {
        await this.initClient();
      } catch (err) {
        console.warn('STOMP reconnect failed', err);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  private resubscribe(client: SimpleStompClient) {
    this.subscriptions.forEach(entry => {
      client.subscribe(entry.destination, entry.callback, entry.id);
    });
  }

  async ensureConnected(): Promise<SimpleStompClient> {
    this.desired = true;
    const latestToken = await getAccessToken();
    if (this.client && this.client.isConnected() && this.lastToken === (latestToken ?? null)) {
      return this.client;
    }

    if (this.client) {
      this.client.disconnect();
      this.client = null;
      this.initPromise = null;
      this.lastToken = null;
    }
    
    return this.initClient(latestToken);
  }

  async disconnect(): Promise<void> {
    this.desired = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.initPromise = null;
  }

  async publish(destination: string, payload: unknown, headers: Record<string, unknown> = {}) {
    const client = await this.ensureConnected();
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    client.send(destination, body, {
      'content-type': 'application/json',
      ...headers,
    });
  }

  subscribe(destination: string, callback: FrameHandler) {
    const id = `sub-${++this.idCounter}`;
    const entry: SubscriptionEntry = { destination, callback, id };
    this.subscriptions.set(id, entry);

    this.ensureConnected()
      .then(client => {
        client.subscribe(destination, callback, id);
      })
      .catch(err => {
        console.warn('Failed to establish STOMP subscription', err);
      });

    return () => {
      const current = this.subscriptions.get(id);
      if (!current) {
        return;
      }
      this.subscriptions.delete(id);
      if (this.client && this.client.isConnected()) {
        try {
          this.client.unsubscribe(id);
        } catch {
          // ignore
        }
      }
    };
  }
}

const stompManager = new StompManager();

export default stompManager;