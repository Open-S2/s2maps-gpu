import {
  loadModule,
  loadModuleWithCache,
  loadStaticModule,
  transpileGLSL,
  bindEntryPoint,
  defineConstants,
  makeModuleCache,

  bundleToAttribute,
  bundleToAttributes,

  glsl, float, int, uint,
} from './shader';

import {
  bindBundle,
  bindModule,
  bindingsToLinks,
  bindingToModule,
  sourceToModule,
  resolveBindings,
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
  getPreamble,
  setPreamble,
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

import { parser } from './grammar/glsl';

export {
  loadModule,
  loadModuleWithCache,
  loadStaticModule,
  transpileGLSL,
  bindEntryPoint,
  defineConstants,
  makeModuleCache,

  bundleToAttribute,
  bundleToAttributes,

  glsl, float, int, uint,
} from './shader';

export {
  bindBundle,
  bindModule,
  bindingsToLinks,
  bindingToModule,
  sourceToModule,
  resolveBindings,
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
  getPreamble,
  setPreamble,
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

export const GLSLLinker = {
  loadModule,
  loadModuleWithCache,
  loadStaticModule,
  transpileGLSL,
  bindEntryPoint,
  bundleToAttribute,
  bundleToAttributes,
  glsl, float, int, uint,

  defineConstants,

  linkBundle,
  linkModule,
  linkCode,
  getPreamble,
  setPreamble,

  bindBundle,
  bindModule,
  bindingsToLinks,
  bindingToModule,
  sourceToModule,
  resolveBindings,

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

export { parser } from './grammar/glsl';


export default GLSLLinker;