import { ShaderModule, ShaderDefine, LambdaSource, StorageSource, TextureSource, DataBinding } from './types';

import { toModule } from '../util/bundle';
import { defineConstants } from './shader';
import { makeBindingAccessors, makeUniformBlock } from './gen';
import { makeResolveBindings, namespaceBinding, getBindingArgument } from '../util/bind';
import { VIRTUAL_BINDGROUP } from './constants';

export { bindBundle, bindModule } from '../util/bind';

const NO_SYMBOLS = [] as any[];

const getVirtualBindGroup = (
  defines?: Record<string, ShaderDefine>
) => defines ? getBindingArgument(defines[VIRTUAL_BINDGROUP]) : "VIRTUAL";

export const bindingToModule = (
  binding: DataBinding,
): ShaderModule => {
  const {uniform: {name}, lambda} = binding;
  const links = makeBindingAccessors([binding]);
  const module = links[name];
  return {...module, entry: !lambda ? name : undefined };
}

export const bindingsToLinks = (
  bindings: DataBinding[],
): Record<string, ShaderModule> => {
  return makeBindingAccessors(bindings);
}

export const sourceToModule = <T>(
  source: ShaderModule | LambdaSource<T> | StorageSource | TextureSource | any,
): ShaderModule | null => {
  if (source == null) return null;

  const s = source as any;
  if (s.shader) return s.shader as ShaderModule;
  else if (s.table || s.libs) return source as ShaderModule;
  return null;
}

export const resolveBindings = makeResolveBindings(makeUniformBlock, getVirtualBindGroup);

const BINDING_SAMPLE_TYPES = {
  f: 'float',
  u: 'uint',
  i: 'sint',
} as Record<string, GPUTextureSampleType>;

type MaybeModule = ShaderModule | false | null | undefined;

export const extractBindings = (stages: MaybeModule[][], pass: string) => {
  
  const key = `group(${pass})`;
  const n = stages.length;

  const bundles = Array.from(new Set(stages.flat()));
  const byModule = new Map<ShaderModule, GPUBindGroupLayoutEntry[]>();
  const allBindings: GPUBindGroupLayoutEntry[] = [];

  for (const bundle of bundles) if (bundle) {
    const module = toModule(bundle);
    const {table: {bindings}} = module;

    const list: GPUBindGroupLayoutEntry[] = [];
    byModule.set(module, list);

    for (const {variable} of bindings) if (variable) {
      const {attr, name, type: format, qual} = variable;
      if (attr.includes(key)) {
        const location = attr.find((k: string) => k.match(/^binding\(/));
        const index = parseInt(location.split(/[()]/g)[1], 10);

        const [layout, type] = format.split(/[<>,]/);
        const parts = layout.split('_');

        let binding: GPUBindGroupLayoutEntry | null = null;

        if (qual?.match(/\bstorage\b/)) {
          const readWrite = !!qual.match(/\bread_write\b/);
          const type = readWrite ? 'storage' : 'read-only-storage';
          binding = {binding: index, visibility: 0, buffer: {type}};
        }

        else if (qual?.match(/\buniform\b/)) {
          binding = {binding: index, visibility: 0, buffer: {type: 'uniform'}};
        }
        
        else if (parts.includes('texture')) {
          const viewDimension = parts.filter((k: string) => k.match(/[1-3]d|array|cube/)).join('-');
          const multisampled = parts.includes('multisampled');
          const depth = parts.includes('depth');
          const storage = parts.includes('storage');

          if (storage) {
            binding = {
              binding: index,
              visibility: 0,
              storageTexture: {
                viewDimension,
                format: type as GPUTextureFormat,
              },
            };
          }
          else {
            const sampleType = depth ? 'depth' : BINDING_SAMPLE_TYPES[type[0]];
            binding = {
              binding: index,
              visibility: 0, 
              texture: {
                viewDimension,
                multisampled,
                sampleType,
              },
            };
          }
        }

        else if (parts.includes('sampler')) {
          const type = (parts.includes('comparison') ? 'comparison' : 'filtering') as GPUSamplerBindingType;
          binding = {binding: index, visibility: 0, sampler: {type}};
        }

        if (!binding) throw new Error(`Cannot extract binding for 'var${qual ?? ''} ${name}: ${format}'`);

        list.push(binding);
        allBindings.push(binding);
      }
    }
  }

  let i = 0;
  for (const stage of stages) {
    const visibility = n === 2
      ? (i ? GPUShaderStage.FRAGMENT : GPUShaderStage.VERTEX)
      : GPUShaderStage.COMPUTE;

    for (const bundle of stage) if (bundle) {
      const module = toModule(bundle);
      const list = byModule.get(module)!;
      for (const binding of list) binding.visibility = binding.visibility | visibility;
    }
    ++i;
  }

  return allBindings;
};
