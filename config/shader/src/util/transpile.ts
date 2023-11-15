import { Tree } from '@lezer/common';
import { ParsedModule, CompressedNode } from '../types';

const stringify = (s: any) => JSON.stringify(s);

export const makeTranspile = (
  type: string,
  extension: string,
  loadModule: (code: string, name?: string, entry?: string, compressed?: boolean) => ParsedModule,
  compressAST: (s: string, tree: Tree, symbols?: string[]) => CompressedNode[],
  minifyCode: (code: string) => string,
) => (
  source: string,
  resourcePath: string,
  esModule: boolean = true,
  minify: boolean = false,
) => {
  
  const makeImport = (symbol: string, from: string) => esModule
    ? `import ${symbol} from ${stringify(from)};`
    : `const ${symbol} = require(${stringify(from)});`;
  const preamble = [
    makeImport('{decompressAST, bindEntryPoint}', '@use-gpu/shader/' + type.toLowerCase()),
  ].join("\n");

  // Parse module source code
  const name = resourcePath.split('/').pop()!.replace(new RegExp('\\.' + extension + '$'), '');
  const input = minify ? minifyCode(source) : source;
  const module = loadModule(input, name);

  // Emit module data (without declarations, which is repeated in externals/exports)
  const {code, hash, table: {declarations, ...table}, tree, shake} = module;
  const def = `const t = ${stringify(table)}; const data = {
  "name": ${stringify(name)},
  "code": ${stringify(code)},
  "hash": ${stringify(hash)},
  "table": t,
  "shake": ${stringify(shake)},
  "tree": decompressAST(${stringify(compressAST(code, tree!, table.symbols))}, t.symbols),
};
`;

  // Emit dependency imports
  let i = 0;
  const imports = [] as string[];
  const markers = [] as string[];
  if (table.modules) for (const {name} of table.modules) {
    imports.push(makeImport(`m${i}`, name + '.' + extension));
    markers.push(`${stringify(name)}: m${i}`);
    ++i;
  }
  const libs = `const libs = {${markers.join(', ')}};`

  // Export visible symbols
  const exportSymbols = (table.visibles ?? []).map((s: string) => 
    `${esModule ? 'export const ' : 'exports.'}${s} = getSymbol(${stringify(s)});`
  );
  
  let exportDefault;
  if (esModule) {
    exportDefault = 'export default getSymbol();';
  }
  else {
    exportDefault = `
const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    `
  }
  
  // Compose JS body
  const output = [
    preamble,
    ...imports,
    def,
    libs,

    `const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});`,
    exportDefault,
    ...exportSymbols,
    '/* __' + type.toUpperCase() + '_LOADER_GENERATED */',
  ].join("\n");

  return output;
}
