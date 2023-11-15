import { makeDiffBy } from '../util/diff';
import { bundleToAttribute } from './shader';

const arg = (x: number) => String.fromCharCode(97 + x);

const literal = (v: string | number, isFloat: boolean, isUnsigned: boolean) => {
  if (typeof v === 'string') return v;
  if (isFloat) {
    let s = v.toString();
    if (!s.match(/[.eE]/)) s = s + '.0';
    return s;
  }
  return Math.round(v).toString() + (isUnsigned ? 'u' : '');
};

export const makeDiffAccessor = (
  name: string,
  accessor: string,
  sizers: (string | null)[],
  args: string[],
  type: string,
  offsets: (number | string | null)[],
) => {
  const isFloat = (type: string) => !!type.match(/(^|<)f/);
  const toSigned = (type: string) => type.replace('u', 'i');

  const symbols = args.map((t, i) => `${arg(i)}`);

  return `fn ${name}(${symbols.map((s, i) => `${s}: ${args[i]}`).join(', ')}) -> ${type} {
  ${symbols.map((s, i) => offsets[i] != null ? `let size${i} = ${toSigned(args[i])}(${sizers[i]!}());` : '').join('\n  ')}
  ${symbols.map((s, i) => offsets[i] != null ? `var d${s} = max(${literal(0, isFloat(args[i]), false)}, min(size${i}, ${toSigned(args[i])}(${s}) + ${literal(offsets[i] ?? 0, isFloat(args[i]), false)}));` : '').join('\n  ')}
  let v1 = ${accessor}(${symbols.join(', ')});
  let v2 = ${accessor}(${symbols.map((s, i) => offsets[i] != null ? `${args[i]}(d${s})` : s).join(', ')});
  return v2 - v1;
}
`;
}

export const diffBy = makeDiffBy(makeDiffAccessor, bundleToAttribute);
