import { ShaderModule, LambdaSource, StorageSource, TextureSource, DataBinding } from './types';

import { defineConstants } from './shader';
import { makeBindingAccessors, makeUniformBlock } from './gen';
import { makeResolveBindings, namespaceBinding } from '../util/bind';
import { VIRTUAL_BINDGROUP, VOLATILE_BINDGROUP } from './constants';

export { bindBundle, bindModule } from '../util/bind';

const NO_SYMBOLS = [] as any[];

const getVirtualBindGroup = () => VIRTUAL_BINDGROUP;

export const bindingToModule = (
  binding: DataBinding,
): ShaderModule => {
  const {uniform: {name}} = binding;
  const links = makeBindingAccessors([binding], VIRTUAL_BINDGROUP, VOLATILE_BINDGROUP);
  const module = links[name];
  return {...module, entry: name};
}

export const bindingsToLinks = (
  bindings: DataBinding[],
): Record<string, ShaderModule> => {
  return makeBindingAccessors(bindings, VIRTUAL_BINDGROUP, VOLATILE_BINDGROUP);
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
