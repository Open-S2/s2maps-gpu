import { SyntaxNode, TreeCursor, Tree } from '@lezer/common';
import {
  AnnotatedTypeRef,
  AttributeRef,
  AttributesRef,
  CompressedNode,
  DeclarationRef,
  FunctionHeaderRef,
  FunctionRef,
  ImportRef,
  InferRef,
  ModuleRef,
  ParameterRef,
  ReturnTypeRef,
  QualifiedTypeAliasRef,
  StructRef,
  StructMemberRef,
  TypeAliasRef,
  TypeRef,
  VariableRef,
  SymbolTable,
  ShakeTable,
  ShakeOp,
  RefFlags as RF,
} from './types';
import * as T from './grammar/wgsl.terms';
import { WGSL_NATIVE_TYPES } from './constants';
import { parseString } from '../util/bundle';
import { getChildNodes, hasErrorNode, formatAST, formatASTNode, makeASTEmitter, makeASTDecompressor } from '../util/tree';
import { getTypeName, getAttributeName, getAttributeArgs } from './type';
import uniq from 'lodash/uniq';

const NO_STRINGS = [] as string[];
const NO_MEMBERS = [] as StructMemberRef[];
const VOID_TYPE = 'void';
const AUTO_TYPE = 'auto';
const PRIVATE_ATTRIBUTES = new Set(['@export', '@link', '@global', '@optional', '@infer']);
const AST_OPS = ["Shake", "Skip", "Identifier", "Attribute", "Optional"];

export const decompressAST = makeASTDecompressor(AST_OPS);

const orNone = <T>(list: T[]): T[] | undefined => list.length ? list : undefined;

const isSpaceOrSemiColon = (s: string, i: number) => {
  const c = s.charCodeAt(i);
  return c === 59 || c === 32 || c === 13 || c === 12 || c === 11 || c === 10 || c === 9;
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
    if (min != null && nodes.length < min) throwError(`not enough tokens (${min})`, node);
    return nodes;
  }

  const getText = (node: SyntaxNode | TreeCursor) => {
    if (!node) throwError('text');
    return getTextAt(node.from, node.to);
  }

  const getTextAt = (from: number, to: number) => {
    return code.slice(from, to);
  }
  
  ////////////////
  
  const getIdentifiers = (node: SyntaxNode, symbol: string, exclude = NO_STRINGS): string[] | undefined => {
    const cursor = node.cursor();
    const {to} = node;
    const ids = new Set<string>();

    const visit = () => {
      const {type} = cursor;
      if (type.id === T.Attribute) {
        return false;
      }
      if (type.id === T.PrivateIdentifier) {
        return false;
      }
      if (type.id === T.Identifier) {
        const t = getText(cursor);
        if (t !== symbol && exclude.indexOf(t) < 0) ids.add(t);
      }
    }
    do {
      if (visit() === false) cursor.lastChild();
      if (!cursor.next()) break;
    } while (cursor.from < to);

    return ids.size ? Array.from(ids) : undefined;
  };
    
  ////////////////

  const getImport = (node: SyntaxNode): ImportRef => {
    const [a, b] = getNodes(node, 1);
    const hasAlias = !!b;

    const imported = getText(a);
    const name = hasAlias ? getText(b) : imported;

    return {name, imported};
  };

  const getAttribute = (node: SyntaxNode): AttributeRef => {
    return getTextAt(node.from + 1, node.to);
    
    /*
    const [a, ...rest] = getNodes(node, 1);

    const name = getText(a);
    const args = rest.length ? rest.map(getText) : undefined;

    return {name, args};
    */
  };

  const getParameter = (node: SyntaxNode): ParameterRef => {
    const [a, b, c] = getNodes(node, 3);

    const attr = getAttributes(a);
    const name = getText(b);
    const type = getType(c);

    return {name, type, attr};
  };

  const getAttributes = (node: SyntaxNode): AttributeRef[] | undefined => {
    const nodes = getNodes(node);
    return nodes.length ? nodes.map(getAttribute) : undefined;
  }

  const getParameters = (node: SyntaxNode): ParameterRef[] | undefined => {
    const nodes = getNodes(node);
    return nodes.length ? nodes.map(getParameter) : undefined;
  } 

  const getType = (node: SyntaxNode): TypeRef => {
    return getText(node);
    
    /*
    const [a, ...rest] = getNodes(node, 1);

    const name = getText(a);
    const args = rest.length ? rest.map((n) => {
      if (n.type.id === T.TypeDeclaration) return getType(n);
      return {name: getText(n)};
    }) : undefined;

    return {name, args};
    */
  };

  const getReturnType = (node: SyntaxNode): ReturnTypeRef => {
    const [a, b] = getNodes(node);

    const attr = a ? getAttributes(a) : undefined;
    const type = b ? getType(b) : VOID_TYPE;

    return attr ? {name: type, attr} : type;
  };

  const getFunctionHeader = (node: SyntaxNode): FunctionHeaderRef => {
    const [, a, b, c] = getNodes(node, 3);
    const hasType = !!c;

    const name = getText(a);
    const parameters = getParameters(b);
    const type = hasType ? getReturnType(c) : {name: VOID_TYPE};

    return {name, type, parameters};
  };

  const getFunction = (node: SyntaxNode): FunctionRef => {
    const [a, b, c] = getNodes(node, 2);

    const attr = getAttributes(a);
    const header = getFunctionHeader(b);

    const inferred = getInferred(header);
    const {name, type, parameters} = header;

    const exclude = parameters ? parameters.map(p => (p as any).name) : undefined;

    const ids1 = getIdentifiers(b, name, exclude);
    const ids2 = c ? getIdentifiers(c, name, exclude) : undefined;
    const identifiers = ids1 && ids2 ? [...ids1, ...ids2] : ids1 ?? ids2;

    return {name, type, attr, parameters, identifiers, inferred};
  };

  const getVariableIdentifier = (node: SyntaxNode): TypeAliasRef => {
    const [a, b] = getNodes(node, 1);
    const hasType = !!b;

    const name = getText(a);
    const type = hasType ? getType(b) : AUTO_TYPE;

    return {name, type};
  };

  const getVariableDeclaration = (node: SyntaxNode): QualifiedTypeAliasRef => {
    const [, a, b] = getNodes(node, 2);
    const hasQualifier = !!b;

    if (hasQualifier) {
      const qual = getText(a);
      const {name, type} = getVariableIdentifier(b);
      return {name, type, qual};
    }
    else {
      return getVariableIdentifier(a);
    }
  }

  const getVariable = (node: SyntaxNode): VariableRef => {
    const [a, b,, c] = getNodes(node, 2);
    const hasValue = !!c;

    const attr = getAttributes(a);
    const {name, type, qual} = getVariableDeclaration(b);
    const value = hasValue ? getText(c) : undefined; 

    let identifiers = hasValue ? getIdentifiers(c, name) : undefined;
    const typeName = getTypeName(type);
    if (!WGSL_NATIVE_TYPES.has(typeName)) {
      if (!identifiers) identifiers = [];
      identifiers!.push(typeName);
    }

    return {name, type, attr, value, identifiers, qual};
  };

  const getConstant = (node: SyntaxNode): VariableRef => {
    const nodes = getNodes(node, 2);
    
    const [a, b, c,, d] = nodes;
    const hasAttributes = a.type.id === T.AttributeList;
    const attr = hasAttributes ? getAttributes(a) : undefined;

    const hasValue = !!d;
    const {name, type} = getVariableIdentifier(c);
    const value = hasValue ? getText(d) : undefined; 

    let identifiers = hasValue ? getIdentifiers(d, name) : undefined;
    const typeName = getTypeName(type);
    if (!WGSL_NATIVE_TYPES.has(typeName)) {
      if (!identifiers) identifiers = [];
      identifiers!.push(typeName);
    }

    return {name, type, attr, value, identifiers};
  };
  
  const getTypeAlias = (node: SyntaxNode): TypeAliasRef => {
    const [a,, b,, c] = getNodes(node, 3);

    const attr = getAttributes(a);
    const name = getText(b);
    const type = c ? getType(c) : name;

    return {name, type, attr};
  };

  const getStructMember = (node: SyntaxNode): StructMemberRef => {
    const [a, b, c] = getNodes(node, 3);

    const attr = getAttributes(a);
    const name = getText(b);
    const type = getType(c);

    return {name, type, attr};
  };

  const getStructMembers = (node: SyntaxNode): StructMemberRef[] => getNodes(node).map(getStructMember);

  const getStruct = (node: SyntaxNode): StructRef => {
    const [a,, b, c] = getNodes(node, 3);
    
    const attr = getAttributes(a);
    const name = getText(b);
    const members = c ? getStructMembers(c) : NO_MEMBERS;

    return {name, attr, members};
  };

  const getInferred = (func: FunctionHeaderRef) => {
    const inferred: InferRef[] = [];
    let index = -1;

    const {name, type, parameters} = func;
    if (typeof func.type !== 'string') {
      const attribute = findAttribute(func.type.attr, 'infer');
      if (attribute != null) {
        const name = getAttributeArgs(attribute);
        if (name != null) {
          inferred.push({
            name,
            at: index,
          });
        }
      }
    }
    index++;

    if (parameters) for (const param of parameters) {
      const attr = (param as any).attr;
      if (attr) {
        const attribute = findAttribute(attr, 'infer');
        if (attribute != null) {
          const name = getAttributeArgs(attribute);
          if (name != null) {
            inferred.push({
              name,
              at: index,
            });
          }
        }
      }
      index++;
    }

    return inferred.length ? inferred : undefined;
  };

  ////////////////

  const findAttribute = (attr: AttributeRef[] | undefined, name: string) =>
    attr?.find(a => getAttributeName(a) === name);

  const hasAttribute = (attr: AttributeRef[] | undefined, name: string) =>
    findAttribute(attr, name) != null;

  const getFlags = (ref: AttributesRef) => {

    const isExported = hasAttribute(ref.attr, 'export');
    const isExternal = hasAttribute(ref.attr, 'link');
    const isOptional = hasAttribute(ref.attr, 'optional');
    const isGlobal   = hasAttribute(ref.attr, 'global');
    const isInfer    = hasAttribute(ref.attr, 'infer')
    const isBinding  = hasAttribute(ref.attr, 'group')

    return (
      (isExported ? RF.Exported : 0) |
      (isExternal ? RF.External : 0) |
      (isOptional ? RF.Optional : 0) |
      (isGlobal   ? RF.Global   : 0) |
      (isInfer    ? RF.Infer    : 0) |
      (isBinding  ? RF.Binding  : 0)
    );
  }

  ////////////////

  const getDeclaration = (node: SyntaxNode): DeclarationRef => {
    const [a] = getNodes(node);
    const at = node.from;

    if (a.type.id === T.FunctionDeclaration) {
      const func = getFunction(a);
      const fs = getFlags(func);
      const symbol = func.name;
      const flags = (symbol === 'main') ? (fs | RF.Exported) : fs;
      return {at, symbol, flags, func};
    }
    if (a.type.id === T.GlobalVariableDeclaration) {
      const variable = getVariable(a);
      const flags = getFlags(variable);
      const symbol = variable.name;
      return {at, symbol, flags, variable};
    }
    if (a.type.id === T.GlobalConstantDeclaration) {
      const constant = getConstant(a);
      const flags = getFlags(constant);
      const symbol = constant.name;
      return {at, symbol, flags, constant};
    }
    if (a.type.id === T.TypeAliasDeclaration) {
      const alias = getTypeAlias(a);
      const flags = getFlags(alias);
      const symbol = alias.name;
      return {at, symbol, flags, alias};
    }
    if (a.type.id === T.StructDeclaration) {
      const struct = getStruct(a);
      const flags = getFlags(struct);
      const symbol = struct.name;
      return {at, symbol, flags, struct};
    }
    
    throw throwError('declaration', node);
  };

  const getEnable = (node: SyntaxNode): string[] => {
    const [, ...rest] = getNodes(node);
    return rest.map(getText);
  };

  ////////////////

  const getImports = (): ModuleRef[] => {
    const modules: Record<string, ImportRef[]> = {};

    const children = tree.topNode.getChildren(T.ImportDeclaration);
    for (const child of children) {
      const [a, b, c] = getNodes(child);

      let module: string;
      let refs: ImportRef[];
      
      let verb = getText(a);
      if (verb === 'import') {
        if (b.type.id === T.String) {
          refs = [];
          module = parseString(getText(b));
        } 
        else {
          refs = getNodes(b).map(getImport);
          module = parseString(getText(c));
        }
      }
      else if (verb === 'use') {
        module = parseString(getText(b));
        refs = !!c ? getNodes(c).map(getImport) : [];
      }
      else continue;

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

  const getDeclarations = (): DeclarationRef[] => {
    const children = tree.topNode.getChildren(T.LocalDeclaration);
    return children.map(getDeclaration);
  };

  const getEnables = (): string[] => {
    const children = tree.topNode.getChildren(T.EnableDirective);
    return children.flatMap(getEnable);
  };
  
  ////////////////

  const getSymbolTable = (): SymbolTable => {
    const modules = getImports();
    const declarations = getDeclarations();
    const enables = getEnables();

    const externals = declarations.filter(d => d.flags & RF.External);
    const exported  = declarations.filter(d => d.flags & RF.Exported);
    const globalled = declarations.filter(d => d.flags & RF.Global);
    const bound     = declarations.filter(d => d.flags & RF.Binding);

    const symbols  = uniq(declarations.map(r => r.symbol));
    const visibles = uniq(exported.map(r => r.symbol));
    const globals  = uniq(globalled.map(r => r.symbol));

    const scope = new Set(symbols ?? []);
    for (let ref of declarations) {
      const {func, variable, constant} = ref;
      if      (func?.identifiers)     func    .identifiers = func    .identifiers.filter(s => scope.has(s));
      else if (variable?.identifiers) variable.identifiers = variable.identifiers.filter(s => scope.has(s));
      else if (constant?.identifiers) constant.identifiers = constant.identifiers.filter(s => scope.has(s));

      if      (func?.identifiers?.length     === 0)     func.identifiers = undefined;
      else if (variable?.identifiers?.length === 0) variable.identifiers = undefined;
      else if (constant?.identifiers?.length === 0) constant.identifiers = undefined;
    }

    const linkable = {} as Record<string, true>;
    for (const {symbol} of externals) linkable[symbol] = true;

    return {
      symbols: orNone(symbols),
      visibles: orNone(visibles),
      globals: orNone(globals),
      modules: orNone(modules),
      externals: orNone(externals),
      exports: orNone(exported),
      bindings: orNone(bound),
      enables: orNone(enables),

      declarations: orNone(declarations),
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

    for (const ref of refs) {
      const {symbol, func, variable, constant} = ref;
      const identifiers = (
        func?.identifiers ??
        variable?.identifiers ??
        constant?.identifiers
      );
      if (identifiers) for (const id of identifiers) link(id, symbol);
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
      const {at, symbol} = ref;
      const deps = getAll([symbol]);
      if (deps.size) out.push([at, Array.from(deps)]);
    }

    return out.length ? out : undefined;
  }
  
  ////////////////

  const cursor = tree.cursor();
  do {
    const {type} = cursor;
    if (type.name === '⚠') {
      throwError('Parse error', cursor.node);
    }
  } while (cursor.next())

  ////////////////

  return {
    getImports,
    getDeclarations,
    getSymbolTable,
    getShakeTable,
  };
}

// Rewrite code using tree, renaming the given identifiers.
// Removes:
// - import ... from declarations
// - @export | @optional | @global attributes
// - @link declarations
// - white-space/semi-colons after shake point
export const rewriteUsingAST = (
  code: string,
  tree: Tree,
  rename: Map<string, string>,
  shake?: number[] | null,
  optionals?: Set<string> | null,
) => {
  let out = '';
  let pos = 0;

  const shakes = shake ? new Set<number>(shake) : null;

  const skip = (from: number, to: number, replace?: string) => {
    out = out + code.slice(pos, from);
    pos = to;

    if (replace != null) out = out + replace;
    else {
      if (out.length && !out[out.length - 1].match(/\s/)) out = out + "\n";
      while (isSpaceOrSemiColon(code, pos)) pos++;
    }
  }

  const cursor = tree.cursor();
  do {
    const {type, from, to, arg} = cursor as any;

    // Injected by compressed AST only: Skip, Shake, Optional
    if (type.name === 'Skip') skip(from, to);
    if (type.name === 'Optional') {
      if (!optionals || !optionals.has(arg)) {
        skip(from, to);
        while (cursor.lastChild()) {};
      }
    }
    else if (type.name === 'Shake') {
      if (!shakes) continue;
      const shaken = shakes.has(from);

      if (shaken) {
        skip(from, to);
        while (cursor.lastChild()) {};
      }
    }

    else if (type.name === 'PrivateIdentifier') {
      while (cursor.lastChild()) {};
    }

    // Any identifier (both full and compressed AST)
    else if (type.name === 'Identifier') {
      const name = code.slice(from, to);
      const replace = rename.get(name);

      if (replace) skip(from, to, replace);      
    }

    // Top level declaration (full AST only)
    else if (type.name === 'LocalDeclaration') {
      const shaken = shakes?.has(from);

      if (shaken) {
        // Tree shake entire declaration
        skip(from, to);
        while (cursor.lastChild()) {};
      }
      else {
        // Check if declaration is external or inferred
        const sub = cursor.node.cursor();
        sub.firstChild();
        sub.firstChild();

        const t = code.slice(sub.from, sub.to);
        if (t.match('@infer')) {
          skip(from, to);
          while (cursor.lastChild()) {};
        }
        else if (t.match('@link')) {
          if (t.match('@optional')) {
            while (sub.lastChild()) {};
            sub.next();
            sub.next();
            sub.next();

            const arg = code.slice(sub.from, sub.to);
            if (!optionals || !optionals.has(arg)) {
              skip(from, to);
              while (cursor.lastChild()) {};
            }
          }
          else {
            skip(from, to);
            while (cursor.lastChild()) {};
          }
        }
      }
    }
    // Public or private attributes (both full and compressed AST)
    else if (type.name === 'Attribute') {
      const name = code.slice(from, to);
      if (PRIVATE_ATTRIBUTES.has(name)) {
        const {from, to} = cursor;
        skip(from, to);
        while (cursor.lastChild()) {};
      }
      else {
        const replace = rename.get(name);
        if (replace) skip(from, to, replace);      
      }
    }
    // Import declaration (full AST only)
    // Enable declaration (full AST only)
    else if (type.name === 'ImportDeclaration' || type.name == 'EnableDirective') {
      const {from, to} = cursor;
      skip(from, to);
      while (cursor.lastChild()) {};
    }
  } while (cursor.next());

  const n = code.length;
  skip(n, n);

  return out;
}

// Compress an AST to only the info needed to do symbol replacement and tree shaking
export const compressAST = (
  code: string,
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
  const attr  = (from: number, to: number) => emit('Attribute',  from, to);
  const opt   = (from: number, to: number, symbol: string) => emit('Optional', from, to, symbol);

  const cursor = tree.cursor();
  do {
    const {type, from, to} = cursor;

    // Preserve private identifiers
    if (type.name === 'PrivateIdentifier') {
      while (cursor.lastChild()) {};
    }
    
    // Any identifier
    else if (type.name === 'Identifier') {
      ident(from, to);
    }

    // Top level declaration
    else if (type.name === 'LocalDeclaration') {
      // Check if declaration is external
      const sub = cursor.node.cursor();
      sub.firstChild();
      sub.firstChild();

      const t = code.slice(sub.from, sub.to);
      if (t.match('@infer')) {
        skip(from, to);
        while (cursor.lastChild()) {};
      }
      else if (t.match('@link')) {
        if (t.match('@optional')) {
          while (sub.lastChild()) {};
          sub.next();
          sub.next();
          sub.next();

          const arg = code.slice(sub.from, sub.to);
          opt(from, to, arg);
        }
        else {
          skip(from, to);
          while (cursor.lastChild()) {};
        }
      }
      else {
        shake(from, to);
      }
    }
    // Public or private attributes
    else if (type.name === 'Attribute') {
      const name = code.slice(from, to);
      if (PRIVATE_ATTRIBUTES.has(name)) {
        skip(from, to);
        while (cursor.lastChild()) {};
      }
      else {
        attr(from, to);
      }
    }
    // Import declaration
    // Enable directive
    else if (type.name === 'ImportDeclaration' || type.name == 'EnableDirective') {
      const {from, to} = cursor;
      skip(from, to);
      while (cursor.lastChild()) {};
    }
  } while (cursor.next());

  return out;
}
