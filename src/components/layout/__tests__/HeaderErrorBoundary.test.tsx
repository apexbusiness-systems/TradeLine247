import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeaderErrorBoundary } from '../HeaderErrorBoundary';
import { reportReactError } from '@/lib/errorReporter';

// Mock error reporter
vi.mock('@/lib/errorReporter', () => ({
  reportReactError: vi.fn(),
}));

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

describe('HeaderErrorBoundary', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error in tests to avoid noisy output for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock window.location
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('should render children when no error occurs', () => {
    render(
      <HeaderErrorBoundary>
        <div data-testid="child-content">Child Content</div>
      </HeaderErrorBoundary>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByTestId('header-error-fallback')).not.toBeInTheDocument();
  });

  it('should render fallback UI and report error when child throws', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <HeaderErrorBoundary>
        <ThrowError />
      </HeaderErrorBoundary>
    );

    // Verify fallback UI
    expect(screen.getByTestId('header-error-fallback')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByAltText('Built in Canada')).toBeInTheDocument();

    // Verify error reporting
    expect(reportReactError).toHaveBeenCalled();
    expect(reportReactError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ componentStack: expect.any(String) }));
  });

  it('should handle home button click in fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <HeaderErrorBoundary>
        <ThrowError />
      </HeaderErrorBoundary>
    );

    const homeButton = screen.getByText('Home');
    fireEvent.click(homeButton);

    expect(window.location.href).toBe('/');
  });

  it('should handle login button click in fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <HeaderErrorBoundary>
        <ThrowError />
      </HeaderErrorBoundary>
    );

    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);

    expect(window.location.href).toBe('/auth');
  });
});
