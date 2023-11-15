import { ParsedBundle, ParsedModule, ShaderModule, ShaderDefine, DataBinding } from '../types';

import { parseLinkAliases } from '../util/link';
import { toHash, formatMurmur53, toMurmur53, scrambleBits53, mixBits53 } from '../util/hash';
import { toBundle, toModule, getBundleHash, getBundleKey } from '../util/bundle';
import { loadStaticModule } from '../util/shader';
import { PREFIX_CLOSURE, PREFIX_VIRTUAL, VIRTUAL_BINDINGS } from '../constants';

import { timed } from './timed';

const NO_SYMBOLS = [] as any[];
const DEBUG = false;

export type BindBundle = (
  bundle: ShaderModule,
  linkDefs?: Record<string, ShaderModule | null>,
  defines?: Record<string, ShaderDefine> | null,
  key?: string | number,
) => string;

export type BindModule = (
  main: ParsedModule,
  libs?: Record<string, ShaderModule>,
  linkDefs?: Record<string, ShaderModule | null>,
  defines?: Record<string, ShaderDefine> | null,
  virtual?: ParsedModule[],
  key?: string | number,
) => ParsedBundle;

export type DefineConstants = (
  defines: Record<string, ShaderDefine>
) => string;

export type MakeUniformBlock = (
  constants: DataBinding[],
  set?: number | string,
  binding?: number | string,
) => string;

export const bindBundle = (
  subject: ShaderModule,
  links: Record<string, ShaderModule | null> | null = null,
  defines: Record<string, ShaderDefine> | null = null,
): ParsedBundle => {
  const bundle = toBundle(subject);
  if (!links && !defines) return bundle;

  const hash = getBundleHash(bundle);
  const key = getBundleKey(bundle);

  // External hash
  let external: number = 0;
  for (const k in links) if (links[k]) external = mixBits53(external, getBundleHash(links[k]!));

  const defs = defines ? toMurmur53(defines) : 0;
  const code = `@closure`;
  const rehash = scrambleBits53(mixBits53(hash, mixBits53(external, defs)));

  // External key
  external = 0;
  for (const k in links) if (links[k]) external = mixBits53(external, getBundleKey(links[k]!));
  const rekey = scrambleBits53(mixBits53(mixBits53(hash, key), mixBits53(external, defs)));

  const relinks = bundle.links ? {
    ...bundle.links,
  } : {} ?? undefined;

  const redefines = defines && bundle.defines ? {
    ...bundle.defines,
    ...defines,
  } : defines ?? bundle.defines ?? undefined;

  let revirtuals = bundle.virtuals ? bundle.virtuals.slice() : [];

  const {module: {table: {linkable}}} = bundle;
  if (links && linkable) for (const k in links) if (links[k]) {
    const chunk = links[k] as any;

    // Ensure link exists in module
    let check = k.indexOf(':') > 0 ? k.split(':')[0] : k;
    if (!linkable[check]) continue;

    // Copy bundle's sub-virtuals
    if (chunk.virtuals) revirtuals.push(...chunk.virtuals);

    // Add virtual module to list
    if (chunk.virtual) revirtuals.push(chunk);
    if (chunk.module?.virtual) revirtuals.push(chunk.module);

    relinks[k] = links[k]!;
  } else if (relinks[k]) {
    const chunk = relinks[k] as any;

    if (chunk.virtuals) revirtuals = revirtuals.filter(f => !chunk.virtuals.includes(f));

    if (chunk.virtual) revirtuals = revirtuals.filter(f => f !== chunk);
    if (chunk.module?.virtual) revirtuals = revirtuals.filter(f => f !== chunk.module);

    delete relinks[k];
  }

  return {
    ...bundle,
    links: relinks,
    defines: redefines,
    hash: rehash,
    key: rekey,
    virtuals: revirtuals,
    attributes: undefined,
  } as any;
};

export const bindModule = bindBundle;

export const makeResolveBindings = (
  makeUniformBlock: MakeUniformBlock,
  getVirtualBindGroup: (defines?: Record<string, ShaderDefine>) => string | number,
) => timed('resolveBindings', (
  modules: (ParsedBundle | null)[],
  defines?: Record<string, ShaderDefine>,
  lazy?: boolean,
): {
  modules: (ParsedBundle | null)[],
  uniforms: DataBinding[],
  bindings: DataBinding[],
  volatiles: DataBinding[],
  visibilities: Map<DataBinding, GPUShaderStageFlags>,
} => {
  const allUniforms  = [] as DataBinding[];
  const allBindings  = [] as DataBinding[];
  const allVolatiles = [] as DataBinding[];

  const allVisibilities = new Map<DataBinding, GPUShaderStageFlags>();

  const seen = new Set<number>();
  DEBUG && console.log('------------')

  const addBinding = (b: DataBinding, slots: number, visibility: GPUShaderStageFlags) => {
    const s = (b.storage ?? b.texture) as any;
    if (s && s.volatile) {
      allVolatiles.push(b);
      volatileBase += slots;
    }
    else {
      allBindings.push(b);
      bindingBase += slots;
    }
    addVisibility(b, visibility);
  }

  const addVisibility = (b: DataBinding, visibility: GPUShaderStageFlags) => {
    allVisibilities.set(b, (allVisibilities.get(b) || 0) | visibility);
  }
  
  // Gather all namespaced uniforms and bindings from all virtual modules.
  // Assign base offset to each virtual module in-place.
  let bindingBase = 0;
  let volatileBase = 0;
  let index = 0;
  let stage = 0;
  for (const m of modules) if (m) {
    const {virtuals} = m;

    const visibles = new Set<number>();
    const visibility = modules.length === 2
      ? (stage ? GPUShaderStage.FRAGMENT : GPUShaderStage.VERTEX)
      : GPUShaderStage.COMPUTE;

    if (virtuals) for (const m of virtuals) {
      const key = getBundleKey(m);

      if (seen.has(key)) {
        if (visibles.has(key)) continue;
        visibles.add(key);

        if (m.virtual) {
          const {storages, textures} = m.virtual;
          if (storages) for (const b of storages) addVisibility(b, visibility);
          if (textures) for (const b of textures) addVisibility(b, visibility);
        }        

        continue;
      }
      seen.add(key);
      visibles.add(key);

      DEBUG && console.log('virtual', m.code, m.hash, m.key);

      if (m.virtual) {
        const {uniforms, storages, textures} = m.virtual;

        // Mutate virtual modules as they are ephemeral
        const namespace = `${PREFIX_VIRTUAL}${++index}_`;
        if (!lazy) {
          m.virtual.namespace = namespace;
          m.virtual.bindingBase = bindingBase;
          m.virtual.volatileBase = volatileBase;
        }

        if (uniforms) for (const u of uniforms) allUniforms.push(namespaceBinding(namespace, u));
        if (storages) for (const b of storages) addBinding(b, 1, visibility);
        if (textures) for (const b of textures) addBinding(b, 1 + +!!(b.texture!.sampler && (b.uniform!.args !== null)), visibility);
      }
    };
    stage++;
  }

  let out = modules;

  // Create combined uniform block as top-level import
  if (!lazy) {
    const virtualBindGroup = getVirtualBindGroup(defines);
    const code = makeUniformBlock(allUniforms, virtualBindGroup, bindingBase);
    const lib = loadStaticModule(code, VIRTUAL_BINDINGS);

    const imported = {at: -1, symbols: NO_SYMBOLS, name: VIRTUAL_BINDINGS, imports: NO_SYMBOLS};

    // Append to modules
    out = modules.map((m: ParsedBundle | null) => {
      if (!m) return null;

      const bundle = toBundle(m);

      const {module, libs} = bundle;
      const {table} = module;
      const {modules} = table;

      const retable = {
        ...table,
        modules: modules ? [...modules, imported] : [imported],
      };

      return {
        ...bundle,
        module: {
          ...module,
          table: retable,
        },
        libs: {
          ...libs,
          [VIRTUAL_BINDINGS]: lib,
        },
      };
    });
  }
  
  DEBUG && console.log('visibility', allVisibilities);

  return {
    modules: out,
    uniforms: allUniforms,
    bindings: allBindings,
    volatiles: allVolatiles,
    visibilities: allVisibilities,
  };
});

export const namespaceBinding = (namespace: string, binding: DataBinding) => {
  const {uniform} = binding;
  const {name} = uniform;
  const imp = namespace + name;
  return {...binding, uniform: {...uniform, name: imp}};
};

const VIRTUAL = 'VIRTUAL';

export const getBindingArgument = (binding?: ShaderDefine): string | number => {
  if (typeof binding === 'string') {
    const a = binding.indexOf('(');
    const b = binding.indexOf(')');
    return binding.slice(a + 1, b);
  }
  if (typeof binding === 'number') return binding;
  return VIRTUAL;
}
