import { expect } from 'vitest';

expect.addSnapshotSerializer({
  /**
   * Matches any string
   * @param val
   */
  test: (val: unknown): val is string => typeof val === 'string',

  /**
   * Strips absolute prefix up to the project folder
   * @param val
   */
  print: (val: unknown) => '"' + (val as string).replace(/^.*\/s2maps-gpu\//, '') + '"',
});
