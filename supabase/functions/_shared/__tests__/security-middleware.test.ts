
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Mock supabase client
const createMockChain = () => {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    single: () => ({ data: null }),
  };
  return chain;
};

vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: 50 }),
    from: () => createMockChain(),
    auth: {
      getUser: () => ({ data: { user: { id: 'user1' } }, error: null }),
    },
  }),
}));

// Mock enterprise monitoring
vi.mock('../enterprise-monitoring.ts', () => ({
  enterpriseMonitor: {
    logSecurityEvent: vi.fn(),
    logEvent: vi.fn(),
  },
}));

describe('EnterpriseSecurity - GeoIP', () => {
  let enterpriseSecurity: any;

  beforeAll(async () => {
    // Mock Deno global
    globalThis.Deno = {
      env: {
        get: (key: string) => {
          if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
          if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-key';
          return undefined;
        },
      },
    } as any;

    // Dynamic import to ensure Deno is mocked before module evaluation
    const mod = await import('../security-middleware.ts');
    enterpriseSecurity = mod.enterpriseSecurity;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use Cloudflare headers when available', async () => {
    const req = new Request('https://example.com', {
      headers: {
        'cf-ipcountry': 'GB',
        'cf-ipcity': 'London',
        'cf-region-code': 'ENG',
        'cf-latitude': '51.5074',
        'cf-longitude': '-0.1278',
        'cf-timezone': 'Europe/London',
      },
    });

    const context = await enterpriseSecurity.performSecurityCheck(req, {
      enableGeoCheck: true,
    });

    expect(context.geoData).toEqual({
      country: 'GB',
      region: 'ENG',
      city: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: 'Europe/London',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fallback to ipapi.co when Cloudflare headers are missing', async () => {
    const req = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '8.8.8.8',
      },
    });

    const mockGeoData = {
      country_code: 'US',
      region_code: 'CA',
      city: 'Mountain View',
      latitude: 37.386,
      longitude: -122.0838,
      timezone: 'America/Los_Angeles',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockGeoData,
    });

    const context = await enterpriseSecurity.performSecurityCheck(req, {
      enableGeoCheck: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://ipapi.co/8.8.8.8/json/'),
      expect.anything()
    );

    expect(context.geoData).toEqual({
      country: 'US',
      region: 'CA',
      city: 'Mountain View',
      latitude: 37.386,
      longitude: -122.0838,
      timezone: 'America/Los_Angeles',
    });
  });

  it('should handle GeoIP service failure gracefully', async () => {
    const req = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '8.8.8.8',
      },
    });

    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const context = await enterpriseSecurity.performSecurityCheck(req, {
      enableGeoCheck: true,
    });

    expect(context.geoData).toBeUndefined();
  });
});
