import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';

// jsdom doesn't provide these; the e2ee-auth package (and Web Crypto-based
// export/import helpers) need real implementations, not jsdom's absence.
if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

Object.defineProperty(global, 'crypto', {
  value: webcrypto,
  configurable: true,
});