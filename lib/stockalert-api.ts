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

  constructor(apiKey: string, baseUrl: string = 'https://stockalert.pro/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Create a new webhook in StockAlert.pro
   */
  async createWebhook(data: CreateWebhookRequest): Promise<WebhookResponse> {
    const response = await fetch(`${this.baseUrl}/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create webhook: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * List all webhooks
   */
  async listWebhooks(): Promise<WebhookResponse[]> {
    const response = await fetch(`${this.baseUrl}/webhooks`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list webhooks: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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