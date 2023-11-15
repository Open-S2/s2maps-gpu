import { makeCastTo, makeSwizzleTo, parseSwizzle, CastTo } from '../util/cast';
import { bundleToAttribute } from './shader';

const arg = (x: number) => String.fromCharCode(97 + x);

const literal = (v: number, neg: boolean, isFloat: boolean) => {
  if (neg) v = -v;
  if (isFloat) {
    let s = v.toString();
    if (!s.match(/[.eE]/)) s = s + '.0';
    return s;
  }
  return Math.round(v).toString();
};

export const makeAutoSwizzle = (from: string, to: string) => {
  const mf = from.match(/vec([0-9])/);
  const mt = to.match(/vec([0-9])/);
  
  const nf = mf ? +mf[1] : 1;
  const nt = mt ? +mt[1] : 1;

  const prefix = 'xyzw'.slice(0, Math.min(nf, nt));
  const suffix = '0001'.slice(prefix.length, nt);
  return prefix + suffix;
};

export const makeCastAccessor = (
  name: string,
  accessor: string,
  args: string[],
  from: string,
  to: string,
  swizzle: string | CastTo,
) => {
  const symbols = args.map((t, i) => `${arg(i)}`);

  const ret = makeSwizzle(from, to, 'v', swizzle);

  return `fn ${name}(${symbols.map((s, i) => `${s}: ${args[i]}`).join(', ')}) -> ${to} {
  let v = ${accessor}(${symbols.join(', ')});
  return ${ret};
}
`;
}

export const makeSwizzleAccessor = (
  name: string,
  from: string,
  to: string,
  swizzle: string | CastTo,
) => {
  const ret = makeSwizzle(from, to, arg(0), swizzle);
  return `fn ${name}(${arg(0)}: ${from}) -> ${to} {
  return ${ret};
}
`;
}

export const makeSwizzle = (
  from: string,
  to: string,
  name: string = 'v',
  swizzle: string | CastTo | null = null,
) => {
  const sz = (swizzle == null) ? makeAutoSwizzle(from, to) : swizzle;

  const isFloat = !!from.match(/(^|<)f/);
  const isScalar = !from.match(/(vec[0-9]|mat[0-9]x[0-9])</);

  if (!isScalar && typeof sz === 'string' && sz.match(/^[xyzw]+$/)) {
    return name + '.' + sz;
  }

  const {basis, signs, gain} = parseSwizzle(sz);
  const out: string[] = basis.split('').map((v, i) => {
    const neg = !!(signs && signs[i] === '-');
    
    if (v.match(/[0-9]/)) return literal(+v, neg, isFloat);
    else return (neg ? '-' : '') + (isScalar ? `${name}` : `${name}.${v}`);
  });

  const compact: string[] = [];
  let compat = true;
  for (let c of out) {
    const simple = !!c.match(/^[^.-]+\.[xyzw]$/);
    if (simple && compat && compact.length) {
      compact[compact.length - 1] += c.split('.')[1];
    }
    else {
      compact.push(c);
      compat = simple;
    }
  }
  
  let ret = `${to}(${compact.join(', ')})`;
  if (gain != null) ret = `${ret} * ${literal(gain, false, isFloat)}`;

  return ret;
}

export const castTo = makeCastTo(makeCastAccessor, bundleToAttribute);
export const swizzleTo = makeSwizzleTo(makeSwizzleAccessor);
