import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
// import v8toIstanbul from 'v8-to-istanbul';

import type { S2Map } from 's2/index.ts';

const istanbulCLIOutput = path.join(process.cwd(), '.nyc_output');

// https://playwright.dev/docs/api/class-coverage

/** Store the coverage in the .nyc_output folder */
export function storeCoverage(): void {
  const codeCoverageAsJson = JSON.stringify(window.__coverage__ as Record<string, unknown>);
  (window as unknown as { collectCoverage: typeof collectCoverage }).collectCoverage(
    codeCoverageAsJson,
  );
}

/**
 * Collect the coverage
 * @param coverageJson - The coverage to collect as a json string
 */
export function collectCoverage(coverageJson: string): void {
  if (coverageJson !== undefined) {
    const codeCoverageFilePath = path.join(istanbulCLIOutput, `coverage_${generateUUID()}.json`);
    fs.writeFileSync(codeCoverageFilePath, coverageJson);
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
