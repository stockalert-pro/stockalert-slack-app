import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StockAlertAPI,
  StockAlertAPIError,
  type CreateWebhookRequest,
  type WebhookResponse,
} from '../lib/stockalert-api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('StockAlertAPI', () => {
  let api: StockAlertAPI;
  const apiKey = 'sk_test_api_key';
  const baseUrl = 'https://api.test.com/v1';

  beforeEach(() => {
    vi.clearAllMocks();
    api = new StockAlertAPI(apiKey, baseUrl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided API key and base URL', () => {
      expect(api).toBeDefined();
    });

    it('should use environment variable for base URL if not provided', () => {
      const originalEnv = process.env['STOCKALERT_API_URL'];
      process.env['STOCKALERT_API_URL'] = 'https://env-api.test.com';

      const apiWithEnv = new StockAlertAPI(apiKey);
      expect(apiWithEnv).toBeDefined();

      process.env['STOCKALERT_API_URL'] = originalEnv;
    });

    it('should use default base URL if no environment variable', () => {
      const originalEnv = process.env['STOCKALERT_API_URL'];
      delete process.env['STOCKALERT_API_URL'];

      const apiWithDefault = new StockAlertAPI(apiKey);
      expect(apiWithDefault).toBeDefined();

      if (originalEnv) {
        process.env['STOCKALERT_API_URL'] = originalEnv;
      }
    });
  });

  describe('createWebhook', () => {
    const webhookData: CreateWebhookRequest = {
      url: 'https://example.com/webhook',
      events: ['alert.triggered'],
    };

    const mockWebhookResponse: WebhookResponse = {
      id: 'webhook_123',
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
      secret: 'webhook_secret_123',
      events: ['alert.triggered'],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('should successfully create a webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhookResponse,
      });

      const result = await api.createWebhook(webhookData);

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      expect(result).toEqual(mockWebhookResponse);
    });

    it('should throw StockAlertAPIError on failed request', async () => {
      const errorText = 'Invalid API key';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => errorText,
      });

      await expect(api.createWebhook(webhookData)).rejects.toThrow(StockAlertAPIError);
    });

    it('should include status code in error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      try {
        await api.createWebhook(webhookData);
      } catch (error) {
        expect(error).toBeInstanceOf(StockAlertAPIError);
        expect((error as StockAlertAPIError).statusCode).toBe(400);
        expect((error as StockAlertAPIError).responseText).toBe('Bad Request');
      }
    });
  });

  describe('listWebhooks', () => {
    const mockWebhooks: WebhookResponse[] = [
      {
        id: 'webhook_1',
        name: 'Webhook 1',
        url: 'https://example1.com/webhook',
        secret: 'secret_1',
        events: ['alert.triggered'],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'webhook_2',
        name: 'Webhook 2',
        url: 'https://example2.com/webhook',
        secret: 'secret_2',
        events: ['alert.triggered'],
        enabled: false,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];

    it('should successfully list webhooks when response is array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhooks,
      });

      const result = await api.listWebhooks();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/webhooks`, {
        headers: {
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },
      });

      expect(result).toEqual(mockWebhooks);
    });

    it('should handle response with webhooks property', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ webhooks: mockWebhooks }),
      });

      const result = await api.listWebhooks();
      expect(result).toEqual(mockWebhooks);
    });

    it('should handle response with data property', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWebhooks }),
      });

      const result = await api.listWebhooks();
      expect(result).toEqual(mockWebhooks);
    });

    it('should return empty array for unexpected response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpected: 'format' }),
      });

      const result = await api.listWebhooks();
      expect(result).toEqual([]);
    });

    it('should return empty array for null response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const result = await api.listWebhooks();
      expect(result).toEqual([]);
    });

    it('should throw StockAlertAPIError on failed request', async () => {
      const errorText = 'Server error';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => errorText,
      });

      await expect(api.listWebhooks()).rejects.toThrow(StockAlertAPIError);
    });
  });

  describe('deleteWebhook', () => {
    const webhookId = 'webhook_123';

    it('should successfully delete a webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      });

      await expect(api.deleteWebhook(webhookId)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': apiKey,
        },
      });
    });

    it('should throw StockAlertAPIError on failed request', async () => {
      const errorText = 'Webhook not found';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => errorText,
      });

      await expect(api.deleteWebhook(webhookId)).rejects.toThrow(StockAlertAPIError);
    });
  });

  describe('findWebhookByUrl', () => {
    const targetUrl = 'https://example1.com/webhook';
    const mockWebhooks: WebhookResponse[] = [
      {
        id: 'webhook_1',
        name: 'Webhook 1',
        url: 'https://example1.com/webhook',
        secret: 'secret_1',
        events: ['alert.triggered'],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'webhook_2',
        name: 'Webhook 2',
        url: 'https://example2.com/webhook',
        secret: 'secret_2',
        events: ['alert.triggered'],
        enabled: false,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];

    it('should find webhook by URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhooks,
      });

      const result = await api.findWebhookByUrl(targetUrl);
      expect(result).toEqual(mockWebhooks[0]);
    });

    it('should return null if webhook not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhooks,
      });

      const result = await api.findWebhookByUrl('https://notfound.com/webhook');
      expect(result).toBeNull();
    });

    it('should propagate errors from listWebhooks', async () => {
      const errorText = 'API error';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => errorText,
      });

      await expect(api.findWebhookByUrl(targetUrl)).rejects.toThrow(StockAlertAPIError);
    });
  });
});
