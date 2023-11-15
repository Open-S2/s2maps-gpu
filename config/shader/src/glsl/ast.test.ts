import { GLSLModules } from './glsl.test.data';
import { parseShader } from './shader';
import { makeASTParser, rewriteUsingAST, compressAST, decompressAST } from './ast';
import { formatAST, hasErrorNode } from '../util/tree';
import { resolveShakeOps } from '../util/shake';
import { addASTSerializer } from '../test/snapshot';

addASTSerializer(expect);

describe('ast', () => {

  const makeGuardedParser = (code: any, tree: any): ReturnType<typeof makeASTParser> => {
    let errorNode = hasErrorNode(tree);
    if (errorNode) {
      for (let i = 0; i < 2; ++i) if (errorNode.parent) errorNode = errorNode.parent;
      console.log(formatAST(errorNode, code));
      throw new Error("Error in AST");
    }

    return makeASTParser(code, tree);
  }

  it('gets test declarations', () => {
    const code = `
      float x, y;
      int a = 3, b = 1, c, d;
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets test declarations with array', () => {
    const code = `
      const ivec2 QUAD[] = {
        ivec2(0, 0),
        ivec2(1, 0),
        ivec2(0, 1),
        ivec2(1, 1),
      };
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets test declarations with qualified declaration', () => {
    const code = `
      layout(location = 0) in wat;
      layout(location = 1) in vec2;
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets quad vertex imports', () => {
    const code = GLSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const {getImports} = makeGuardedParser(code, tree);

    const imports = getImports();
    expect(imports).toMatchSnapshot();
  });

  it('gets quad vertex functions', () => {
    const code = GLSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const {getFunctions} = makeGuardedParser(code, tree);

    const functions = getFunctions();
    expect(functions).toMatchSnapshot();
  });

  it('gets quad vertex declarations', () => {
    const code = GLSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets solid fragment declarations', () => {
    const code = GLSLModules['instance/fragment/solid'];

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets use view declarations', () => {
    const code = GLSLModules['use/view'];

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets quad vertex symbol table', () => {
    const code = GLSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });

  it('gets geometry quad symbol table', () => {
    const code = GLSLModules['geometry/quad'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });

  it('gets use view symbol table', () => {
    const code = GLSLModules['use/view'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });

  it('gets use types symbol table', () => {
    const code = GLSLModules['use/types'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });

  it('rewrites code using the AST', () => {
    const code = `
    float getValue(int index);
    void main() {
      float x = 3.0;
      float y = getValue(2);
    }
    `;

    const tree = parseShader(code);
    const rename = new Map<string, string>();
    rename.set('main', 'entryPoint');
    rename.set('getValue', '_zz_getValue');

    const output = rewriteUsingAST(code, tree, rename);
    expect(output).toMatchSnapshot();
  });

  it('rewrites code using the compressed AST', () => {
    const code = `
    float getValue(int index);
    void main() {
      float x = 3.0;
      float y = getValue(2);
      vec3 v;
      v.xyz;
    }
    `;

    const tree = parseShader(code);
    const rename = new Map<string, string>();
    rename.set('main', 'entryPoint');
    rename.set('getValue', '_zz_getValue');

    const symbols = ['getValue', 'main'];
    const compressed = compressAST(code, tree, symbols);
    const decompressed = decompressAST(compressed, symbols);
    expect(compressed).toMatchSnapshot();
    expect(decompressed).toMatchSnapshot();

    const output1 = rewriteUsingAST(code, tree, rename);
    const output2 = rewriteUsingAST(code, decompressed, rename);
    expect(output2).toEqual(output1);
  });

  it('rewrites a lot of code using the compressed AST', () => {
    const code = `
#pragma import {SolidVertex} from 'use/types'

SolidVertex getVertex(int, int);

#ifdef IS_PICKING
layout(location = 0) out flat uint fragIndex;
#else
layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec2 fragUV;
#endif

void main() {
  int vertexIndex = gl_VertexIndex;
  int instanceIndex = gl_InstanceIndex;

  SolidVertex v = getVertex(vertexIndex, instanceIndex);

  gl_Position = v.position;
#ifdef IS_PICKING
  fragIndex = uint(instanceIndex);
#else
  fragColor = v.color;
  fragUV = v.uv;
#endif
}
    `;

    const tree = parseShader(code);
    const rename = new Map<string, string>();
    rename.set('main', 'entryPoint');
    rename.set('getVertex', '_zz_getVertex');

    const symbols = ['SolidVertex', 'getVertex', 'fragIndex', 'fragColor', 'fragUV', 'main'];
    const compressed = compressAST(code, tree, symbols);
    const decompressed = decompressAST(compressed, symbols);
    expect(compressed).toMatchSnapshot();
    expect(decompressed).toMatchSnapshot();

    const output1 = rewriteUsingAST(code, tree, rename);
    const output2 = rewriteUsingAST(code, decompressed, rename);
    expect(output2).toEqual(output1);
  });

  it('recompresses AST', () => {
    const code = `
#pragma import {SolidVertex} from 'use/types'

SolidVertex getVertex(int, int);

#ifdef IS_PICKING
layout(location = 0) out flat uint fragIndex;
#else
layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec2 fragUV;
#endif

void main() {
  int vertexIndex = gl_VertexIndex;
  int instanceIndex = gl_InstanceIndex;

  SolidVertex v = getVertex(vertexIndex, instanceIndex);

  gl_Position = v.position;
#ifdef IS_PICKING
  fragIndex = uint(instanceIndex);
#else
  fragColor = v.color;
  fragUV = v.uv;
#endif
}
    `;

    const tree = parseShader(code);

    const symbols = ['SolidVertex', 'getVertex', 'fragIndex', 'fragColor', 'fragUV', 'main'];
    const compressed = compressAST(code, tree, symbols);
    const decompressed = decompressAST(compressed, symbols);
    const recompressed = compressAST(code, decompressed, symbols);
    expect(compressed).toEqual(recompressed);
  });

  it('shakes simple program', () => {
    const code = `
const float x = 1.0;

#pragma export
float getA() {
  return x;
}

#pragma export
float getB() {
  return x;
}
    `;

    const tree = parseShader(code);
    const ast = makeGuardedParser(code, tree);
    const {symbols} = ast.getSymbolTable();
    const shake = ast.getShakeTable();

    expect(shake).toBeTruthy();
    expect(shake).toMatchSnapshot();
    if (!shake) return;

    const keep = new Set(['getA']);
    const ops = resolveShakeOps(shake, keep, symbols);
    expect(rewriteUsingAST(code, tree, new Map(), ops)).toMatchSnapshot();
  });

  it('shakes struct type args', () => {
    const code = `
struct VertexOutput {
  vec4 position;
  vec4 color;
};
vec4 main(VertexOutput arg) { return arg.color; }
    `;

    const tree = parseShader(code);
    const ast = makeGuardedParser(code, tree);
    const {symbols} = ast.getSymbolTable();
    const shake = ast.getShakeTable();

    expect(shake).toBeTruthy();
    expect(shake).toMatchSnapshot();
    if (!shake) return;

    const keep = new Set(['main']);
    const ops = resolveShakeOps(shake, keep, symbols);
    expect(rewriteUsingAST(code, tree, new Map(), ops)).toMatchSnapshot();
  });

  it('shakes use/view AST', () => {
    const code = GLSLModules['use/view'];

    const tree = parseShader(code);
    const ast = makeGuardedParser(code, tree);
    const {symbols} = ast.getSymbolTable();
    const shake = ast.getShakeTable();

    expect(shake).toBeTruthy();
    expect(shake).toMatchSnapshot();
    if (!shake) return;

    const keep = new Set(['worldToClip']);
    const ops = resolveShakeOps(shake, keep, symbols);
    expect(rewriteUsingAST(code, tree, new Map(), ops)).toMatchSnapshot();
  });

  it('shakes use/view AST using compressed AST', () => {
    const code = GLSLModules['use/view'];

    const tree = parseShader(code);
    const ast = makeGuardedParser(code, tree);
    const {symbols} = ast.getSymbolTable();
    const shake = ast.getShakeTable();

    expect(shake).toBeTruthy();
    expect(shake).toMatchSnapshot();
    if (!shake) return;

    const keep = new Set(['worldToClip']);
    const ops = resolveShakeOps(shake, keep, symbols);

    const tree1 = tree;
    const tree2 = decompressAST(compressAST(code, tree1, symbols), symbols);

    const code1 = rewriteUsingAST(code, tree1, new Map(), ops);
    const code2 = rewriteUsingAST(code, tree2, new Map(), ops);

    expect(code2).toEqual(code1);
  });

  it('gets shake information for getQuadVertex AST', () => {
    const code = GLSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const shake = makeGuardedParser(code, tree).getShakeTable();
    expect(shake).toMatchSnapshot();

  });

  it('gets shake information for geometry/quad AST', () => {
    const code = GLSLModules['geometry/quad'];

    const tree = parseShader(code);
    const shake = makeGuardedParser(code, tree).getShakeTable();
    expect(shake).toMatchSnapshot();

  });

  it('gets shake information for use/types AST', () => {
    const code = GLSLModules['use/types'];

    const tree = parseShader(code);
    const shake = makeGuardedParser(code, tree).getShakeTable();
    expect(shake).toMatchSnapshot();

  });

});

