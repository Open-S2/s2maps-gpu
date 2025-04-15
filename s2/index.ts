import './util/polyfill';
import './workers/workerPool';
export { default as S2Map } from './s2Map';

export * from './s2Map';
export * from './style/style.spec';
export * from './plugins';
export * from './util';

export type * from './workers/worker.spec';

/**
 * Creator of the library:
 * Github handle - @CraigglesO
 * LinkedIn - https://www.linkedin.com/in/craig-oconnor/
 * Alias - Mr. Martian
 */
export const creator = 'Mr. Martian'; // I'm a martian, I come from Mars
