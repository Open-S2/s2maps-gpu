import { ShaderModule, ParsedBundle, UniformAttribute, RefFlags as RF } from '../types';
import { loadVirtualModule } from './shader';
import { toMurmur53, scrambleBits53, mixBits53 } from './hash';
import { toBundle, getBundleHash, getBundleKey } from './bundle';
import { PREFIX_CAST } from '../constants';

const NO_SYMBOLS = [] as string[];

export type CastTo = {
  basis: string,
  signs?: string,
  gain?: number,
};

export type BundleToAttribute = (
  bundle: ShaderModule,
) => UniformAttribute;

export type MakeCastAccessor = (
  name: string,
  accessor: string,
  args: string[],
  from: string,
  to: string,
  swizzle: string | CastTo,
) => string;

export type MakeSwizzleAccessor = (
  name: string,
  from: string,
  to: string,
  swizzle: string | CastTo,
) => string;

const SWIZZLE_SYMBOLS = ['swizzle'];

const CAST_SYMBOLS = ['cast', 'getValue'];
const CAST_EXTERNALS = [{
  func: {name: 'getValue'},
  flags: RF.External,
}];

const makeDeclarations = (name: string, type: any, parameters: any) => [{
  func: {name, type, parameters},
  flags: RF.Exported,
}] as any[];

export const makeSwizzleTo = (
  makeSwizzleAccessor: MakeSwizzleAccessor,
) => (
  from: string,
  to: string,
  swizzle: string | CastTo,
): ParsedBundle => {
  const entry = 'swizzle';

  const id = mixBits53(toMurmur53(swizzle), mixBits53(toMurmur53(from), toMurmur53(to)));

  const code = `@swizzle`;
  const hash = scrambleBits53(mixBits53(toMurmur53(code), id));
  const key  = hash;

  // Code generator
  const render = (namespace: string, rename: Map<string, string>) => {
    const name = rename.get(entry) ?? entry;
    return makeSwizzleAccessor(name, from, to, swizzle);
  }

  const exports = makeDeclarations(entry, to, [from]);

  const module = loadVirtualModule(
    { render },
    { symbols: SWIZZLE_SYMBOLS, exports },
    entry,
    hash,
    code,
    key,
  );

  return {module};
}

export const makeCastTo = (
  makeCastAccessor: MakeCastAccessor,
  bundleToAttribute: BundleToAttribute,
) => (
  source: ShaderModule,
  type: string,
  swizzle: string | CastTo,
): ParsedBundle => {
  const bundle = toBundle(source);

  const {module, virtuals} = bundle;
  const {name, format, args} = bundleToAttribute(bundle);

  const entry = 'cast';

  const hash = getBundleHash(bundle);
  const key  = getBundleKey(bundle);

  const id     = toMurmur53(swizzle);
  const code   = `@cast [${name} ${format}]`;
  const rehash = scrambleBits53(mixBits53(toMurmur53(code), mixBits53(hash, id)));
  const rekey  = scrambleBits53(mixBits53(rehash, key));

  // Code generator
  const render = (namespace: string, rename: Map<string, string>) => {
    const name = rename.get(entry) ?? entry;
    const accessor = rename.get('getValue') ?? 'getValue';
    return makeCastAccessor(name, accessor, args ?? [], format, type, swizzle);
  }

  const exports = makeDeclarations(entry, type, args);

  const cast = loadVirtualModule(
    { render },
    { symbols: CAST_SYMBOLS, exports, externals: CAST_EXTERNALS },
    entry,
    rehash,
    code,
    rekey,
  );

  const revirtuals = module.virtual
    ? (virtuals ? [...virtuals, module] : [module])
    : virtuals;

  return {
    module: cast,
    links: {
      getValue: bundle,
    },
    virtuals: revirtuals,
  };
}

export const parseSwizzle = (swizzle: string | CastTo) => {
  let c: CastTo;
  if (typeof swizzle === 'string') c = {basis: swizzle};
  else c = swizzle as CastTo;

  let {basis} = c;
  while (basis.length < 4) basis = basis + '0';

  return c;
}
