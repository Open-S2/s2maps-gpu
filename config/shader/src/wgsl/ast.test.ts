import { WGSLModules } from './wgsl.test.data';
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
  
  it('gets test enables', () => {
    const code = `
    enable f16, f64;

    @export fn main() {}
    `;

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const {enables} = getSymbolTable();
    expect(enables).toMatchSnapshot();
  });

  it('gets test imports', () => {
    const code = `
    import {MeshVertex} from 'use/types';
    import {viewUniforms as view, worldToClip} from 'use/view';
    import {getQuadUV} from 'geometry/quad';

    import 'test';

    @optional @link fn getInt() -> i32 {}

    @export fn main() {}
    `;

    const tree = parseShader(code);
    const {getImports} = makeGuardedParser(code, tree);

    const imports = getImports();
    expect(imports).toMatchSnapshot();
  });

  it('gets linked var/const declarations', () => {
    const code = `
      @link var x: f32;
      @link var y: f32;
      @link const a: i32 = 3;
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets test var/const declarations', () => {
    const code = `
      var x: f32;
      var y: f32;
      const a: i32 = 3;
      type integer = i32;
      override b: i32;
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets test empty function declaration', () => {
    const code = `
      @export fn main() {}
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets test function declaration', () => {
    const code = `
      @fragment fn fragShader(in1: A, @location(2) in2: f32) -> @location(0) vec4<f32> {
        return foo(in1, in2);
      }
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets test struct declaration', () => {
    const code = `
      struct light {
        intensity: f32,
        @annotate position: vec3<f32>,
      }
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets test declarations with array', () => {
    const code = `
      const QUAD: array<vec2<i32>, 4> = array<vec2<i32>, 4>(
        vec2<i32>(0, 0),
        vec2<i32>(1, 0),
        vec2<i32>(0, 1),
        vec2<i32>(1, 1),
      );
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets symbol table', () => {
    const code = `
      @export var x: f32;
      var y: f32;
      const a: i32 = 3;
      type integer = i32;
      override b: i32;

      @export struct light {
        intensity: f32,
        @annotate position: vec3<f32>,
      }

      const QUAD: array<vec2<i32>, 4> = array<vec2<i32>, 4>(
        vec2<i32>(0, 0),
        vec2<i32>(1, 0),
        vec2<i32>(0, 1),
        vec2<i32>(1, 1),
      );

      @optional @link fn getInt() -> i32 {}

      @export fn main() {}
    `;

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const table = getSymbolTable();
    expect(table).toMatchSnapshot();
  });

  it('gets shake table', () => {
    const code = `
      @export var x: f32;
      var y: f32;

      @optional @link fn getFloat1() -> f32 {}

      @optional @link fn getFloat2() -> f32 { return x + y; }

      @export fn main() {
        var z: f32 = getFloat1() + getFloat2();
      }
    `;

    const tree = parseShader(code);
    const {getShakeTable} = makeGuardedParser(code, tree);

    const table = getShakeTable();
    expect(table).toMatchSnapshot();
  });

  it('gets inferred type from function declaration', () => {
    const code = `
      @infer type T;
      @link fn main() -> @infer(T) T {}
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets quad vertex imports', () => {
    const code = WGSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const {getImports} = makeGuardedParser(code, tree);

    const imports = getImports();
    expect(imports).toMatchSnapshot();
  });

  it('gets quad vertex declarations', () => {
    const code = WGSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets solid fragment declarations', () => {
    const code = WGSLModules['instance/fragment/solid'];

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets use view declarations', () => {
    const code = WGSLModules['@use-gpu/wgsl/use/view'];

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('gets quad vertex symbol table', () => {
    const code = WGSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });

  it('gets geometry quad symbol table', () => {
    const code = WGSLModules['@use-gpu/wgsl/geometry/quad'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });

  it('gets use view symbol table', () => {
    const code = WGSLModules['@use-gpu/wgsl/use/view'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });

  it('gets use types symbol table', () => {
    const code = WGSLModules['@use-gpu/wgsl/use/types'];

    const tree = parseShader(code);
    const {getSymbolTable} = makeGuardedParser(code, tree);

    const symbolTable = getSymbolTable();
    expect(symbolTable).toMatchSnapshot();
  });
  
  it('parses comment function', () => {
    const code = `
    // Append any X/Y/Z edge that crosses the level set
    fn appendEdge(id: u32) {
      let nextEdge = atomicAdd(&indirectDraw.instanceCount, 1u);
      activeEdges[nextEdge] = id;
    }
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });

  it('filters out noisy comments', () => {
    const code = `
      use /* wat */ 'use/types'::{SolidVertex};

      // wat
      struct Foo {
        bar: u32,
      };

      @link /* wat */ var x: f32;
      @link var y: /* wat */ f32;

      fn getValue(index: /* wat */ i32) -> f32;
      fn main() -> /* wat */ vec3<f32> {
        let x = /* wat */ 3.0;
        let y /* wat */ = getValue(2); // wat
        // wat
        let v: vec3<f32> /* wat */ = vec3<f32>(x, y, 0.0);
        return v.xyz;
      }
    `;

    const tree = parseShader(code);
    const {getDeclarations} = makeGuardedParser(code, tree);

    const declarations = getDeclarations();
    expect(declarations).toMatchSnapshot();
  });
  
  it('parses around comment lines with @attributes', () => {
    const code = `
use '@use-gpu/wgsl/use/types'::{ LightVertex };

@link fn getVertex(i: u32) -> LightVertex {};
//@optional @link fn toColorSpace(c: vec4<f32>) -> vec4<f32> { return c; }

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(flat) lightIndex: u32,
};
    `;
    
    const tree = parseShader(code);
    const rename = new Map<string, string>();
    rename.set('VertexOutput', 'VertexT');
    
    const output = rewriteUsingAST(code, tree, rename);
    expect(output).toMatchSnapshot();
    
  })
  
  it('rewrites code using the AST', () => {
    const code = `
    fn getValue(index: i32) -> f32;
    fn main() -> vec3<f32> {
      let x = 3.0;
      let y = getValue(2);
      let v: vec3<f32> = vec3<f32>(x, y, 0.0);
      return v.xyz;
    }
    `;

    const tree = parseShader(code);
    const rename = new Map<string, string>();
    rename.set('main', 'entryPoint');
    rename.set('getValue', '_zz_getValue');
    
    const output = rewriteUsingAST(code, tree, rename);
    expect(output).toMatchSnapshot();
  });

  it('rewrites code with inferred types using the AST', () => {
    const code = `
    @infer type T;
    @link fn getValue(index: i32) -> @infer(T) T;
    fn main() -> vec3<f32> {
      let x = 3.0;
      let y = getValue(2);
      let v: vec3<f32> = vec3<f32>(x, y, 0.0);
      return v.xyz;
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
    fn getValue(index: i32) -> f32;
    fn main() -> vec3<f32> {
      let x = 3.0;
      let y = getValue(2);
      let v: vec3<f32> = vec3<f32>(x, y, 0.0);
      return v.xyz;
    }
    `;

    const tree = parseShader(code);
    const rename = new Map<string, string>();
    rename.set('main', 'entryPoint');
    rename.set('getValue', '_zz_getValue');
    
    const compressed = compressAST(code, tree);
    const decompressed = decompressAST(compressed);
    expect(compressed).toMatchSnapshot();
    expect(decompressed).toMatchSnapshot();

    const output1 = rewriteUsingAST(code, tree, rename);
    const output2 = rewriteUsingAST(code, decompressed, rename);
    expect(output2).toEqual(output1);
  });

  it('rewrites a lot of code using the compressed AST', () => {
    const code = `
use 'use/types'::{SolidVertex};

@infer type T;

@link fn getVertex(a: i32, b: i32) -> @infer(T) T {};

struct VertexOutput {
  @builtin position: vec4<f32>,
  @location(0) fragColor: vec4<f32>,
  @location(1) fragUV: vec2<f32>,
  @location(2) @interpolate(flat) fragIndex: u32,
};

@vertex
fn main(
  @builtin(vertex_index) vertexIndex: i32,
  @builtin(instance_index) instanceIndex: i32,
) -> VertexOutput {

  SolidVertex v = getVertex(vertexIndex, instanceIndex);

  return VertexOutput(
    v.position,
    v.color,
    v.uv,
    u32(instanceIndex),
  );
}
    `;

    const tree = parseShader(code);
    const rename = new Map<string, string>();
    rename.set('main', 'entryPoint');
    rename.set('getVertex', '_zz_getVertex');
    
    const compressed = compressAST(code, tree);
    const decompressed = decompressAST(compressed);
    expect(compressed).toMatchSnapshot();
    expect(decompressed).toMatchSnapshot();

    const output1 = rewriteUsingAST(code, tree, rename);
    const output2 = rewriteUsingAST(code, decompressed, rename);
    expect(output2).toEqual(output1);
    expect(output1).toMatchSnapshot();
  });

  it('recompresses AST', () => {
    const code = `
use 'use/types'::{SolidVertex};

fn getVertex(a: i32, b: i32) -> SolidVertex {};

struct VertexOutput {
  @builtin position: vec4<f32>,
  @location(0) fragColor: vec4<f32>,
  @location(1) fragUV: vec2<f32>,
  @location(2) @interpolate(flat) fragIndex: u32,
};

@vertex
fn main(
  @builtin(vertex_index) vertexIndex: i32,
  @builtin(instance_index) instanceIndex: i32,
) -> VertexOutput {

  SolidVertex v = getVertex(vertexIndex, instanceIndex);

  return VertexOutput(
    v.position,
    v.color,
    v.uv,
    u32(instanceIndex),
  );
}
    `;

    const tree = parseShader(code);
    const compressed = compressAST(code, tree);
    const decompressed = decompressAST(compressed);
    const recompressed = compressAST(code, decompressed);
    expect(compressed).toEqual(recompressed);
  });
  
  it('shakes simple program', () => {
    const code = `
const x: f32 = 1.0;

@export fn getA() -> f32 {
  return x;
}

@export fn getB() -> f32 {
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
  @builtin(position) position: vec4f,
  color: vec4f,
}
@fragment fn main(arg: VertexOutput) -> @location(0) vec4f { return arg.color; }
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
    const code = WGSLModules['@use-gpu/wgsl/use/view'];

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
    const code = WGSLModules['@use-gpu/wgsl/use/view'];

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
    const tree2 = decompressAST(compressAST(code, tree1));

    const code1 = rewriteUsingAST(code, tree1, new Map(), ops);
    const code2 = rewriteUsingAST(code, tree2, new Map(), ops);

    expect(code2).toEqual(code1);
  });

  it('gets shake information for getQuadVertex AST', () => {
    const code = WGSLModules['getQuadVertex'];

    const tree = parseShader(code);
    const table = makeGuardedParser(code, tree).getShakeTable();
    expect(table).toMatchSnapshot();
    
  });

  it('gets shake information for geometry/quad AST', () => {
    const code = WGSLModules['@use-gpu/wgsl/geometry/quad'];

    const tree = parseShader(code);
    const table = makeGuardedParser(code, tree).getShakeTable();
    expect(table).toMatchSnapshot();
    
  });

  it('gets shake information for use/types AST', () => {
    const code = WGSLModules['@use-gpu/wgsl/use/types'];

    const tree = parseShader(code);
    const table = makeGuardedParser(code, tree).getShakeTable();
    expect(table).toMatchSnapshot();
    
  });

});

