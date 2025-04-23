import type { S2Map } from 's2/index.js';

declare global {
  /** Expose the testMap to global scope for testing purposes */
  interface Window {
    testMap: S2Map;
  }
}
