import { SyntaxNode, TreeCursor, Tree } from '@lezer/common';
import {
  CompressedNode,
  SymbolTable,
  SymbolRef,
  ModuleRef,
  ImportRef,
  PrototypeRef,
  FunctionRef,
  DeclarationRef,
  VariableRef,
  LocalRef,
  TypeRef,
  StructRef,
  MemberRef,
  QualifiedStructRef,
  ShakeTable,
  ShakeOp,
  RefFlags as RF,
} from './types';
import * as T from './grammar/glsl.terms';
import { GLSL_NATIVE_TYPES } from './constants';
import { parseString } from '../util/bundle';
import { getChildNodes, hasErrorNode, formatAST, formatASTNode, makeASTEmitter, makeASTDecompressor } from '../util/tree';
import uniq from 'lodash/uniq';

const NO_DEPS = [] as string[];
const IGNORE_IDENTIFIERS = new Set(['location', 'set', 'binding']);
const AST_OPS = ["Shake", "Skip", "Identifier"];

export const decompressAST = makeASTDecompressor(AST_OPS);

const orNone = <T>(list: T[]): T[] | undefined => list.length ? list : undefined;

const isSpace = (s: string, i: number) => {
  const c = s.charCodeAt(i);
  return c === 32 || c === 13 || c === 10 || c === 9;
};

// Parse AST for given code string
export const makeASTParser = (code: string, tree: Tree, name?: string) => {

  const throwError = (t: string, n?: SyntaxNode) => {
    if (!n) throw new Error(`Missing node`);

    while (n.parent) {
      if (n.from !== n.to) break;
      n = n.parent;
    }
    
    let start = n.from;
    let end = n.to;
    while (start > 0 && code.charAt(start - 1) !== "\n") start--;
    while (end < code.length - 1 && code.charAt(end + 1) !== "\n") end++;

    const loc = name != null ? ` '${name}'` : '';
    throw new Error(
      `Error parsing${loc}: ${t} in '${code.slice(n.from, n.to)}'\n`+
      `${code.slice(start, end)}\n`+
      `${" ".repeat(n.from - start)}^\n\n`+
      formatAST(n, code)
    );
  }

  const getNodes = (node: SyntaxNode, min?: number) => {
    const nodes = getChildNodes(node);
    for (const n of nodes) if (node.type.isError) throwError('error', node);
    if (min != null && nodes.length < min) throwError(`not enough nodes (${min})`, node);
    return nodes;
  }

  const getText = (node: SyntaxNode | TreeCursor) => {
    if (!node) throwError('text');
    return code.slice(node.from, node.to);
  }
  
  const getQualifier = getText;
  
  const getQualifiedType = (node: SyntaxNode): TypeRef => {
    const [a, b] = getNodes(node);

    const qualifiers = b ? getNodes(a).map(getQualifier) : [];
    const def = b ?? a;

    const {name, members} = getTypeSpecifier(def);
    if (members) return {name, qualifiers, members};

    return {name, qualifiers};
  }
  
  const getTypeSpecifier = (node: SyntaxNode): TypeRef => {
    if (node.type.id === T.Identifier) {
      const name = getText(node);
      return {name};
    }
    if (node.type.id === T.TypeSpecifier) {
      const [def] = getNodes(node, 1);
      if (def.type.id === T.Struct) {
        const {name, members} = getStructType(def);
        return {name, members};
      }
      else {
        const name = getText(def);
        return {name};
      }
    }
    
    throw throwError('type specifier', node);
  }

  const getStructType = (node: SyntaxNode): TypeRef => {
    const [, b, c] = getNodes(node, 3);
    const name = getText(b);
    const {members} = getStructMembers(c);
    return {name, members};
  }

  const getArrayName = (node: SyntaxNode): string => {
    const [a] = getNodes(node, 1);
    return getText(a);
  }

  const getLocal = (node: SyntaxNode): LocalRef => {
    const [a, b] = getNodes(node, 1);
    const name = getArrayName(a);
    const expr = b ? getText(b) : null;
    return {name, expr};
  }

  const getMember = (node: SyntaxNode): MemberRef => {
    const [a, b] = getNodes(node, 2);
    const type = getTypeSpecifier(a);
    const name = getArrayName(b);
    return {name, type};
  }

  const getStructMembers = (node: SyntaxNode): StructRef => {
    const nodes = getNodes(node);
    const members = nodes.map(getMember);
    return {members};
  }

  const getImport = (node: SyntaxNode): ImportRef => {
    const [a, b] = getNodes(node, 1);
    const hasAlias = !!b;

    const imported = getText(a);
    const name = hasAlias ? getText(b) : imported;

    return {name, imported};
  };

  const getPrototype = (node: SyntaxNode): PrototypeRef => {
    const [a, b, c] = getNodes(node, 2);

    const type = getQualifiedType(a);
    const name = getText(b);
    const parameters = c ? getNodes(c).map(getText) : [];
    const symbols = [{name}];

    return {name, type, parameters};
  };
  
  const getVariable = (node: SyntaxNode): VariableRef => {
    const [a, ...rest] = getNodes(node, 1);
    const type = getQualifiedType(a);
    const locals = rest.map(getLocal);

    return {type, locals};
  }
  
  const getQualifiedStruct = (node: SyntaxNode): QualifiedStructRef => {
    const [a, b, c, d] = getNodes(node, 3);
    
    const type = getQualifiedType(node);
    const name = getText(d ?? b);
    const struct = getStructMembers(c);

    return {name, type, struct};
  }

  const getQualifiedDeclaration = (node: SyntaxNode): VariableRef => {
    const [a, ...rest] = getNodes(node, 1);
    const locals = rest.map(getText).map(name => ({name, expr: null}));

    const qualifiers = getNodes(a).map(getQualifier);
    const type = {name: 'unknown', qualifiers};

    return {type, locals};
  }

  const getFunction = (node: SyntaxNode): FunctionRef => {
    const [a, b] = getNodes(node, 1);
    const flags = getFlags(node);
    const func = getPrototype(a);
    const at = node.from;

    const symbols = [func.name];
    const ids1 = getIdentifiers(a, symbols);
    const ids2 = b ? getIdentifiers(b, symbols) : undefined;
    const identifiers = ids1 && ids2 ? [...ids1, ...ids2] : ids1 ?? ids2;

    return {at, symbols, identifiers, flags, func};
  };

  const getDeclaration = (node: SyntaxNode): DeclarationRef => {
    const [a] = getNodes(node);
    const flags = getFlags(node);
    const at = node.from;

    if (a.type.id === T.FunctionPrototype) {
      const func = getPrototype(a);
      const {name} = func;

      const symbols = [name];
      const identifiers = getIdentifiers(node, symbols);

      return {at, symbols, identifiers, flags, func};
    }
    if (a.type.id === T.VariableDeclaration) {
      const variable = getVariable(a);

      const symbols = variable.locals.map(({name}) => name);
      const {type} = variable;
      if (!GLSL_NATIVE_TYPES.has(type.name)) symbols.push(type.name);

      const identifiers = getIdentifiers(node, symbols);

      return {at, symbols, identifiers, flags, variable};
    }
    if (a.type.id === T.QualifiedStructDeclaration) {
      const struct = getQualifiedStruct(a);
      const {name, type} = struct;

      const symbols = [name];

      if (type.name === name) {
        // Struct is anonymous, members are global
        for (const {name, type} of struct.struct.members) {
          symbols.push(name);
          if (!GLSL_NATIVE_TYPES.has(type.name)) symbols.push(type.name);
        }
      }
      else if (
        !GLSL_NATIVE_TYPES.has(type.name)
      ) {
        // Custom type
        symbols.push(type.name);
      }

      const identifiers = getIdentifiers(node, symbols);

      return {at, symbols, identifiers, flags, struct};
    }
    if (a.type.id === T.QualifiedDeclaration) {
      const variable = getQualifiedDeclaration(a);
      const {type} = variable;
      const symbols = [type.name];
      return {at, symbols, flags};
    }
    
    throw throwError('declaration', node);
  };

  const getFlags = (node: SyntaxNode) => {
    return (
      (isExported(node) ? RF.Exported : 0) |
      (isOptional(node) ? RF.Optional : 0) |
      (isGlobal(node)   ? RF.Global   : 0)
    );
  }

  const isGlobal = (node: SyntaxNode): boolean => {  
    const pragma = node.prevSibling;

    if (!pragma || pragma.type.id !== T.Preprocessor) return false;

    const [a, b] = getNodes(pragma, 2);
    const directive = getText(a);
    if (directive !== 'pragma') return false;

    const verb = getText(b);
    return verb === 'global' || isGlobal(pragma);
  };

  const isExported = (node: SyntaxNode): boolean => {  
    const pragma = node.prevSibling;

    if (!pragma || pragma.type.id !== T.Preprocessor) return false;

    const [a, b] = getNodes(pragma, 2);
    const directive = getText(a);
    if (directive !== 'pragma') return false;

    const verb = getText(b);
    return verb === 'export' || isExported(pragma);
  };

  const isOptional = (node: SyntaxNode): boolean => {  
    const pragma = node.prevSibling;

    if (!pragma || pragma.type.id !== T.Preprocessor) return false;

    const [a, b] = getNodes(pragma, 2);
    const directive = getText(a);
    if (directive !== 'pragma') return false;

    const verb = getText(b);
    return verb === 'optional' || isOptional(pragma);
  };

  const getIdentifiers = (node: SyntaxNode, exclude: string[] = []): string[] => {
    const cursor = node.cursor();
    const {to} = node;
    const ids = new Set<string>();

    const visit = () => {
      const {type} = cursor;
      if (type.name === 'PrivateIdentifier') {
        return false;
      }
      else if (type.name === 'Identifier') {
        const t = getText(cursor);
        if (!IGNORE_IDENTIFIERS.has(t)) ids.add(t);
      }
    }
    do {
      if (visit() === false) cursor.lastChild();
      if (!cursor.next()) break;
    } while (cursor.from < to);

    return Array.from(ids).filter(s => exclude.indexOf(s) < 0);
  };

  const getImports = (): ModuleRef[] => {
    const modules: Record<string, ImportRef[]> = {};

    const children = tree.topNode.getChildren(T.Preprocessor);
    for (const child of children) {
      const [a, b, c, d] = getNodes(child);    
      const directive = getText(a);
      if (directive !== 'pragma') continue;

      const verb = getText(b);
      if (verb !== 'import') continue;

      let module: string;
      let refs: ImportRef[];
      if (c.type.id === T.String) {
        refs = [];
        module = parseString(getText(c));
      } 
      else {
        refs = getNodes(c).map(getImport);
        module = parseString(getText(d));
      }

      let items = modules[module];
      if (!items) items = modules[module] = [];
    
      items.push(...refs);
    }

    const out = [] as ModuleRef[];
    for (const k in modules) out.push({
      at: 0,
      name: k,
      symbols: modules[k].map(({name}) => name),
      imports: modules[k],
    });
    return out;
  }

  const getFunctions = (): FunctionRef[] => {
    const children = tree.topNode.getChildren(T.FunctionDefinition);
    return children.map(getFunction);
  }

  const getDeclarations = (): DeclarationRef[] => {
    const children = tree.topNode.getChildren(T.GlobalDeclaration);
    return children.map(getDeclaration);
  };

  const getSymbolTable = (): SymbolTable => {
    const modules = getImports();
    const functions = getFunctions();
    const declarations = getDeclarations();

    const externals = declarations
      .filter(d => d.func && !functions.find(f => f.func.name === d.func!.name));

    const refs = [...functions, ...declarations];
    refs.sort((a, b) => a.at - b.at);

    const exported = refs.filter(d => d.flags & RF.Exported);
    const globalled = refs.filter(d => d.flags & RF.Global);

    const visibles = uniq(exported.flatMap(r => r.symbols));
    const globals = uniq(globalled.flatMap(r => r.symbols));
    const symbols = uniq(refs.flatMap(r => r.symbols));

    const scope = new Set(symbols ?? []);
    for (let ref of refs) if (ref.identifiers) {
      ref.identifiers = ref.identifiers.filter(s => scope.has(s));
      if (ref.identifiers?.length === 0) ref.identifiers = undefined;
    }

    const linkable = {} as Record<string, true>;
    for (const {symbols} of externals) for (const symbol of symbols) linkable[symbol] = true;

    return {
      symbols: orNone(symbols),
      visibles: orNone(visibles),
      globals: orNone(globals),
      modules: orNone(modules),
      externals: orNone(externals),
      exports: orNone(exported),

      declarations: orNone(refs),
      linkable: externals.length ? linkable : undefined,
    };
  }

  const getShakeTable = (table: SymbolTable = getSymbolTable()): ShakeTable | undefined => {
    const {declarations: refs, symbols} = table;
    const lookup = new Map(symbols ? symbols.map((s, i) => [s, i]) : undefined);
    if (!refs) return undefined;

    const graph = new Map<string, string[]>();
    const link = (from: string, to: string) => {
      let list = graph.get(from);
      if (!list) graph.set(from, list = []);
      list.push(to);
    };

    for (const ref of refs) if (ref.identifiers) {
      const {symbols, identifiers} = ref;
      for (const id of identifiers) {
        for (let s of symbols) link(id, s);
      }
    }

    const getAll = (ss: string[], accum: Set<number> = new Set()): Set<number> => {
      for (let symbol of ss) {
        let s = lookup.get(symbol)!;
        if (!accum.has(s)) {
          accum.add(s);
          const deps = graph.get(symbol);
          if (deps?.length) getAll(deps, accum);
        }
      }
      return accum;
    }

    const out = [] as ShakeOp[];
    for (const ref of refs) {
      const {at, symbols} = ref;
      const deps = getAll(symbols);
      if (deps.size) out.push([at, Array.from(deps)]);
    }

    return out.length ? out : undefined;
  }

  return {
    getImports,
    getFunctions,
    getDeclarations,
    getSymbolTable,
    getShakeTable,
  };
}

// Rewrite code using tree, renaming the given identifiers.
// Removes:
// - #version
// - #pragma import | export | optional | global
// - white-space after shake point
export const rewriteUsingAST = (
  code: string,
  tree: Tree,
  rename: Map<string, string>,
  shake?: number[] | null,
) => {
  let out = '';
  let pos = 0;

  const shakes = shake ? new Set<number>(shake) : null;

  const skip = (from: number, to: number, replace?: string) => {
    out = out + code.slice(pos, from);
    pos = to;

    if (replace != null) out = out + replace;
    else while (isSpace(code, pos)) pos++;
  }

  const cursor = tree.cursor();
  do {
    const {type, from, to} = cursor;

    // Injected by compressed AST only: Skip, Shake
    if (type.name === 'Skip') skip(from, to);
    
    // Top level declaration
    else if (type.name === 'GlobalDeclaration' || type.name === 'FunctionDefinition' || type.name === 'Shake') {
      if (cursor.node.parent?.type.name !== 'Program') continue;
      if (!shakes) continue;
      if (shakes.has(from)) {
        skip(from, to);
        while (cursor.lastChild()) {};
      }
    }
    // Any identifier
    else if (type.name === 'Identifier') {
      const name = code.slice(from, to);
      const replace = rename.get(name);

      if (replace) skip(from, to, replace);      
    }
    // #version preprocessor
    else if (type.name === 'version') {
      cursor.parent();
      cursor.parent();
      const {from, to} = cursor;
      skip(from, to);
      cursor.lastChild();
    }
    // #pragma import/export
    else if (type.name === 'import' || type.name === 'export' ||
             type.name === 'optional' || type.name === 'global') {
      cursor.parent();
      const {from, to} = cursor;
      skip(from, to);
      cursor.lastChild();
    }
    // Field accessor
    else if (type.name === 'Field') {
      const sub = cursor.node.cursor();
      do {} while (sub.firstChild());

      const name = code.slice(sub.from, sub.to);
      const replace = rename.get(name);

      if (replace) skip(sub.from, sub.to, replace);
      cursor.lastChild();
    }
  } while (cursor.next());

  const n = code.length;
  skip(n, n);

  return out;
}

// Compress an AST to only the info needed to do symbol replacement and tree shaking
export const compressAST = (
  _: string,
  tree: Tree,
  symbols: string[] = [],
): CompressedNode[] => {
  const out = [] as any[]
  const emit = makeASTEmitter(out, AST_OPS, symbols);

  // Pass through nodes from pre-compressed tree immediately
  // @ts-ignore
  if (tree.__nodes) return tree.__nodes;

  const shake = (from: number, to: number) => emit('Shake',      from, to);
  const skip  = (from: number, to: number) => emit('Skip',       from, to);
  const ident = (from: number, to: number) => emit('Identifier', from, to);

  const cursor = tree.cursor();
  do {
    const {type, from, to} = cursor;

    if (type.name === 'GlobalDeclaration' || type.name === 'FunctionDefinition') {
      if (cursor.node.parent?.type.name === 'Program') shake(from, to);
    }
    else if (type.name === 'Identifier') {
      const {from, to} = cursor;
      ident(from, to);
    }
    else if (type.name === 'version') {
      cursor.parent();
      cursor.parent();
      const {from, to} = cursor;
      skip(from, to);
      cursor.lastChild();
    }
    else if (type.name === 'import' || type.name === 'export' ||
             type.name === 'optional' || type.name === 'global') {
      cursor.parent();
      const {from, to} = cursor;
      skip(from, to);
      cursor.lastChild();
    }
    else if (type.name === 'Field') {
      const sub = cursor.node.cursor();
      do {} while (sub.firstChild());
      ident(sub.from, sub.to);
      cursor.lastChild();
    }
  } while (cursor.next());

  return out;
}
