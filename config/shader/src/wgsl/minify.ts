import { makeASTParser } from './ast';
import { parser } from './grammar/wgsl';
import { parser as commentParser } from './highlight/wgsl';
import { WGSL_NATIVE_TYPES } from './constants';

export const removeComments = (code: string) => {
  let out = '';
  let from = 0;
  
  const tree = commentParser.parse(code);
  tree.iterate({
    enter: (node) => {
      if (node.type.name === 'Comment') {
        out = out + code.slice(from, node.from);
        from = node.to;
        return false;
      }
    },
    leave: (node) => {
      out = out + code.slice(from, node.to);
      from = node.to;
    },
  })
  out = out + code.slice(from);

  return out;
};

export const renameLocals = (code: string) => {
  let out = '';
  let from = 0;

  const tree = parser.parse(code);
  const {getSymbolTable} = makeASTParser(code, tree);
  const {symbols} = getSymbolTable();

  const map = new Map<string, string>();
  const taken = new Set<string>(symbols);

  const assign = (name: string, to: string) => {
    taken.add(to);
    map.set(name, to);
    return to;
  };
  
  const shorten = (name: string) => {
    if (map.has(name)) return map.get(name)!;

    let letter = name.slice(0, 1);
    if (!taken.has(letter)) return assign(name, letter);
    
    if (letter === 'i' || letter === 'u' || letter === 'f') letter = '_';
    let i = 1;
    do {
      const suffixed = letter + i;
      if (!taken.has(suffixed)) return assign(name, suffixed);
    } while (i++ < 1000);
    
    throw new Error("wat");
  };

  let scopes = 0;
  tree.iterate({
    enter: (node) => {
      if (node.type.name === 'FunctionDeclaration') {
        scopes++;
      }
      if (scopes > 0) {
        if (node.type.name === 'VariableIdentifier') {
          const cursor = node.node.cursor();
          cursor.firstChild();

          const name = code.slice(cursor.from, cursor.to);
          shorten(name);
        }
        if (node.type.name === 'Param') {
          const cursor = node.node.cursor();
          cursor.firstChild();
          cursor.next();

          const name = code.slice(cursor.from, cursor.to);
          shorten(name);
        }
        if (node.type.name === 'FieldAccess' || node.type.name === 'Attribute') {
          out = out + code.slice(from, node.to);
          from = node.to;
          return false;
        }
        if (node.type.name === 'Identifier') {
          const name = code.slice(node.from, node.to);
          if (map.has(name)) {
            const id = shorten(name);
            out = out + code.slice(from, node.from) + id;
            from = node.to;
          }
          return false;
        }
      }
    },
    leave: (node) => {
      if (from < node.to) {
        out = out + code.slice(from, node.to);
        from = node.to;
      }

      if (node.type.name === 'FunctionDeclaration') {
        scopes--;
        if (scopes == 0) {
          map.clear();
          taken.clear();
          if (symbols) for (let s of symbols) taken.add(s);
        }
      }
    },
  })
  out = out + code.slice(from);

  return out;
};

export const removeWhiteSpace = (code: string) => {

  code = code.replace(/\s+/g, ' ');
  code = code.replace(/\s?(->|\(|\)|{|}|:|=|\+|-|\*|\/|&|\||>>|<<|,|;|<|>)(=?)\s?/g, '$1$2');

  return code;
};
