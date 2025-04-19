import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

import type { S2Map } from 's2/index.ts';

const istanbulCLIOutput = path.join(process.cwd(), '.nyc_output');

/**
 * Store the coverage in the .nyc_output folder
 * @param coverageJSON - the coverage json
 */
export async function storeCoverage(coverageJSON: string): Promise<void> {
  await fs.promises.mkdir(istanbulCLIOutput, { recursive: true });
  fs.writeFileSync(
    path.join(istanbulCLIOutput, `playwright_coverage_${generateUUID()}.json`),
    coverageJSON,
  );
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
