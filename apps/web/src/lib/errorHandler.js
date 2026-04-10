/**
 * Error Suppression & Logging Utility
 * Suppresses non-critical console errors while maintaining important ones
 *
 * Usage in app:
 *   import { setupErrorHandling } from './lib/errorHandler'
 *   setupErrorHandling()
 */

const SUPPRESSED_PATTERNS = [
  // PWA/Workbox messages (informational)
  /workbox Router is responding/,
  /generateSW options.warn.*invalid version/i,

  // React DevTools message (informational)
  /Download the React DevTools/,

  // Common browser warnings (non-critical)
  /validateDOMNesting.*div cannot appear as descendant/i,
  /Failed to fetch icon from manifest/i,
  /Error while trying to use.*icon from.*Manifest/i,

  // Socket.io connection messages (handled by retry logic)
  /Socket connection error.*attempt \d+\/5/,
  /WebSocket is closed before the connection is established/,

  // Cache warnings (informational)
  /max-age.*seconds.*expires.*ignored/i,
];

const CRITICAL_PATTERNS = [
  // Always show critical errors
  /Uncaught.*Error/,
  /SyntaxError/,
  /TypeError.*is not a function/,
  /Cannot read propert/,
  /Failed to parse/,
];

export function setupErrorHandling() {
  // Suppress non-critical console errors
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = function(...args) {
    const message = String(args[0]);

    // Always show critical errors
    if (CRITICAL_PATTERNS.some((p) => p.test(message))) {
      originalError.apply(console, args);
      return;
    }

    // Suppress non-critical patterns
    if (SUPPRESSED_PATTERNS.some((p) => p.test(message))) {
      // Log at debug level instead (not visible to user)
      if (process.env.DEBUG) {
        originalLog.apply(console, ['[SUPPRESSED]', ...args]);
      }
      return;
    }

    // Show everything else
    originalError.apply(console, args);
  };

  console.warn = function(...args) {
    const message = String(args[0]);

    if (SUPPRESSED_PATTERNS.some((p) => p.test(message))) {
      if (process.env.DEBUG) {
        originalLog.apply(console, ['[SUPPRESSED]', ...args]);
      }
      return;
    }

    originalWarn.apply(console, args);
  };

  // Handle unhandled promise rejections gracefully
  window.addEventListener('unhandledrejection', (event) => {
    const message = String(event.reason);

    // Suppress known non-critical rejections
    if (
      message.includes('504') ||
      message.includes('timeout') ||
      message.includes('Socket connection') ||
      message.includes('WebSocket')
    ) {
      // Don't prevent default for these - they're handled
      event.preventDefault();
      return;
    }

    // Show critical rejections
    originalError('Unhandled Promise Rejection:', event.reason);
  });
}

// Alternative: Suppress specific error patterns without setup
export function suppressError(pattern) {
  SUPPRESSED_PATTERNS.push(pattern);
}

export function isCriticalError(message) {
  return CRITICAL_PATTERNS.some((p) => p.test(String(message)));
}

export function isNonCriticalError(message) {
  return SUPPRESSED_PATTERNS.some((p) => p.test(String(message)));
}
