import { Tree } from '@lezer/common';
import { ShaderDefine } from '../types';

import { defineConstants, defineEnables, loadModule, loadModuleWithCache, DEFAULT_CACHE } from './shader';
import { rewriteUsingAST } from './ast';
import { makeLinker, makeLinkCode, makeLinkBundle, makeLinkModule } from '../util/link';

// No preamble
const getPreambles = () => [];

// Allow attribute renaming
const getRenames = (
  defines?: Record<string, ShaderDefine> | null,
) => {
  const rename = new Map<string, string>();
  if (defines) for (let k in defines) if (k[0] === '@') rename.set(k, `${defines[k]}`);
  return rename;
}

export const linker     = makeLinker(getPreambles, getRenames, defineConstants, defineEnables, rewriteUsingAST);
export const linkBundle = makeLinkBundle(linker);
export const linkModule = makeLinkModule(linker);
export const linkCode   = makeLinkCode(linker, loadModuleWithCache, DEFAULT_CACHE);
