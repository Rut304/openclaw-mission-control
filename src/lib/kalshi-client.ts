/**
 * Kalshi Trading API Client with WebSocket support
 * Handles both REST API and WebSocket for real-time trading
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Types
export interface KalshiBalance {
  availableBalance: number;
  totalBalance: number;
  portfolioValue: number;
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  status: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  volume: number;
}

export interface KalshiOrder {
  orderId: string;
  ticker: string;
  side: 'yes' | 'no';
  type: 'market' | 'limit';
  price: number;
  count: number;
  status: string;
  createdTime: string;
}

export interface KalshiPosition {
  ticker: string;
  yesContracts: number;
  noContracts: number;
  avgPrice: number;
  pnl: number;
}

export interface KalshiFill {
  id: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  price: number;
  isTaker: boolean;
  createdTime: string;
}

export interface KalshiSettlement {
  ticker: string;
  marketResult: string;
  noCount: number;
  noTotalCost: number;
  revenue: number;
  settledTime: string;
  yesCount: number;
  yesTotalCost: number;
}

export class KalshiClient {
  private baseUrl: string;
  private wsUrl: string;
  private apiKeyId: string;
  private privateKey: crypto.KeyObject | null = null;
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isDemo: boolean;

  constructor(options?: { demo?: boolean }) {
    this.isDemo = options?.demo ?? true;
    
    if (this.isDemo) {
      this.baseUrl = 'https://demo-api.kalshi.co';
      this.wsUrl = 'wss://demo-api.kalshi.co/trade-api/ws/v2';
    } else {
      this.baseUrl = 'https://trading-api.kalshi.com';
      this.wsUrl = 'wss://demo-api.kalshi.co/trade-api/ws/v2';
    }
    
    this.apiKeyId = process.env.KALSHI_API_KEY || '';
    this.loadPrivateKey();
  }

  private loadPrivateKey(): void {
    const keyPaths = [
      process.env.KALSHI_PRIVATE_KEY_PATH,
      path.join(process.env.HOME || '', 'keys', 'kalshi_private.pem'),
      path.join(process.env.HOME || '', 'keys', 'kalshi_private_pkcs8.pem'),
    ].filter(Boolean) as string[];

    for (const keyPath of keyPaths) {
      try {
        if (fs.existsSync(keyPath)) {
          const keyData = fs.readFileSync(keyPath, 'utf8');
          this.privateKey = crypto.createPrivateKey(keyData);
          console.log(`[Kalshi] Loaded private key from ${keyPath}`);
          return;
        }
      } catch (err) {
        console.error(`[Kalshi] Failed to load key from ${keyPath}:`, err);
      }
    }
    
    console.warn('[Kalshi] No private key found - API calls will fail');
  }

  /**
   * Generate RSA-PSS signature for request
   * Kalshi uses seconds timestamp and sha256 with RSA-PSS padding
   */
  private sign(method: string, urlPath: string, timestampSec: number): string {
    if (!this.privateKey) {
      throw new Error('Private key not loaded');
    }

    const message = `${timestampSec}${method}${urlPath}`;
    
    const signature = crypto.sign('sha256', Buffer.from(message), {
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });

    return signature.toString('base64');
  }

  /**
   * Make authenticated REST API request
   */
  async request<T = any>(method: string, endpoint: string, body?: object): Promise<T> {
    const urlPath = `/trade-api/v2${endpoint}`;
    const timestampSec = Math.floor(Date.now() / 1000);
    const signature = this.sign(method, urlPath, timestampSec);

    const headers: Record<string, string> = {
      'KALSHI-ACCESS-KEY': this.apiKeyId,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'KALSHI-ACCESS-TIMESTAMP': String(timestampSec),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${this.baseUrl}${urlPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kalshi API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  // ================== REST API Methods ==================

  /**
   * Get account balance
   */
  async getBalance(): Promise<KalshiBalance> {
    const data = await this.request<any>('GET', '/portfolio/balance');
    return {
      availableBalance: data.balance / 100, // Convert cents to dollars
      totalBalance: data.balance / 100,
      portfolioValue: (data.portfolio_value || 0) / 100,
    };
  }

  /**
   * Get exchange status
   */
  async getExchangeStatus(): Promise<{ trading_active: boolean; exchange_active: boolean }> {
    return this.request('GET', '/exchange/status');
  }

  /**
   * Get market by ticker
   */
  async getMarket(ticker: string): Promise<KalshiMarket> {
    const data = await this.request<any>('GET', `/markets/${ticker}`);
    const market = data.market;
    return {
      ticker: market.ticker,
      title: market.title,
      status: market.status,
      yes_bid: market.yes_bid / 100,
      yes_ask: market.yes_ask / 100,
      no_bid: market.no_bid / 100,
      no_ask: market.no_ask / 100,
      volume: market.volume,
    };
  }

  /**
   * Get all positions
   */
  async getPositions(): Promise<KalshiPosition[]> {
    const data = await this.request<any>('GET', '/portfolio/positions');
    return (data.market_positions || []).map((pos: any) => ({
      ticker: pos.ticker,
      yesContracts: pos.position,
      noContracts: pos.position < 0 ? Math.abs(pos.position) : 0,
      avgPrice: pos.average_cost / 100,
      pnl: pos.total_traded / 100,
    }));
  }

  /**
   * Get open orders
   */
  async getOrders(): Promise<KalshiOrder[]> {
    const data = await this.request<any>('GET', '/portfolio/orders');
    return (data.orders || []).map((order: any) => ({
      orderId: order.order_id,
      ticker: order.ticker,
      side: order.side,
      type: order.type,
      price: order.yes_price / 100,
      count: order.count,
      status: order.status,
      createdTime: order.created_time,
    }));
  }

  /**
   * Get trade fills (executed trades)
   */
  async getFills(opts?: { ticker?: string; limit?: number; cursor?: string }): Promise<{ fills: KalshiFill[]; cursor: string | null }> {
    let endpoint = '/portfolio/fills?limit=' + (opts?.limit || 100);
    if (opts?.ticker) endpoint += `&ticker=${opts.ticker}`;
    if (opts?.cursor) endpoint += `&cursor=${opts.cursor}`;
    const data = await this.request<any>('GET', endpoint);
    return {
      fills: (data.fills || []).map((f: any) => ({
        id: f.trade_id || f.id,
        ticker: f.ticker,
        side: f.side,
        action: f.action,
        count: f.count,
        price: f.yes_price / 100,
        isTaker: f.is_taker ?? false,
        createdTime: f.created_time,
      })),
      cursor: data.cursor || null,
    };
  }

  /**
   * Get all fills with auto-pagination
   */
  async getAllFills(): Promise<KalshiFill[]> {
    const allFills: KalshiFill[] = [];
    let cursor: string | null = null;
    do {
      const result = await this.getFills({ limit: 100, cursor: cursor ?? undefined });
      allFills.push(...result.fills);
      cursor = result.cursor;
    } while (cursor);
    return allFills;
  }

  /**
   * Get portfolio settlements (resolved markets)
   */
  async getSettlements(opts?: { limit?: number; cursor?: string }): Promise<{ settlements: KalshiSettlement[]; cursor: string | null }> {
    let endpoint = '/portfolio/settlements?limit=' + (opts?.limit || 100);
    if (opts?.cursor) endpoint += `&cursor=${opts.cursor}`;
    const data = await this.request<any>('GET', endpoint);
    return {
      settlements: (data.settlements || []).map((s: any) => ({
        ticker: s.ticker,
        marketResult: s.market_result,
        noCount: s.no_count || 0,
        noTotalCost: (s.no_total_cost || 0) / 100,
        revenue: (s.revenue || 0) / 100,
        settledTime: s.settled_time,
        yesCount: s.yes_count || 0,
        yesTotalCost: (s.yes_total_cost || 0) / 100,
      })),
      cursor: data.cursor || null,
    };
  }

  /**
   * Get all settlements with auto-pagination
   */
  async getAllSettlements(): Promise<KalshiSettlement[]> {
    const all: KalshiSettlement[] = [];
    let cursor: string | null = null;
    do {
      const result = await this.getSettlements({ limit: 100, cursor: cursor ?? undefined });
      all.push(...result.settlements);
      cursor = result.cursor;
    } while (cursor);
    return all;
  }

  /**
   * Place an order
   */
  async placeOrder(params: {
    ticker: string;
    side: 'yes' | 'no';
    type: 'market' | 'limit';
    count: number;
    price?: number; // Required for limit orders
  }): Promise<KalshiOrder> {
    const body: any = {
      ticker: params.ticker,
      side: params.side,
      type: params.type,
      count: params.count,
      action: 'buy',
    };

    if (params.type === 'limit' && params.price != null) {
      body.yes_price = Math.round(params.price * 100); // Convert to cents
    }

    const data = await this.request<any>('POST', '/portfolio/orders', body);
    const order = data.order;
    
    return {
      orderId: order.order_id,
      ticker: order.ticker,
      side: order.side,
      type: order.type,
      price: order.yes_price / 100,
      count: order.count,
      status: order.status,
      createdTime: order.created_time,
    };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.request('DELETE', `/portfolio/orders/${orderId}`);
  }

  // ================== WebSocket Methods ==================

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        const timestampMs = Date.now();
        const signature = this.sign('GET', '/trade-api/ws/v2', timestampMs);

        // Note: In browser environment, WebSocket doesn't support custom headers
        // For server-side, we'd need to use a library like 'ws' with headers
        // This implementation uses URL params as fallback
        const wsUrlWithAuth = new URL(this.wsUrl);
        wsUrlWithAuth.searchParams.set('api-key', this.apiKeyId);
        wsUrlWithAuth.searchParams.set('timestamp', String(timestampMs));
        wsUrlWithAuth.searchParams.set('signature', signature);

        this.ws = new WebSocket(wsUrlWithAuth.toString());

        this.ws.onopen = () => {
          console.log('[Kalshi WS] Connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const channel = data.type;
            const callback = this.wsCallbacks.get(channel);
            if (callback) {
              callback(data);
            }
          } catch (err) {
            console.error('[Kalshi WS] Parse error:', err);
          }
        };

        this.ws.onclose = () => {
          console.log('[Kalshi WS] Disconnected');
          this.tryReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[Kalshi WS] Error:', error);
          reject(error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[Kalshi WS] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connectWebSocket(), delay);
    }
  }

  /**
   * Subscribe to orderbook updates
   */
  subscribeOrderbook(ticker: string, callback: (data: any) => void): void {
    this.wsCallbacks.set('orderbook_delta', callback);
    this.wsSend({
      id: Date.now(),
      cmd: 'subscribe',
      params: {
        channels: ['orderbook_delta'],
        market_tickers: [ticker],
      },
    });
  }

  /**
   * Subscribe to trade fills
   */
  subscribeFills(callback: (data: any) => void): void {
    this.wsCallbacks.set('fill', callback);
    this.wsSend({
      id: Date.now(),
      cmd: 'subscribe',
      params: {
        channels: ['fill'],
      },
    });
  }

  /**
   * Subscribe to position updates
   */
  subscribePositions(callback: (data: any) => void): void {
    this.wsCallbacks.set('market_positions', callback);
    this.wsSend({
      id: Date.now(),
      cmd: 'subscribe',
      params: {
        channels: ['market_positions'],
      },
    });
  }

  private wsSend(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[Kalshi WS] Not connected, queuing message');
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
let kalshiClient: KalshiClient | null = null;

export function getKalshiClient(options?: { demo?: boolean }): KalshiClient {
  if (!kalshiClient) {
    kalshiClient = new KalshiClient(options);
  }
  return kalshiClient;
}
