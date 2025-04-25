import parseFeature from 'style/parseFeature.js';
import { expect, test } from 'vitest';

import type { LayerWorkerFunction, Properties } from 'style/style.spec.js';

test('parseFeature', (): void => {
  /**
   * Callback for the layer feature function
   * @param input - input value
   * @returns output value
   */
  const cb = (input: string): string => {
    return input === 'red' ? 'blue' : 'red';
  };
  const func: LayerWorkerFunction<string> = parseFeature('red', cb);

  const code: number[] = [];
  const properties: Properties = {
    name: 'Melbourne',
  };

  expect(func(code, properties, 4)).toEqual('blue');
});
