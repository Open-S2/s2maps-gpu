import { TypeLike, ParameterLike } from '../types';

export const getTypeName = (s: string) => {
  const i = s.indexOf('<');
  return i >= 0 ? s.slice(0, i) : s;
};

export const getAttributeName = (s: string) => {
  const i = s.indexOf('(');
  return i >= 0 ? s.slice(0, i) : s;
};

export const getAttributeArgs = (s: string) => {
  const i = s.indexOf('(');
  const j = s.lastIndexOf(')');
  if (i >= 0 && j >= 0) return s.slice(i + 1, j);
  return null;
};

export const toTypeString = (t: TypeLike): string => {
  if (typeof t === 'object') return t.name;
  return t;
};

export const toTypeArgs = (t: ParameterLike[]): string[] => {
  return t?.map(p => typeof p === 'object' ? toTypeString(p.type) : p) ?? [];
};
