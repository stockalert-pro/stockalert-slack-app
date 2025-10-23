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
  metadata?: Record<string, any>;
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
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    // Use STOCKALERT_API_URL env var or default, NOT BASE_URL
    this.baseUrl = baseUrl || process.env['STOCKALERT_API_URL'] || 'https://stockalert.pro/api/v1';
  }

  /**
   * Create a new webhook in StockAlert.pro
   */
  async createWebhook(data: CreateWebhookRequest): Promise<WebhookResponse> {
    const url = `${this.baseUrl}/webhooks`;
    const events = data.events && data.events.length > 0 ? data.events : ['alert.triggered'];
    const body: Record<string, unknown> = {
      url: data.url,
      events,
    };

    if (data.secret) {
      body.secret = data.secret;
    }

    console.log('Creating webhook at:', url, {
      url: data.url,
      events,
      secretProvided: Boolean(data.secret),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook creation error:', { status: response.status, error: errorText });
      throw new StockAlertAPIError(
        `Failed to create webhook: ${errorText}`,
        response.status,
        errorText
      );
    }

    const result = await response.json();
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
    console.log('Webhook creation response:', masked);

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
    const url = `${this.baseUrl}/webhooks`;
    console.log('Fetching webhooks from:', url);

    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook list error:', { status: response.status, error: errorText });
      throw new StockAlertAPIError(
        `Failed to list webhooks: ${errorText}`,
        response.status,
        errorText
      );
    }

    const data = (await response.json()) as unknown;
    console.log('Webhook API response:', data);

    // Handle different response formats - API might return {webhooks: [...]} or {data: [...]}
    if (Array.isArray(data)) {
      return data as WebhookResponse[];
    }

    if (typeof data === 'object' && data !== null) {
      if (hasProperty(data, 'webhooks') && Array.isArray(data.webhooks)) {
        return data.webhooks as WebhookResponse[];
      }
      if (hasProperty(data, 'data') && Array.isArray(data.data)) {
        return data.data as WebhookResponse[];
      }
    }

    console.error('Unexpected webhook list format:', data);
    return [];
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new StockAlertAPIError(
        `Failed to delete webhook: ${errorText}`,
        response.status,
        errorText
      );
    }
  }

  /**
   * Send a test event to the StockAlert webhook
   */
  async testWebhook(data: WebhookTestRequest): Promise<WebhookTestResponse> {
    if (!data.url || !data.secret) {
      throw new Error('Webhook URL and secret are required');
    }

    const url = `${this.baseUrl}/webhooks/test`;

    console.log('Sending webhook test to:', data.url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        url: data.url,
        secret: data.secret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook test error:', { status: response.status, error: errorText });
      throw new StockAlertAPIError(
        `Failed to send webhook test: ${errorText}`,
        response.status,
        errorText
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    console.log('Webhook test API response:', result);

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
}
