/**
 * StockAlert.pro API client for webhook management
 */

// Type guard to check if object has a property
function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

const DEFAULT_BASE_URL = 'https://stockalert.pro/api/v1';

export interface CreateWebhookRequest {
  url: string;
  events?: string[];
  secret?: string;
}

export interface WebhookResponse {
  id: string;
  user_id?: string;
  name?: string;
  url: string;
  secret?: string; // Only returned on creation
  events: string[];
  enabled?: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
  last_triggered_at?: string | null;
  failure_count?: number;
  metadata?: Record<string, unknown>;
}

export interface WebhookListResponse {
  webhooks?: WebhookResponse[];
  data?: WebhookResponse[];
}

export interface WebhookTestRequest {
  url: string;
  secret: string;
}

export interface WebhookTestResponse {
  status: number;
  status_text: string;
  response: string;
}

export class StockAlertAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseText?: string
  ) {
    super(message);
    this.name = 'StockAlertAPIError';
  }
}

export class StockAlertAPI {
  private readonly apiKey: string;
  private readonly baseUrls: string[];

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    const rawBase = baseUrl || process.env['STOCKALERT_API_URL'] || DEFAULT_BASE_URL;
    this.baseUrls = StockAlertAPI.buildBaseUrlCandidates(rawBase);
    console.warn('StockAlertAPI base URL candidates:', this.baseUrls);
  }

  /**
   * Create a new webhook in StockAlert.pro
   */
  async createWebhook(data: CreateWebhookRequest): Promise<WebhookResponse> {
    const events = data.events && data.events.length > 0 ? data.events : ['alert.triggered'];
    const body: Record<string, unknown> = {
      url: data.url,
      events,
    };

    if (data.secret) {
      body.secret = data.secret;
    }

    console.warn('Creating webhook with payload:', {
      url: data.url,
      events,
      secretProvided: Boolean(data.secret),
    });

    const { data: result, baseUrlUsed } = await this.request('/webhooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Mask secret in logs (handle both envelope and direct response formats)
    let masked: unknown = result;
    if (
      result &&
      typeof result === 'object' &&
      hasProperty(result, 'data') &&
      result.data &&
      typeof result.data === 'object'
    ) {
      masked = {
        ...(result as Record<string, unknown>),
        data: { ...(result.data as Record<string, unknown>), secret: 'whsec_***' },
      };
    }
    console.warn('Webhook creation response from', baseUrlUsed, masked);

    // Handle different response formats - API might return the webhook directly or wrapped
    if (
      result &&
      typeof result === 'object' &&
      hasProperty(result, 'data') &&
      typeof result.data === 'object'
    ) {
      return result.data as WebhookResponse;
    }
    return result as WebhookResponse;
  }

  /**
   * List all webhooks
   */
  async listWebhooks(): Promise<WebhookResponse[]> {
    const { data, baseUrlUsed } = await this.request('/webhooks', {
      method: 'GET',
    });
    const responseData = data as unknown;
    console.warn('Webhook API response from', baseUrlUsed, responseData);

    // Handle different response formats - API might return {webhooks: [...]} or {data: [...]}
    if (Array.isArray(responseData)) {
      return responseData as WebhookResponse[];
    }

    if (typeof responseData === 'object' && responseData !== null) {
      if (hasProperty(responseData, 'webhooks') && Array.isArray(responseData.webhooks)) {
        return responseData.webhooks as WebhookResponse[];
      }
      if (hasProperty(responseData, 'data') && Array.isArray(responseData.data)) {
        return responseData.data as WebhookResponse[];
      }
    }

    console.error('Unexpected webhook list format:', responseData);
    return [];
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(
      `/webhooks/${webhookId}`,
      {
        method: 'DELETE',
      },
      { parseJson: false }
    );
  }

  /**
   * Send a test event to the StockAlert webhook
   */
  async testWebhook(data: WebhookTestRequest): Promise<WebhookTestResponse> {
    if (!data.url || !data.secret) {
      throw new Error('Webhook URL and secret are required');
    }

    console.warn('Sending webhook test to:', data.url);

    const { data: result, baseUrlUsed } = await this.request('/webhooks/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: data.url,
        secret: data.secret,
      }),
    });

    console.warn('Webhook test API response from', baseUrlUsed, result);

    const extractPayload = (payload: unknown): WebhookTestResponse | null => {
      if (!payload || typeof payload !== 'object') {
        return null;
      }

      const status =
        (payload as Record<string, unknown>).status ??
        (payload as Record<string, unknown>).status_code;
      const statusText =
        (payload as Record<string, unknown>).status_text ??
        (payload as Record<string, unknown>).statusText;
      const responseText = (payload as Record<string, unknown>).response;

      if (typeof status !== 'number' && typeof status !== 'string') {
        return null;
      }

      const statusNumber = typeof status === 'number' ? status : Number(status);
      if (Number.isNaN(statusNumber)) {
        return null;
      }

      return {
        status: statusNumber,
        status_text: typeof statusText === 'string' ? statusText : '',
        response:
          typeof responseText === 'string'
            ? responseText
            : responseText !== undefined
              ? JSON.stringify(responseText)
              : '',
      };
    };

    if (result && typeof result === 'object') {
      if (hasProperty(result, 'data')) {
        const payload = extractPayload(result.data);
        if (payload) {
          return payload;
        }
      }

      const payload = extractPayload(result);
      if (payload) {
        return payload;
      }
    }

    throw new Error('Unexpected webhook test response format');
  }

  /**
   * Find webhook by URL
   */
  async findWebhookByUrl(url: string): Promise<WebhookResponse | null> {
    try {
      const webhooks = await this.listWebhooks();
      return webhooks.find((w) => w.url === url) || null;
    } catch (error) {
      console.error('Error finding webhook by URL:', error);
      throw error;
    }
  }

  private async request(
    path: string,
    init: RequestInit = {},
    options: { parseJson?: boolean } = {}
  ): Promise<{ data: unknown; baseUrlUsed: string }> {
    const { parseJson = true } = options;
    const candidates = this.baseUrls;
    let lastError: unknown = null;
    const requestBody = init.body;

    for (let i = 0; i < candidates.length; i++) {
      const base = candidates[i]!;
      const url = `${base}${path}`;

      try {
        const headers = this.buildHeaders(init.headers);
        const response = await fetch(url, { ...init, headers, body: requestBody });
        const text = await response.text();

        if (!response.ok) {
          const shouldRetry =
            i < candidates.length - 1 && this.shouldRetryWithFallback(response.status, text);

          const summary = this.summarizeErrorText(response.status, text);
          const method = init.method ?? 'GET';
          const error = new StockAlertAPIError(
            `Failed to ${method} ${path}: ${summary}`,
            response.status,
            text
          );

          if (shouldRetry) {
            console.warn(
              `StockAlertAPI: ${error.message} (base ${base}). Trying fallback base URL: ${candidates[i + 1]}`
            );
            lastError = error;
            continue;
          }

          throw error;
        }

        if (!parseJson) {
          return { data: text, baseUrlUsed: base };
        }

        if (!text) {
          return { data: null, baseUrlUsed: base };
        }

        try {
          const data = JSON.parse(text);
          return { data, baseUrlUsed: base };
        } catch {
          throw new StockAlertAPIError(
            'Invalid JSON response from StockAlert API',
            response.status,
            text
          );
        }
      } catch (error) {
        lastError = error;
        if (error instanceof StockAlertAPIError) {
          throw error;
        }
        if (i === candidates.length - 1) {
          throw error;
        }
        const nextBase = candidates[i + 1] ?? base;
        console.warn(
          `StockAlertAPI: ${error instanceof Error ? error.message : String(error)} (base ${base}). Trying fallback base URL: ${nextBase}`
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to communicate with StockAlert API');
  }

  private buildHeaders(headers?: unknown): Headers {
    const merged = new Headers();
    if (headers) {
      if (headers instanceof Headers) {
        headers.forEach((value, key) => merged.set(key, value));
      } else if (Array.isArray(headers)) {
        for (const tuple of headers as Array<string[]>) {
          if (Array.isArray(tuple) && tuple.length >= 2) {
            merged.set(String(tuple[0]), String(tuple[1]));
          }
        }
      } else if (typeof headers === 'object') {
        for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
          if (Array.isArray(value)) {
            merged.set(key, value.map((v) => String(v)).join(', '));
          } else if (value !== undefined && value !== null) {
            merged.set(key, String(value));
          }
        }
      }
    }
    merged.set('X-API-Key', this.apiKey);
    if (!merged.has('Accept')) {
      merged.set('Accept', 'application/json');
    }
    return merged;
  }

  private shouldRetryWithFallback(status: number, body: string): boolean {
    if (status === 404) {
      return true;
    }
    return this.looksLikeHtml(body);
  }

  private looksLikeHtml(body: string): boolean {
    const snippet = body.trim().slice(0, 100).toLowerCase();
    return snippet.startsWith('<!doctype') || snippet.startsWith('<html');
  }

  private summarizeErrorText(status: number, text: string): string {
    if (!text) {
      return `status ${status}`;
    }

    const trimmed = text.trim();

    if (this.looksLikeHtml(trimmed)) {
      return `HTML response (status ${status})`;
    }

    const singleLine = trimmed.replace(/\s+/g, ' ');
    if (singleLine.length > 300) {
      return `${singleLine.slice(0, 297)}...`;
    }
    return singleLine;
  }

  private static buildBaseUrlCandidates(rawBase: string): string[] {
    const norm = (s: string) => s.replace(/\/+$/, '');
    const candidates = new Set<string>();

    const normalizePublic = (url: string): string => url.replace(/\/api\/public\/v1$/, '/api/v1');

    try {
      const normalizedRaw = normalizePublic(norm(rawBase));
      const parsed = new URL(normalizedRaw);
      const origin = `${parsed.protocol}//${parsed.host}`;
      const path = norm(parsed.pathname);
      const segments = path.split('/').filter(Boolean);
      const pathKey = segments.join('/');

      // If explicitly /v1 or /api/v1, keep it, and add the sibling variant as fallback
      if (pathKey === 'v1') {
        candidates.add(normalizedRaw); // .../v1
        candidates.add(`${origin}/api/v1`); // fallback
      } else if (pathKey === 'api/v1') {
        candidates.add(normalizedRaw); // .../api/v1
        candidates.add(`${origin}/v1`); // fallback
      } else if (pathKey === 'api/public/v1' || pathKey === 'api/public') {
        // Normalize public to /api/v1 only
        candidates.add(`${origin}/api/v1`);
      } else if (pathKey === 'api' || pathKey === '' || !segments.includes('api')) {
        // Root or non-API path → prefer /api/v1
        candidates.add(`${origin}/api/v1`);
      } else {
        // Unknown path → still prefer /api/v1 under same origin
        candidates.add(`${origin}/api/v1`);
      }
    } catch {
      // Not a full URL → fall back to default v1 endpoint
      candidates.add(DEFAULT_BASE_URL);
    }

    return Array.from(candidates);
  }
}
