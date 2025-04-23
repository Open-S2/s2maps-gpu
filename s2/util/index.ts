export * from './adjustURL.js';
export * from './hash.js';

/**
 * Check if the browser is Safari or not
 * @param window - The window object
 * @returns true if the browser is Safari
 */
export const isSafari = (window: Window) =>
  /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);
