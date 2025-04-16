import './util/polyfill.js';
import './workers/workerPool.js';
export { default as S2Map } from './s2Map.js';

export * from './s2Map.js';
export * from './style/style.spec.js';
export * from './plugins/index.js';
export * from './util/index.js';

export type * from './workers/worker.spec.js';

/**
 * Creator of the library:
 * Github handle - @CraigglesO
 * LinkedIn - https://www.linkedin.com/in/craig-oconnor/
 * Alias - Mr. Martian
 */
export const creator = 'Mr. Martian'; // I'm a martian, I come from Mars
