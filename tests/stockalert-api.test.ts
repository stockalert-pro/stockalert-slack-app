import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StockAlertAPI,
  StockAlertAPIError,
  type CreateWebhookRequest,
  type WebhookResponse,
} from '../lib/stockalert-api';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const createJsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn(async () => (body !== undefined ? JSON.stringify(body) : '')),
    json: vi.fn(async () => body),
    headers: new Headers({ 'content-type': 'application/json' }),
  }) as unknown as Response;

const createTextResponse = (status: number, text: string, contentType = 'text/plain') =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn(async () => text),
    headers: new Headers({ 'content-type': contentType }),
  }) as unknown as Response;

const expectHeader = (headers: Headers, key: string, value: string) => {
  expect(headers.get(key)).toBe(value);
};

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
      mockFetch.mockResolvedValueOnce(createJsonResponse(mockWebhookResponse));

      const result = await api.createWebhook(webhookData);

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(firstCall).toBeDefined();
      const [url, init] = firstCall;
      expect(url).toBe(`${baseUrl}/webhooks`);
      const headersValue = init.headers ?? {};
      const headers = new Headers(headersValue as Headers | string[][] | Record<string, string>);
      expectHeader(headers, 'Content-Type', 'application/json');
      expectHeader(headers, 'X-API-Key', apiKey);
      expectHeader(headers, 'Accept', 'application/json');
      expect(init.body).toBe(JSON.stringify(webhookData));

      expect(result).toEqual(mockWebhookResponse);
    });

    it('should throw StockAlertAPIError on failed request', async () => {
      const errorText = 'Invalid API key';
      mockFetch.mockResolvedValueOnce(createTextResponse(401, errorText));

      await expect(api.createWebhook(webhookData)).rejects.toThrow(StockAlertAPIError);
    });

    it('should default events when not provided', async () => {
      const webhookWithoutEvents = {
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockWebhookResponse));

      await api.createWebhook(webhookWithoutEvents as CreateWebhookRequest);

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(firstCall).toBeDefined();
      const [, init] = firstCall;
      expect(init.body).toBe(
        JSON.stringify({
          url: webhookWithoutEvents.url,
          events: ['alert.triggered'],
        })
      );
    });

    it('should include status code in error', async () => {
      mockFetch.mockResolvedValueOnce(createTextResponse(400, 'Bad Request'));

      try {
        await api.createWebhook(webhookData);
      } catch (error) {
        expect(error).toBeInstanceOf(StockAlertAPIError);
        expect((error as StockAlertAPIError).statusCode).toBe(400);
        expect((error as StockAlertAPIError).responseText).toBe('Bad Request');
      }
    });

    it('should retry with fallback base URL when HTML is returned', async () => {
      mockFetch
        .mockResolvedValueOnce(
          createTextResponse(404, '<!DOCTYPE html><html>Not found</html>', 'text/html')
        )
        .mockResolvedValueOnce(createJsonResponse(mockWebhookResponse));

      const result = await api.createWebhook(webhookData);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstCall = mockFetch.mock.calls[0] as [string];
      const secondCall = mockFetch.mock.calls[1] as [string];
      expect(firstCall?.[0]).toBe(`${baseUrl}/webhooks`);
      expect(secondCall?.[0]).toBe('https://api.test.com/api/v1/webhooks');
      expect(result).toEqual(mockWebhookResponse);
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
      mockFetch.mockResolvedValueOnce(createJsonResponse(mockWebhooks));

      const result = await api.listWebhooks();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/webhooks`, expect.anything());
      expect(result).toEqual(mockWebhooks);
    });

    it('should handle response with webhooks property', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse({ webhooks: mockWebhooks }));

      const result = await api.listWebhooks();
      expect(result).toEqual(mockWebhooks);
    });

    it('should handle response with data property', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse({ data: mockWebhooks }));

      const result = await api.listWebhooks();
      expect(result).toEqual(mockWebhooks);
    });

    it('should return empty array for unexpected response format', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse({ unexpected: 'format' }));

      const result = await api.listWebhooks();
      expect(result).toEqual([]);
    });

    it('should return empty array for null response', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse(null));

      const result = await api.listWebhooks();
      expect(result).toEqual([]);
    });

    it('should throw StockAlertAPIError on failed request', async () => {
      mockFetch.mockResolvedValueOnce(createTextResponse(500, 'Server error'));

      await expect(api.listWebhooks()).rejects.toThrow(StockAlertAPIError);
    });
  });

  describe('deleteWebhook', () => {
    const webhookId = 'webhook_123';

    it('should successfully delete a webhook', async () => {
      mockFetch.mockResolvedValueOnce(createTextResponse(200, ''));

      await expect(api.deleteWebhook(webhookId)).resolves.not.toThrow();

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(firstCall).toBeDefined();
      const [url, init] = firstCall;
      expect(url).toBe(`${baseUrl}/webhooks/${webhookId}`);
      const headersValue = init.headers ?? {};
      const headers = new Headers(headersValue as Headers | string[][] | Record<string, string>);
      expectHeader(headers, 'X-API-Key', apiKey);
    });

    it('should throw StockAlertAPIError on failed request', async () => {
      mockFetch
        .mockResolvedValueOnce(createTextResponse(404, 'Webhook not found'))
        .mockResolvedValueOnce(createTextResponse(404, 'Webhook not found'))
        .mockResolvedValueOnce(createTextResponse(404, 'Webhook not found'));

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
      mockFetch.mockResolvedValueOnce(createJsonResponse(mockWebhooks));

      const result = await api.findWebhookByUrl(targetUrl);
      expect(result).toEqual(mockWebhooks[0]);
    });

    it('should return null if webhook not found', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse(mockWebhooks));

      const result = await api.findWebhookByUrl('https://notfound.com/webhook');
      expect(result).toBeNull();
    });

    it('should propagate errors from listWebhooks', async () => {
      mockFetch.mockResolvedValueOnce(createTextResponse(500, 'API error'));

      await expect(api.findWebhookByUrl(targetUrl)).rejects.toThrow(StockAlertAPIError);
    });
  });

  describe('testWebhook', () => {
    const webhookTestRequest = {
      url: 'https://example.com/webhook',
      secret: 'whsec_test_secret',
    };

    it('should send a webhook test and return payload from envelope', async () => {
      const mockEnvelope = {
        success: true,
        data: {
          status: 200,
          status_text: 'OK',
          response: 'ok',
        },
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockEnvelope));

      const result = await api.testWebhook(webhookTestRequest);
      expect(result).toEqual(mockEnvelope.data);
    });

    it('should normalize direct response format', async () => {
      const mockDirectResponse = {
        status: 202,
        statusText: 'Accepted',
        response: 'queued',
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockDirectResponse));

      const result = await api.testWebhook(webhookTestRequest);
      expect(result).toEqual({
        status: 202,
        status_text: 'Accepted',
        response: 'queued',
      });
    });

    it('should throw StockAlertAPIError on failed request', async () => {
      mockFetch.mockResolvedValueOnce(createTextResponse(500, 'Internal error'));

      await expect(api.testWebhook(webhookTestRequest)).rejects.toThrow(StockAlertAPIError);
    });

    it('should throw error on unexpected response format', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse({ success: true }));

      await expect(api.testWebhook(webhookTestRequest)).rejects.toThrow(
        'Unexpected webhook test response format'
      );
    });
  });
});
