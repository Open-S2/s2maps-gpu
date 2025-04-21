import coalesceField from 'style/coalesceField.js';
import { expect, test } from 'bun:test';

import type { Properties } from 's2';

test('coalesceField', () => {
  const properties: Properties = { abbr: 'U.S.', name: 'United States' };
  const field = ['"', '?abbr,?name', '"'];

  expect(coalesceField(field, properties)).toBe('"U.S."');

  delete properties.abbr;

  expect(coalesceField(field, properties)).toBe('"United States"');
});
