import { UniformAttribute, ShaderModule, ParsedBundle, RefFlags as RF } from '../types';
import { loadVirtualModule } from './shader';
import { toMurmur53, scrambleBits53, mixBits53 } from './hash';
import { toBundle, getBundleHash, getBundleKey } from './bundle';
import { PREFIX_CHAIN } from '../constants';

const NO_SYMBOLS = [] as string[];

export type BundleToAttribute = (
  bundle: ShaderModule,
) => UniformAttribute;

export type MakeChainAccessor = (
  type: string,
  name: string,
  args: string[],
  from: string,
  to: string,
  limit: number,
) => string;

const SYMBOLS = ['chain', 'from', 'to'];

const EXTERNALS = [
  {
    func: {name: 'from'},
    flags: RF.External,
  },
  {
    func: {name: 'to'},
    flags: RF.External,
  },
];

const makeDeclarations = (type: any, parameters: any) => [{
  func: {name: 'chain', type, parameters},
  flags: RF.Exported,
}] as any[];

export const makeChainTo = (
  makeChainAccessor: MakeChainAccessor,
  bundleToAttribute: BundleToAttribute,
) => (
  from: ShaderModule,
  to: ShaderModule,
): ParsedBundle => {
  const fBundle = toBundle(from);
  const tBundle = toBundle(to);
  
  const {module: fromModule, virtuals: fromVirtuals} = fBundle;
  const {module: toModule, virtuals: toVirtuals} = tBundle;

  const {name: fromName, format: fromFormat, args: fromArgs} = bundleToAttribute(from);
  const {name: toName, format: toFormat, args: toArgs} = bundleToAttribute(to);

  const entry = 'chain';
  const args = fromArgs;

  // Return value of `from` must match 1st argument of `to`
  if (toArgs?.[0] !== (fromFormat.entry ?? fromFormat)) {
    throw new Error(`Type Error: ${fromName} -> ${toName}.\nCannot chain output ${fromFormat.entry ?? fromFormat} to args (${toArgs?.join(', ')}).`);
  }
  
  // Other arguments of `from` and `to` must match
  const toRest = toArgs?.slice(1) ?? [];
  const fromRest = fromArgs?.slice(1).slice(0, toRest.length) ?? [];
  if (fromRest.join('/') !== toRest.join('/')) {
    throw new Error(`Type Error: ${fromName} -> ${toName}.\nCannot chain remainder (..., ${fromRest.join(', ')}) to args (..., ${toRest.join(', ')}).`);
  }

  const h1 = getBundleHash(fBundle);
  const h2 = getBundleHash(tBundle);

  const k1 = getBundleKey(fBundle);
  const k2 = getBundleKey(tBundle);

  const code    = `@chain [${entry}]`;
  const rehash  = scrambleBits53(mixBits53(toMurmur53(code), mixBits53(h1, h2)));
  const rekey   = scrambleBits53(mixBits53(rehash, mixBits53(k1, k2)));

  // Code generator
  const render = (namespace: string, rename: Map<string, string>) => {
    const name = rename.get(entry) ?? entry;
    const from = rename.get('from') ?? 'from';
    const to = rename.get('to') ?? 'to';
    return makeChainAccessor(toFormat, name, args ?? [], from, to, 1);
  }

  const exports = makeDeclarations(toFormat, fromArgs);

  const chain = loadVirtualModule(
    { render },
    { symbols: SYMBOLS, exports, externals: EXTERNALS },
    entry,
    rehash,
    code,
    rekey,
  );

  const revirtuals = [];
  if (fromVirtuals) revirtuals.push(...fromVirtuals);
  if (toVirtuals) revirtuals.push(...toVirtuals);
  if (fromModule.virtual) revirtuals.push(fromModule);
  if (toModule.virtual) revirtuals.push(toModule);

  return {
    module: chain,
    links: {
      from: fBundle,
      to: tBundle,
    },
    virtuals: revirtuals,
  };
}
