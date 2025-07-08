/**
 * StockAlert.pro API client for webhook management
 */

interface CreateWebhookRequest {
  name: string;
  url: string;
  events: string[];
  enabled?: boolean;
}

interface WebhookResponse {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class StockAlertAPI {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    // Allow override via environment variable or parameter
    this.baseUrl = baseUrl || process.env.STOCKALERT_API_URL || 'https://stockalert.pro/api/public/v1';
  }

  /**
   * Create a new webhook in StockAlert.pro
   */
  async createWebhook(data: CreateWebhookRequest): Promise<WebhookResponse> {
    const url = `${this.baseUrl}/webhooks`;
    console.log('Creating webhook at:', url, data);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Webhook creation error:', { status: response.status, error });
      throw new Error(`Failed to create webhook: ${response.status} ${error}`);
    }

    return response.json();
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
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook list error:', { status: response.status, error: errorText });
      throw new Error(`Failed to list webhooks: ${response.status}`);
    }

    const data = await response.json();
    console.log('Webhook API response:', data);
    
    // Handle different response formats - API might return {webhooks: [...]} or {data: [...]}
    if (Array.isArray(data)) {
      return data;
    } else if (data.webhooks && Array.isArray(data.webhooks)) {
      return data.webhooks;
    } else if (data.data && Array.isArray(data.data)) {
      return data.data;
    } else {
      console.error('Unexpected webhook list format:', data);
      return [];
    }
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
      throw new Error(`Failed to delete webhook: ${response.status}`);
    }
  }

  /**
   * Find webhook by URL
   */
  async findWebhookByUrl(url: string): Promise<WebhookResponse | null> {
    const webhooks = await this.listWebhooks();
    return webhooks.find(w => w.url === url) || null;
  }
}