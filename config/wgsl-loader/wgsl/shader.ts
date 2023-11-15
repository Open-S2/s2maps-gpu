import { Tree } from '@lezer/common';
import { ParsedModule, ParsedModuleCache, ShaderDefine } from './types';

import { makeLoadModule, makeLoadModuleWithCache } from '../util/shader';
import { makeBundleToAttribute, makeBundleToAttributes } from '../util/bundle';
import { makeTranspile } from '../util/transpile';

import { makeASTParser, compressAST, decompressAST } from './ast';
import { toTypeString, toTypeArgs } from './type';
import { removeComments, removeWhiteSpace, renameLocals } from './minify';
import { parser } from './grammar/wgsl';

import LRU from 'lru-cache';
import zip from 'lodash/zip';

export { loadStaticModule, loadVirtualModule, bindEntryPoint } from '../util/shader';

/** LRU cache for parsed shader code */
export const makeModuleCache = (options: Record<string, any> = {}) => new LRU<number, ParsedModule>({
  max: 100,
  ...options,
});

export const DEFAULT_CACHE = makeModuleCache();

/** Parse WGSL code into lezer tree */
export const parseShader = (code: string): Tree => parser.parse(code);

/** Parse a code module into its in-memory representation (AST + symbol table) */
export const loadModule = makeLoadModule(parseShader, makeASTParser, compressAST, decompressAST);

/** Use cache to load modules */
export const loadModuleWithCache = makeLoadModuleWithCache(loadModule, DEFAULT_CACHE);

/** Make WGSL constant definitions */
export const defineConstants = (defs: Record<string, ShaderDefine>): string => {
  const out = [];
  for (let k in defs) if (k[0] !== '@' && defs[k] != null) out.push(`const ${k} = ${defs[k]};`);
  return out.join("\n");
}

/** Make WGSL constant definitions */
export const defineEnables = (enabled: string[]) => enabled.length ? `enable ${enabled.join(', ')};` : '';

/** Convert a bundle with a defined entry point to a definition for that attribute or type. */
export const bundleToAttribute = makeBundleToAttribute(toTypeString, toTypeArgs);

/** Convert a bundle to a definition for all its attributes. */
export const bundleToAttributes = makeBundleToAttributes(toTypeString, toTypeArgs);

// Simple whitespace / comment removal
const minifyCode = (code: string) => {
  code = removeComments(code);
  code = renameLocals(code);
  code = removeWhiteSpace(code);
  return code;
};

/** ES/CommonJS Transpiler */
export const transpileWGSL = makeTranspile('wgsl', 'wgsl', loadModule, compressAST, minifyCode);

/** Templated literal syntax:

```tsx
wgsl`...`
``` */
export const wgsl = (literals: TemplateStringsArray, ...tokens: string[]) => {
  const code = zip(literals, tokens).flat();
  return loadModuleWithCache(code.join(''));
};

/** Format `number` as WGSL `f32` */
export const f32 = (x: number) => {
  const s = x.toString();
  return (!s.match(/\./)) ? s + '.0' : s;  
};
/** Format `number` as WGSL `u32` */
export const u32 = (x: number) => Math.round(x).toString() + 'u';
/** Format `number` as WGSL `i32` */
export const i32 = (x: number) => Math.round(x).toString();
