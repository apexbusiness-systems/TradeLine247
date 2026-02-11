import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/react';
import { logger } from './logger';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('Logger Sentry Integration', () => {
  const originalIsDevelopment = logger.isDevelopment;
  // We need to spy on console methods to verify they are still called
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate production environment for logger
    logger.isDevelopment = false;
  });

  afterEach(() => {
    logger.isDevelopment = originalIsDevelopment;
  });

  it('should send errors to Sentry', async () => {
    const error = new Error('Test error');
    const metadata = { userId: '123' };

    logger.error('Something went wrong', error, metadata);

    // Verify console.error is still called
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR]',
      'Something went wrong',
      expect.objectContaining({ userId: '123' })
    );

    // Verify Sentry.captureException is called
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        level: 'error',
        extra: expect.objectContaining(metadata),
        tags: expect.objectContaining({ source: 'logger' }),
      })
    );
  });

  it('should send warnings to Sentry', () => {
    const metadata = { feature: 'auth' };

    logger.warn('Deprecated usage', metadata);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[WARN]',
      'Deprecated usage',
      metadata
    );

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Deprecated usage',
      expect.objectContaining({
        level: 'warning',
        extra: metadata,
        tags: { source: 'logger' },
      })
    );
  });

  it('should add info logs as breadcrumbs', () => {
    const metadata = { action: 'login' };

    logger.info('User logged in', metadata);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[INFO]',
      'User logged in',
      metadata
    );

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'info',
        message: 'User logged in',
        level: 'info',
        data: metadata,
      })
    );
  });

  it('should handle errors in Sentry calls gracefully', () => {
    // Mock Sentry to throw an error
    vi.mocked(Sentry.captureException).mockImplementationOnce(() => {
      throw new Error('Sentry failed');
    });

    // Should not throw
    expect(() => {
      logger.error('Error that crashes Sentry');
    }).not.toThrow();

    // Should log the Sentry failure
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LOGGER] Sentry integration failed:',
      expect.any(Error)
    );
  });
});
