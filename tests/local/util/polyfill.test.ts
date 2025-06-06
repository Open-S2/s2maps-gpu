// import { isSafari } from 'util/index';
import { describe, expect, it } from 'vitest';

describe('isSafari polyfill', () => {
  it('isSafari on a chrome browser', () => {
    expect(
      /^((?!chrome|android).)*safari/i.test(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it('isSafari on safari browser', () => {
    expect(
      /^((?!chrome|android).)*safari/i.test(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      ),
    );
  });

  it('isSafari on an android browser', () => {
    expect(
      /^((?!chrome|android).)*safari/i.test(
        'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121',
      ),
    ).toBe(false);
  });

  it('isSafari on a firefox browser', () => {
    expect(
      /^((?!chrome|android).)*safari/i.test(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
      ),
    ).toBe(false);
  });
});
