import { TypeLike } from '../types';

export const toTypeString = (t: any): string => {
  if (typeof t === 'string') return t;
  if (t.name) return t.name;
  return t as any;
}

export const toTypeArgs = (t: any[]): any[] => {
  return t?.map(toTypeString) ?? [];
};
