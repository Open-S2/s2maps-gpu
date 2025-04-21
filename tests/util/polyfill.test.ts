import { isSafari } from 'util/polyfill.js';
import { describe, expect, test } from 'bun:test';

describe('polyfill', () => {
  test('isSafari', () => {
    expect(isSafari(window)).toBe(true);
  });

  test('isSafari on a chrome browser', () => {
    expect(
      /^((?!chrome|android).)*safari/i.test(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  test('isSafari on an android browser', () => {
    expect(
      /^((?!chrome|android).)*safari/i.test(
        'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121',
      ),
    ).toBe(false);
  });

  test('isSafari on a firefox browser', () => {
    expect(
      /^((?!chrome|android).)*safari/i.test(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
      ),
    ).toBe(false);
  });
});
