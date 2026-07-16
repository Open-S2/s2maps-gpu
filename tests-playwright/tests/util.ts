import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

import type { S2Map } from 's2/index.ts';

const istanbulCLIOutput = path.join(process.cwd(), '.nyc_output');

declare global {
  interface Window {
    __coverage__?: Record<string, unknown>;
    collectCoverage: (coverageJson: string[]) => void;
  }
}

/**
 * Collects coverage from both the main thread and all active background workers,
 * then sends them to the Node environment via the exposed `collectCoverage` binding.
 */
export async function storeCoverage(): Promise<void> {
  const coverages: string[] = [];

  // 1. Gather Main Thread Coverage
  if (window.__coverage__) {
    coverages.push(JSON.stringify(window.__coverage__));
  } else {
    console.warn('[Coverage] No coverage found on the main window thread.');
  }

  // 2. Gather Worker Coverage (if a worker pool exists)
  if (window.S2WorkerPool) {
    const pool = window.S2WorkerPool;
    const activeWorkers = [pool.sourceWorker, ...(pool.workers ?? [])].filter(Boolean) as Worker[];

    console.info(`[Coverage] Requesting coverage from ${activeWorkers.length} active worker(s)...`);

    const workerCoverages = await Promise.all(
      activeWorkers.map((worker, index) => {
        return new Promise<Record<string, unknown> | null>((resolve) => {
          // Track timeout to prevent tests hanging if a worker is dead or locked
          const timeoutId = setTimeout(() => {
            worker.removeEventListener('message', messageListener);
            console.error(`[Coverage] Worker #${index} failed to respond within 2 seconds.`);
            resolve(null);
          }, 2000);
          const messageListener = (event: MessageEvent) => {
            clearTimeout(timeoutId);
            worker.removeEventListener('message', messageListener);
            resolve(event.data);
          };
          // Start listening without overwriting existing onmessage hooks
          worker.onmessage = messageListener;
          worker.postMessage('__coverage__');
        });
      }),
    );

    // Create a safe serializer helper
    const safeStringify = (obj: Record<string, unknown>): string => {
      return JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
    };

    // Parse and add valid worker coverages
    for (const coverage of workerCoverages) {
      if (coverage) coverages.push(safeStringify(coverage));
    }
  }

  window.collectCoverage(coverages);
}

/**
 * Collect the coverage
 * @param coverages - The coverage to collect as a json string
 */
export function collectCoverage(coverages: string[]): void {
  for (const coverage of coverages) {
    const codeCoverageFilePath = path.join(istanbulCLIOutput, `coverage_${generateUUID()}.json`);
    fs.writeFileSync(codeCoverageFilePath, coverage);
  }
}

/**
 * Generate a random UUID
 * @returns a random UUID
 */
export function generateUUID(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Mechanic to ensure the map is fully rendered
 * @returns true if the map is fully rendered. false if it failed somehow
 */
export async function waitMap(): Promise<boolean> {
  const s2Map: S2Map = window.testMap;
  let failed = false;
  if (s2Map.isReady) return true;
  return await new Promise<boolean>((resolve) => {
    s2Map.addEventListener(
      'ready',
      (): void => {
        // wait for the map to be fully rendered
        s2Map
          .awaitFullyRendered()
          .then(() => {
            resolve(!failed);
          })
          .catch(() => {
            resolve(false);
          });
      },
      { once: true },
    );
    // set a timeout to catch failed renders
    setTimeout(() => {
      failed = true;
      resolve(false);
    }, 5_000);
  });
}
