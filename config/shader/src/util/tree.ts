import { SyntaxNode, Tree } from '@lezer/common';
import { CompressedNode } from '../types';

// Gather all child nodes (may be implicit)
export const getChildNodes = (node: SyntaxNode) => {
  const out = [] as SyntaxNode[];
  let n = node.firstChild;
  while (n) {
    out.push(n);
    n = n.nextSibling;
  }
  return out;
}

// Look for error nodes in a tree
export const hasErrorNode = (tree: Tree) => {
  const cursor = tree.cursor();
  do {
    const {type, from, to} = cursor;
    if (type.isError) return cursor.node;
  } while (cursor.next());
  return false;
}

// AST node to tree view + side-by-side tokens
export const formatAST = (node: SyntaxNode, code?: string, depth: number = 0) => {
  const {type, from ,to} = node;
  const prefix = '  '.repeat(depth);

  let child = node.firstChild;

  const text = code != null ? code.slice(node.from, node.to).replace(/\n/g, "⮐ ") : '';
  let out = [] as string[];

  let line = `${prefix}${type.name}`;
  const n = line.length;
  line += ' '.repeat(60 - n);
  line += text;
  out.push(line);

  while (child) {
    out.push(formatAST(child, code, depth + 1));
    child = child.nextSibling;
  }
  return out.join("\n");
}

// AST node to S-expression
export const formatASTNode = (node: SyntaxNode) => {
  const {type} = node;
  let child = node.firstChild;
  let inner = [] as string[];
  while (child) {
    inner.push(formatASTNode(child));
    child = child.nextSibling;
  }
  const space = inner.length ? ' ' : '';
  return `(${type.name}${space}${inner.join(" ")})`;
}

const getOpsMap = (ops: string[]) => {
  const opToIndex = new Map<string, number>();
  const indexToOp = new Map<number, string>();
  ops.forEach((op, i) => {
    opToIndex.set(op, i);
    indexToOp.set(i, op);
  });
  return {opToIndex, indexToOp};
};

// Compress AST node
export const makeASTEmitter = (
  out: any[],
  ops: string[],
  symbols: string[] = [],
) => {
  let offset = 0;
  const encode = (x: number) => x - offset;
  const {opToIndex} = getOpsMap(ops);

  return (
    type: string,
    from: number,
    to: number,
    arg?: any,
  ) => {

    const i = opToIndex.get(type)!;
    const row = [i, encode(from), encode(to)];
    if (arg != null) row.push(symbols.indexOf(arg));

    offset = from;
    out.push(row);
  };
};

// Decompress a compressed AST on the fly by returning a pseudo-tree-cursor.
export const makeASTDecompressor = (
  ops: string[]
) => (
  nodes: CompressedNode[],
  symbols: string[] = [],
): Tree => {
  const {indexToOp} = getOpsMap(ops);

  const tree = {
    __nodes: nodes,
    cursor: () => {
      let offset = 0;
      const decode = (d: number) => d + offset;

      let i = -1;
      const n = nodes.length;

      const next = () => {
        const hasNext = ++i < n;
        if (!hasNext) return false;

        const node = nodes[i];
        const [op, d1, d2, arg] = node;

        self.type.name = indexToOp.get(op)!;
        self.from = decode(d1);
        self.to = decode(d2);
        self.arg = arg != null ? symbols[arg] : null;
        offset = self.from;

        return true;
      };

      const lastChild = () => {
        const {to} = self;
        do {
          const node = nodes[i + 1];
          if (node && decode(node[1]) >= to) return false;
        } while (next());
        return false;
      }

      const self = {
        type: {name: ''},
        node: {parent: {type: {name: 'Program'}}},
        from: 0,
        to: 0,
        arg: undefined,
        next,
        lastChild,
      } as any;

      next();

      return self;
    },
  } as any as Tree;
  return tree;
}
