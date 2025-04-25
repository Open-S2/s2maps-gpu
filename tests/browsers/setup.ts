import { expect } from 'vitest';

expect.addSnapshotSerializer({
  /**
   * Matches any string
   * @param val - input
   * @returns true if it's a string
   */
  test: (val: unknown): val is string => typeof val === 'string',

  /**
   * Strips absolute prefix up to the project folder
   * @param val - input
   * @returns updated path
   */
  print: (val: unknown) => '"' + (val as string).replace(/^.*\/s2maps-gpu\//, '') + '"',
});
