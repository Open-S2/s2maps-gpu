import { adjustURL } from 'util/index.js';
import { describe, expect, test } from 'bun:test';

describe('adjustURL', () => {
  test('should replace s2maps:// with opens2 api url', () => {
    const input = 's2maps://test/1';
    const expected = 'https://api.s2maps.com/test/1';
    expect(adjustURL(input)).toBe(expected);
  });

  test('should replace mapbox:// with mapbox api url', () => {
    const input = 'mapbox://test/2';
    const expected = 'https://api.mapbox.com/test/2';
    expect(adjustURL(input)).toBe(expected);
  });

  test('should replace opens2:// with opens2 api url', () => {
    const input = 'opens2://test/2';
    const expected = 'https://api.opens2.com/test/2';
    expect(adjustURL(input)).toBe(expected);
  });

  test('should replace baseURL:// with input baseURL', () => {
    const input = 'baseURL://test/2';
    const baseURL = 'http://localhost:3000';
    const expected = 'http://localhost:3000/test/2';
    expect(adjustURL(input, { baseURL })).toBe(expected);
  });

  test('should replace apiURL:// with input apiURL', () => {
    const input = 'apiURL://test/2';
    const apiURL = 'http://localhost:3000';
    const expected = 'http://localhost:3000/test/2';
    expect(adjustURL(input, { apiURL })).toBe(expected);
  });
});
