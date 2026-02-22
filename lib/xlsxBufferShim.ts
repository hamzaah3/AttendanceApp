/**
 * Polyfill Buffer for React Native so the xlsx library can use it internally.
 * Import this file before importing xlsx (e.g. at top of reports.tsx).
 */
import { Buffer } from 'buffer';

if (typeof global !== 'undefined' && typeof (global as any).Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}
