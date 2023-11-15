import { makeChainTo } from '../util/chain';
import { bundleToAttribute } from './shader';

const arg = (x: number) => String.fromCharCode(97 + x);

export const makeChainAccessor = (
  type: string,
  name: string,
  args: string[],
  from: string,
  to: string,
  rest: number = 0,
) => {
  const symbols = args.map((t, i) => `${arg(i)}`);
  const tail = rest ? symbols.slice(rest) : null;

  return `fn ${name}(${symbols.map((s, i) => `${s}: ${args[i]}`).join(', ')}) -> ${type} {
  return ${to}(${from}(${symbols.join(', ')})${tail?.length ? ['', ...tail].join(', ') : ''});
}
`;   
}

export const chainTo = makeChainTo(makeChainAccessor, bundleToAttribute);
