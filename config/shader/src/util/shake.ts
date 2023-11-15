import { ShakeOp } from '../types';

// Resolve shake ops to preserve all code needed for the given exports
export const resolveShakeOps = (
  shake: ShakeOp[],
  exports: Set<string>, 
  symbols: string[],
) => shake.filter(([, deps]) => deps.every(s => !exports.has(symbols[s]))).map(([at]) => at);
