import { AgntlyError } from './errors.js';

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    if (!config.apiKey || (!config.apiKey.startsWith('ag_') && !config.apiKey.startsWith('agntly_'))) {
      throw new AgntlyError('apiKey must be an Agntly API key starting with ag_ or agntly_', 0);
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://sandbox.api.agntly.io').replace(/\/$/, '');
    this.timeout = config.timeout ?? 30_000;
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.request<T>(url, { method: 'GET' });
  }

  async getPaginated<T>(path: string, query?: Record<string, string | number | undefined>): Promise<{ data: readonly T[]; meta: { total: number; limit: number; offset: number } }> {
    const url = this.buildUrl(path, query);
    return this.requestRaw<{ data: readonly T[]; meta: { total: number; limit: number; offset: number } }>(url, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(this.buildUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(this.buildUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async del<T>(path: string): Promise<T> {
    return this.request<T>(this.buildUrl(path), { method: 'DELETE' });
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  /**
   * Standard request — strips the { success, data, error } envelope, returns `data`.
   */
  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const envelope = await this.requestRaw<{ success: boolean; data: T; error: string | null }>(url, init);
    return envelope.data;
  }

  /**
   * Raw request — returns the full parsed JSON body (used for paginated responses
   * where we need both `data` and `meta`).
   */
  private async requestRaw<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...init.headers,
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AgntlyError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw new AgntlyError(
        err instanceof Error ? err.message : 'Network error',
        0,
      );
    }

    clearTimeout(timer);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let body: unknown;
      try {
        body = await response.json();
        if (body && typeof body === 'object' && 'error' in body) {
          errorMessage = (body as { error: string }).error;
        }
      } catch {
        // Non-JSON error body (e.g., HTML from load balancer)
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new AgntlyError(errorMessage, response.status, body);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new AgntlyError('Invalid JSON response', response.status);
    }
  }
}
