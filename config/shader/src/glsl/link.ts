import { Tree } from '@lezer/common';

import { defineConstants, defineEnables, loadModule, loadModuleWithCache, DEFAULT_CACHE } from './shader';
import { rewriteUsingAST } from './ast';
import { makeLinker, makeLinkCode, makeLinkBundle, makeLinkModule } from '../util/link';

import { GLSL_VERSION } from './constants';

// Override GLSL version/prefix
let PREAMBLE = `#version ${GLSL_VERSION}`;
export const setPreamble = (s: string): string => PREAMBLE = s;
export const getPreamble = (): string => PREAMBLE;
const getPreambles = (): string[] => [getPreamble()];

// No preprocessor renames
const getRenames = () => new Map<string, string>();

export const linker     = makeLinker(getPreambles, getRenames, defineConstants, defineEnables, rewriteUsingAST);
export const linkBundle = makeLinkBundle(linker);
export const linkModule = makeLinkModule(linker);
export const linkCode   = makeLinkCode(linker, loadModuleWithCache, DEFAULT_CACHE);
