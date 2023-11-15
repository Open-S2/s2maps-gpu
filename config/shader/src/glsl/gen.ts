import { ShaderModule, ParsedBundle, ParsedModule, DataBinding, ModuleRef, RefFlags as RF } from './types';

import { formatMurmur53, toMurmur53, getObjectKey, mixBits, scrambleBits } from '../util/hash';
import { getBundleHash } from '../util/bundle';
import { loadVirtualModule } from './shader';
import { makeSwizzle } from './cast';
import { PREFIX_VIRTUAL } from '../constants';

const NO_SYMBOLS = [] as string[];
const INT_ARG = ['int'];
const UV_ARG = ['vec2'];

const getBindingKey = (b: DataBinding) => (+!!b.constant) + (+!!b.storage) * 2 + (+!!b.lambda) * 4 + (+!!b.texture) * 8;
const getBindingsKey = (bs: DataBinding[]) => scrambleBits(bs.reduce((a, b) => mixBits(a, getBindingKey(b)), 0)) >>> 0;
const getValueKey = (b: DataBinding) => getObjectKey(b.constant ?? b.storage ?? b.texture);

export const makeBindingAccessors = (
  bindings: DataBinding[],
  bindingSet: number | string = 0,
  volatileSet: number | string = 0,
): Record<string, ShaderModule> => {

  // Extract uniforms
  const lambdas = bindings.filter(({lambda}) => lambda != null);
  const storages = bindings.filter(({storage}) => storage != null);
  const textures = bindings.filter(({texture}) => texture != null);
  const constants = bindings.filter(({constant}) => constant != null);

  // Virtual module symbols
  const virtuals = [...constants, ...storages, ...textures];
  const symbols = virtuals.map(({uniform}) => uniform.name);
  const types = virtuals.map(({uniform}) => uniform.format);
  const declarations = virtuals.map(({uniform}) => ({
    at: 0,
    symbols: NO_SYMBOLS,
    func: {
      name: uniform.name,
      type: {name: uniform.format},
      parameters: uniform.args ?? INT_ARG,
    },
    flags: 0,
  }));

  // Hash + readable representation
  const readable = symbols.join(' ');
  const signature = getBindingsKey(bindings).toString(16);
  const external = lambdas.map(l => getBundleHash(l.lambda!.shader));
  const unique = `@access [${signature}] [${external}] [${readable}] [${types.join(' ')}]`;

  const hash = toMurmur53(unique);
  const code = `@access [${readable}] [${formatMurmur53(hash)}]`;

  const keyed = bindings.reduce((a, s) => mixBits(a, getValueKey(s)), 0);
  const key   = toMurmur53(`${formatMurmur53(hash)} ${keyed}`);

  // Code generator
  const render = (
    namespace: string,
    rename: Map<string, string>,
    bindingBase: number = 0,
    volatileBase: number = 0,
  ) => {
    const program: string[] = [];

    for (const {uniform: {name, format: type, args}} of constants) {
      program.push(makeUniformFieldAccessor(PREFIX_VIRTUAL, namespace, type, name, args));
    }

    for (const {uniform: {name, format: type, args}, storage} of storages) {
      const {volatile, format} = storage!;
      const set = volatile ? volatileSet : bindingSet;
      const base = volatile ? volatileBase++ : bindingBase++;

      if (typeof format === 'object') {
        throw new Error("Virtual struct types not supported in GLSL");
        continue;
      }

      program.push(makeStorageAccessor(namespace, set, base, type, format, name));
    }

    for (const {uniform: {name, format: type, args}, texture} of textures) {
      const {volatile, layout, variant, absolute, format} = texture!;
      const set = volatile ? volatileSet : bindingSet;
      const base = volatile ? volatileBase++ : bindingBase++;
      volatile ? volatileBase++ : bindingBase++;
      program.push(makeTextureAccessor(namespace, set, base, type, format, name, layout, variant, absolute));
    }

    return program.join('\n');
  }

  const virtual = loadVirtualModule({
    uniforms: constants,
    storages,
    textures,
    render,
  }, {
    symbols,
    declarations,
  }, undefined, hash, code, key);

  const links: Record<string, ShaderModule> = {};
  for (const binding of constants) links[binding.uniform.name] = virtual;
  for (const binding of storages)  links[binding.uniform.name] = virtual;
  for (const binding of textures)  links[binding.uniform.name] = virtual;
  for (const lambda  of lambdas)   links[lambda.uniform.name]  = lambda.lambda!.shader;

  return links;
};

export const makeUniformBlock = (
  constants: DataBinding[],
  set: number | string = 0,
  binding: number | string = 0,
): string => {
  // Uniform Buffer Object struct members
  const members = constants.map(({uniform: {name, format}}) => `${format} ${name}`);
  return members.length ? makeUniformBlockLayout(PREFIX_VIRTUAL, set, binding, members) : '';
}

export const makeUniformBlockLayout = (
  ns: string,
  set: number | string,
  binding: number | string,
  members: string[],
) => `
layout (set = ${set}, binding = ${binding}) uniform ${ns}Type {
  ${members.map(m => `${m};`).join('\n  ')}
} ${ns}Uniform;
`;

export const makeUniformFieldAccessor = (
  uniform: string,
  ns: string,
  type: string,
  name: string,
  args: any[] | null = INT_ARG,
) => `
${type} ${ns}${name}(${args ? args.join(', ') : ''}) {
  return ${uniform}Uniform.${ns}${name};
}
`;

export const makeStorageAccessor = (
  ns: string,
  set: number | string,
  binding: number | string,
  type: string,
  format: string,
  name: string,
  args: string[] = INT_ARG,
) => `
layout (std430, set = ${set}, binding = ${binding}) readonly buffer ${ns}${name}Type {
  ${format} data[];
} ${ns}${name}Storage;

${type} ${ns}${name}(int index) {
  ${format !== type ? `${format} v =` : 'return'} ${ns}${name}Storage.data[index];
${format !== type ? `  return ${makeSwizzle(format, type, 'v')};` : ''
}}
`;

export const makeTextureAccessor = (
  ns: string,
  set: number | string,
  binding: number,
  type: string,
  format: string,
  name: string,
  layout: string,
  variant: string = 'sampler2D',
  absolute: boolean = false,
  args: string[] = UV_ARG,
) => `
layout (set = ${set}, binding = ${binding}) uniform ${layout} ${ns}${name}Texture;
layout (set = ${set}, binding = ${binding + 1}) uniform sampler ${ns}${name}Sampler;

${type} ${ns}${name}(vec2 uv) {
  ${absolute ? `uv = uv / vec2(textureSize(${ns}${name}Texture));\n  ` : ''}

  ${format !== type ? `${format} v =` : 'return'} texture(${variant}(${ns}${name}Texture, ${ns}${name}Sampler), uv);
${format !== type ? `  return ${makeSwizzle(format, type, 'v')};` : ''
}}
`;
