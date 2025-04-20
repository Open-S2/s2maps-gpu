import { beforeAll, expect, test } from 'bun:test';
import { parseHash, setHash } from 'util/hash';

// inject polyfill for this test case
beforeAll(async () => {
  await import('../happyDOM');
});

test('setHash', () => {
  setHash({ zoom: 1, lon: 2, lat: 3, bearing: 4, pitch: 5 });
  const hash = window.location.hash;
  expect(hash).toEqual('#1/2/3/4/5');
  const view = parseHash();
  expect(view).toEqual({ zoom: 1, lon: 2, lat: 3, bearing: 4, pitch: 5 });
});

test('parseHash', () => {
  window.location.hash = '#-1/-2/-3/-4/-5';
  const view = parseHash();
  expect(view).toEqual({ zoom: -1, lon: -2, lat: -3, bearing: -4, pitch: -5 });
});
