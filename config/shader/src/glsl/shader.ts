import { Tree } from '@lezer/common';
import { ParsedModule, ParsedModuleCache, ShaderDefine } from './types';

import { makeLoadModule, makeLoadModuleWithCache } from '../util/shader';
import { makeBundleToAttribute, makeBundleToAttributes } from '../util/bundle';
import { makeTranspile } from '../util/transpile';

import { makeASTParser, compressAST, decompressAST } from './ast';
import { toTypeString, toTypeArgs } from './type';
import { parser } from './grammar/glsl';
import LRU from 'lru-cache';
import zip from 'lodash/zip';

export { loadStaticModule, loadVirtualModule, bindEntryPoint } from '../util/shader';

/** LRU cache for parsed shader code */
export const makeModuleCache = (options: Record<string, any> = {}) => new LRU<number, ParsedModule>({
  max: 100,
  ...options,
});

export const DEFAULT_CACHE = makeModuleCache();

/** Parse GLSL code into lezer tree */
export const parseShader = (code: string): Tree => parser.parse(code);

/** Parse a code module into its in-memory representation (AST + symbol table) */
export const loadModule = makeLoadModule(parseShader, makeASTParser, compressAST, decompressAST);

/** Use cache to load modules */
export const loadModuleWithCache = makeLoadModuleWithCache(loadModule, DEFAULT_CACHE);

/** Make GLSL definitions */
export const defineConstants = (defs: Record<string, ShaderDefine>): string => {
  const out = [];
  for (let k in defs) if (defs[k] !== false && defs[k] !== null) out.push(`#define ${k} ${defs[k]}`);
  return out.join("\n");
}

/** Make GLSL enable definitions */
export const defineEnables = (enabled: string[]) => enabled.map(e => `#extension ${e}​ : enable`).join('\n');

/** Convert a bundle with a defined entry point to a definition for that attribute or type. */
export const bundleToAttribute = makeBundleToAttribute(toTypeString, toTypeArgs);

/** Convert a bundle to a definition for all its attributes. */
export const bundleToAttributes = makeBundleToAttributes(toTypeString, toTypeArgs);

// Simple whitespace removal
const minifyCode = (code: string) => {
  code = code.replace(/ +/g, ' ');
  code = code.replace(/\n+/g, '\n');
  return code;
};

/** ES/CommonJS Transpiler */
export const transpileGLSL = makeTranspile('glsl', 'glsl', loadModule, compressAST, minifyCode);

/** Templated literal syntax:

```tsx
glsl`...`
``` */
export const glsl = (literals: TemplateStringsArray, ...tokens: string[]) => {
  const code = zip(literals, tokens).flat();
  return loadModuleWithCache(code.join(''));
};

/** Format `number` as GLSL `float` */
export const float = (x: number) => {
  const s = x.toString();
  return (!s.match(/\./)) ? s + '.0' : 0;  
};
/** Format `number` as GLSL `uint` */
export const uint = (x: number) => Math.round(x).toString();
/** Format `number` as GLSL `int` */
export const int = (x: number) => Math.round(x).toString();
