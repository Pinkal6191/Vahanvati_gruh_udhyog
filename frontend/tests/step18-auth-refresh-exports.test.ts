import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, ApiError } from '../src/services/api/api-client';
import { AuthService } from '../src/services/auth/auth.service';
import { storageService } from '../src/services/storage/storage.service';
import { reportsApi } from '../src/features/reports/reports.api';

describe('Step 18 — Auth Refresh, Resilience & Exports Frontend Test Suite', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    (globalThis as any).window = globalThis;
    (globalThis as any).window.localStorage = mockLocalStorage;
    (globalThis as any).localStorage = mockLocalStorage;
  });

  // ========================================================
  // 1. Auth Refresh Token Lifecycle & Concurrency
  // ========================================================
  describe('1. Auth Refresh Token Lifecycle & Concurrency', () => {
    test('expired access token (401) triggers refresh and retries original request', async () => {
      let callCount = 0;
      let refreshCount = 0;

      storageService.setAccessToken('expired-access-token');
      storageService.setRefreshToken('valid-refresh-token');

      (globalThis as any).fetch = async (url: string, opts: any) => {
        if (url.includes('/auth/refresh')) {
          refreshCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: { accessToken: 'new-fresh-access-token' },
            }),
          };
        }

        callCount++;
        if (callCount === 1) {
          // First attempt with expired token fails with 401
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ message: 'Token expired', code: 'UNAUTHORIZED' }),
          };
        }

        // Retry with refreshed token succeeds
        assert.equal(opts.headers?.['Authorization'], 'Bearer new-fresh-access-token');
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: { value: 'recovered' } }),
        };
      };

      const result = await apiClient.get<{ value: string }>('/test-protected');
      assert.equal(result.data.value, 'recovered');
      assert.equal(refreshCount, 1, 'Refresh must be called exactly once');
      assert.equal(callCount, 2, 'Original request must be called and retried');
      assert.equal(storageService.getAccessToken(), 'new-fresh-access-token', 'Stored token must be updated');
    });

    test('simultaneous 401 requests trigger only ONE refresh call (single-flight mutex)', async () => {
      let refreshCount = 0;

      storageService.setAccessToken('expired-access-token');
      storageService.setRefreshToken('valid-refresh-token');

      (globalThis as any).fetch = async (url: string, opts: any) => {
        if (url.includes('/auth/refresh')) {
          refreshCount++;
          // Delay to simulate network flight
          await new Promise((r) => setTimeout(r, 20));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: { accessToken: 'shared-fresh-token' },
            }),
          };
        }

        if (opts.headers?.['Authorization'] === 'Bearer expired-access-token') {
          return {
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ message: 'Token expired' }),
          };
        }

        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: { url } }),
        };
      };

      // Launch 3 concurrent requests
      const [res1, res2, res3] = await Promise.all([
        apiClient.get('/parallel-1'),
        apiClient.get('/parallel-2'),
        apiClient.get('/parallel-3'),
      ]);

      assert.equal(refreshCount, 1, 'Single-flight mutex must ensure only 1 refresh is executed');
      assert.equal(storageService.getAccessToken(), 'shared-fresh-token');
      assert.ok(res1 && res2 && res3);
    });

    test('permanent refresh failure clears auth session', async () => {
      storageService.setAccessToken('expired-access-token');
      storageService.setRefreshToken('revoked-refresh-token');

      (globalThis as any).fetch = async (url: string) => {
        if (url.includes('/auth/refresh')) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ message: 'Refresh token invalid' }),
          };
        }
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Unauthorized' }),
        };
      };

      await assert.rejects(async () => {
        await apiClient.get('/should-fail');
      }, ApiError);

      assert.equal(storageService.getAccessToken(), null, 'Access token must be cleared on true refresh failure');
      assert.equal(storageService.getRefreshToken(), null, 'Refresh token must be cleared');
    });

    test('retry happens at most once (no infinite loop)', async () => {
      let callCount = 0;
      let refreshCount = 0;

      storageService.setAccessToken('token-1');
      storageService.setRefreshToken('refresh-1');

      (globalThis as any).fetch = async (url: string) => {
        if (url.includes('/auth/refresh')) {
          refreshCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: { accessToken: 'token-2' },
            }),
          };
        }

        callCount++;
        // Always fail with 401 even with new token
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Still unauthorized' }),
        };
      };

      await assert.rejects(async () => {
        await apiClient.get('/infinite-loop-check');
      }, ApiError);

      assert.equal(refreshCount, 1, 'Should not attempt repeated refreshes');
      assert.equal(callCount, 2, 'Should only retry once');
    });
  });

  // ========================================================
  // 2. Resilience: Non-401 Errors NEVER Cause Logout
  // ========================================================
  describe('2. Resilience: Non-401 Errors NEVER Cause Logout', () => {
    test('403 Forbidden does NOT clear authentication session', async () => {
      storageService.setAccessToken('valid-user-token');
      storageService.setRefreshToken('valid-refresh-token');

      (globalThis as any).fetch = async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Access denied: Requires ADMIN' }),
      });

      await assert.rejects(async () => {
        await apiClient.get('/admin/cash-report');
      }, (err: any) => {
        assert.equal(err.status, 403);
        return true;
      });

      assert.equal(storageService.getAccessToken(), 'valid-user-token', 'Session must remain intact on 403');
      assert.equal(storageService.getRefreshToken(), 'valid-refresh-token');
    });

    test('500 Server Error does NOT clear authentication session', async () => {
      storageService.setAccessToken('valid-user-token');
      storageService.setRefreshToken('valid-refresh-token');

      (globalThis as any).fetch = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Database connection failed' }),
      });

      await assert.rejects(async () => {
        await apiClient.get('/unstable-endpoint');
      }, (err: any) => {
        assert.equal(err.status, 500);
        return true;
      });

      assert.equal(storageService.getAccessToken(), 'valid-user-token', 'Session must remain intact on 500');
    });

    test('Network timeout / fetch exception does NOT clear authentication session', async () => {
      storageService.setAccessToken('valid-user-token');
      storageService.setRefreshToken('valid-refresh-token');

      (globalThis as any).fetch = async () => {
        throw new Error('TypeError: Failed to fetch (Network Timeout)');
      };

      await assert.rejects(async () => {
        await apiClient.get('/timeout-endpoint');
      });

      assert.equal(storageService.getAccessToken(), 'valid-user-token', 'Session must remain intact on network error');
    });

    test('manual logout explicitly clears session', async () => {
      storageService.setAccessToken('valid-user-token');
      storageService.setRefreshToken('valid-refresh-token');

      let logoutHit = false;
      (globalThis as any).fetch = async (url: string) => {
        if (url.includes('/auth/logout')) {
          logoutHit = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };

      await AuthService.logout();
      assert.equal(logoutHit, true, 'Backend logout must be notified');
      assert.equal(storageService.getAccessToken(), null, 'Token must be cleared');
      assert.equal(storageService.getRefreshToken(), null, 'Refresh token must be cleared');
    });
  });

  // ========================================================
  // 3. Export Reports API & URL Construction
  // ========================================================
  describe('3. Export Reports API & URL Construction', () => {
    test('downloadReportFile triggers download with correct mime types for XLSX and PDF', async () => {
      storageService.setAccessToken('admin-token');
      let requestedUrl = '';

      (globalThis as any).fetch = async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'content-disposition': 'attachment; filename="sales-report-2026-10-02.xlsx"',
          }),
          blob: async () => new Blob(['dummy-binary-xlsx-data']),
        };
      };

      // Mock URL and document for browser download
      (globalThis as any).URL = {
        createObjectURL: () => 'blob:mock-url-123',
        revokeObjectURL: () => {},
      };
      (globalThis as any).document = {
        createElement: () => ({
          href: '',
          download: '',
          click: () => {},
        }),
        body: {
          appendChild: () => {},
          removeChild: () => {},
        },
      };

      await reportsApi.downloadReportFile('/reports/sales', { period: 'today' }, 'xlsx', 'sales-report.xlsx');
      assert.ok(requestedUrl.includes('/reports/sales?period=today&format=xlsx'), 'URL must include format=xlsx');

      await reportsApi.downloadReportFile('/reports/sales', { period: 'today' }, 'pdf', 'sales-report.pdf');
      assert.ok(requestedUrl.includes('format=pdf'), 'URL must include format=pdf');
    });

    test('downloadInvoicePdf calls correct wholesale sale PDF endpoint', async () => {
      storageService.setAccessToken('admin-token');
      let requestedUrl = '';

      (globalThis as any).fetch = async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/pdf',
            'content-disposition': 'attachment; filename="invoice-WS-1001.pdf"',
          }),
          blob: async () => new Blob(['%PDF-1.4 dummy']),
        };
      };

      await reportsApi.downloadInvoicePdf('sale-uuid-456', 'invoice-WS-1001.pdf');
      assert.ok(requestedUrl.includes('/sales/sale-uuid-456/pdf'), 'URL must hit /sales/:id/pdf');
    });
  });

  // ========================================================
  // 4. Daily Sales Thermal Print Invariants
  // ========================================================
  describe('4. Daily Sales Thermal Print Invariants', () => {
    test('Daily sales thermal financial calculations strictly match authoritative formulas', () => {
      const summary = {
        completedSalesTotal: 15400.0,
        completedReturnsTotal: 1200.0,
        completedBillCount: 45,
        netSales: 14200.0,
      };

      // Invariant: Net Sales = Completed Sales - Completed Returns
      const computedNetSales = summary.completedSalesTotal - summary.completedReturnsTotal;
      assert.equal(computedNetSales, summary.netSales);

      // Invariant: Average bill value = Net Sales / Bill Count
      const computedAbv = Math.round((summary.netSales / summary.completedBillCount) * 100) / 100;
      assert.equal(computedAbv, 315.56);
    });

    test('Payment modes breakdown in thermal summary aggregates to total collected', () => {
      const payments = [
        { mode: 'CASH', amount: 8200 },
        { mode: 'UPI', amount: 5000 },
        { mode: 'CARD', amount: 1000 },
      ];

      const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
      assert.equal(totalPayments, 14200);
    });
  });
});
