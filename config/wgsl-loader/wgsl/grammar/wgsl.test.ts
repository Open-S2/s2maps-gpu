import { Tree } from '@lezer/common';
import { parser } from './wgsl';
import { formatAST, formatASTNode } from '../../util/tree';
import { addASTSerializer } from '../../test/snapshot';

addASTSerializer(expect);

describe("WGSL grammar snapshots", () => {
  
  it("parses a test program", () => {
    for (const program of PROGRAMS) {
      const parsed = parser.parse(program);
      parsed.text = program;
      
      const compact = formatASTNode(parsed.topNode);
      const hasError = compact.indexOf('⚠') >= 0;
      if (hasError) {
        console.error("Error while parsing");
        console.log(formatAST(parsed.topNode, program));
      }
      expect(hasError).toBe(false);
      expect(parsed).toMatchSnapshot();
    }
  });
  
});

const PROGRAMS = [

//////////////////////////////////////////////////////////////////////

`
var foo: f32 = 1.0;
`,

//////////////////////////////////////////////////////////////////////

`
const WAT = true;
`,

//////////////////////////////////////////////////////////////////////

`
struct light {
  intensity: f32,
  position: vec3<f32>,
};
`,

//////////////////////////////////////////////////////////////////////

`
fn main() {}
`,

//////////////////////////////////////////////////////////////////////

`
@link fn main() {}
`,

//////////////////////////////////////////////////////////////////////

`
struct A {
  @location(0) x: f32,
  @location(1) y: f32,
}

@fragment
fn fragShader(in1: A, @location(2) in2: f32) -> @location(0) vec4<f32> {
}
`,

//////////////////////////////////////////////////////////////////////

`
const foo: f32 = 1.0;
const WAT = true;
struct s { x: i32 };
fn main() -> @builtin vec4<f32> {
  var bar: i32 = wat(5, 6);
  let x: i32 = 4 + 5 + -6 + (-7);
  return vec4<f32>(0.1, 0.2, 0.3, 1.0);
}
`,

//////////////////////////////////////////////////////////////////////

`
fn main() {
  let x: i32 = 1;
  let y: i32 = 2;
  if (x) { if (y) { } } else { }
  if (x) { if (y) { } else { } }
}
`,

//////////////////////////////////////////////////////////////////////

`
fn main() {
  let x: i32 = 1;
  /*
    /*
    let y: i32 = 2;
    */
  if (x) { if (y) { } else { } }
  */
  wat();
}
`,

//////////////////////////////////////////////////////////////////////

`
import {MeshVertex} from 'use/types';
import {viewUniforms as view, worldToClip} from 'use/view';
import {getQuadUV} from 'geometry/quad';

import 'test';

@optional @link fn getInt() -> i32 {}

@export fn main() {}
`,

//////////////////////////////////////////////////////////////////////

`
use 'use/types'::{MeshVertex};
use 'use/view'::{viewUniforms as view, worldToClip};
use 'geometry/quad'::{getQuadUV};

use 'test';

@optional @link fn getInt() -> i32 {}

@export fn main() {}
`,

//////////////////////////////////////////////////////////////////////

`
fn getQuad(vertex: i32) -> MeshVertex {
  let uv: vec2<f32> = getQuadUV(vertex);
  let position: vec4<f32> = vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
  let color: vec4<f32> = vec4<f32>(1.0, 0.0, 1.0, 1.0);
  return MeshVertex(position, color, uv);
}
`,

//////////////////////////////////////////////////////////////////////

`
type integer = i32;
`,

//////////////////////////////////////////////////////////////////////

`
var foo;
// var foo;
var foo;
`,

//////////////////////////////////////////////////////////////////////

`
struct __underscore {
  foo: f32,
  _bar: f32,
  __baz: f32,
};
`,

/*

//////////////////////////////////////////////////////////////////////

*/

`
@fragment fn main(arg: VertexOutput) -> @location(0) vec4f { return arg.color; }
`,

];


