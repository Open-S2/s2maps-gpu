import {
  loadModule,
  loadModuleWithCache,
  loadStaticModule,
  transpileWGSL,
  bindEntryPoint,
  defineConstants,
  makeModuleCache,

  bundleToAttribute,
  bundleToAttributes,

  wgsl, f32, i32, u32,
} from './shader';

import {
  bindBundle,
  bindModule,
  bindingsToLinks,
  bindingToModule,
  sourceToModule,
  resolveBindings,
  extractBindings,
} from './bind';

import {
  castTo,
  swizzleTo,
} from './cast';

import {
  chainTo,
} from './chain';

import {
  diffBy,
} from './diff';

import {
  linkBundle,
  linkModule,
  linkCode,
} from './link';

import {
  makeASTParser,
  compressAST,
  decompressAST,
  rewriteUsingAST,
} from './ast';

import {
  getBundleEntry,
  getBundleHash,
  getBundleKey,
} from '../util/bundle';

import { parser } from './highlight/wgsl';

export {
  loadModule,
  loadModuleWithCache,
  loadStaticModule,
  transpileWGSL,
  bindEntryPoint,
  defineConstants,
  makeModuleCache,

  bundleToAttribute,
  bundleToAttributes,

  wgsl, f32, i32, u32,
} from './shader';

export {
  bindBundle,
  bindModule,
  bindingsToLinks,
  bindingToModule,
  sourceToModule,
  resolveBindings,
  extractBindings,
} from './bind';

export {
  castTo,
  swizzleTo,
} from './cast';

export {
  chainTo,
} from './chain';

export {
  diffBy,
} from './diff';

export {
  linkBundle,
  linkModule,
  linkCode,
} from './link';

export {
  makeASTParser,
  compressAST,
  decompressAST,
  rewriteUsingAST,
} from './ast';

export {
  getBundleEntry,
  getBundleHash,
  getBundleKey,
} from '../util/bundle';

export const WGSLLinker = {
  loadModule,
  loadModuleWithCache,
  loadStaticModule,
  transpileWGSL,
  bindEntryPoint,
  bundleToAttribute,
  bundleToAttributes,
  wgsl, f32, i32, u32,

  defineConstants,

  linkBundle,
  linkModule,
  linkCode,

  bindBundle,
  bindModule,
  bindingsToLinks,
  bindingToModule,
  sourceToModule,
  resolveBindings,
  extractBindings,

  castTo,
  chainTo,
  diffBy,
  swizzleTo,

  makeASTParser,
  compressAST,
  decompressAST,
  rewriteUsingAST,

  makeModuleCache,

  getBundleEntry,
  getBundleHash,
  getBundleKey,

  parser,
};

export { parser } from './highlight/wgsl';

export default WGSLLinker;