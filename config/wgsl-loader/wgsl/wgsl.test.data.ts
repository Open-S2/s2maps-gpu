// Testing shaders
export const WGSLModules = {
  "getQuadVertex": `
use '@use-gpu/wgsl/use/types'::{ SolidVertex };
use '@use-gpu/wgsl/use/view'::{ viewUniforms, worldToClip, getPerspectiveScale }; 
use '@use-gpu/wgsl/geometry/quad'::{ getQuadUV };

@link fn getPosition(i: i32) -> vec4<f32> {};
@link fn getColor(i: i32) -> vec4<f32> {};
@link fn getSize(i: i32) -> vec2<f32> {};
@link fn getDepth(i: i32) -> f32 {};

@export fn getQuadVertex(vertexIndex: i32, instanceIndex: i32) -> SolidVertex {
  var position = getPosition(instanceIndex);
  var color = getColor(instanceIndex);
  var size = getSize(instanceIndex);
  var depth = getDepth(instanceIndex);

  var center = worldToClip(position);

  var uv = getQuadUV(vertexIndex);
  var xy = uv * 2.0 - 1.0;

  // Lerp between fixed size and full perspective.
  var pixelScale = getPerspectiveScale(center.w, depth);
  // TODO: awaiting compound support
  //size *= pixelScale;
  size = size * pixelScale;

  if (HAS_EDGE_BLEED) {
    xy = xy * (size + 0.5) / size;
    uv = xy * .5 + .5;
  }

  // TODO: awaiting compound support
  //center.xy += xy * size * viewUniforms.viewResolution * center.w;
  center = vec4<f32>(center.xy + xy * size * viewUniforms.viewResolution * center.w, center.zw);

  return SolidVertex(
    center,
    color,
    uv
  );
}
`,

  "instance/fragment/solid": `
@link fn getFragment(color: vec4<f32>, uv: vec2<f32>) -> vec4<f32> {};

@fragment
fn main(
  @location(0) fragColor: vec4<f32>,
  @location(1) fragUV: vec2<f32>,  
) -> @location(0) vec4<f32> {
  var outColor = fragColor;

  // TODO: awaiting compound support
  //outColor.xyz *= outColor.a;
  outColor = vec4<f32>(outColor.xyz * outColor.a, outColor.a);
  outColor = getFragment(outColor, fragUV);

  if (outColor.a <= 0.0) { discard; }
  return outColor;
}
`,

  "@use-gpu/wgsl/geometry/quad": `

const QUAD: array<vec2<i32>, 4> = array<vec2<i32>, 4>(
  vec2<i32>(0, 0),
  vec2<i32>(1, 0),
  vec2<i32>(0, 1),
  vec2<i32>(1, 1),
);

@export fn getQuadIndex(vertex: i32) -> vec2<i32> {
  return QUAD[vertex];
}

@export fn getQuadUV(vertex: i32) -> vec2<f32> {
  return vec2<f32>(getQuadIndex(vertex));
}

`,

  "@use-gpu/wgsl/use/view": `
struct ViewUniforms {
  projectionMatrix: mat4x4<f32>,
  viewMatrix: mat4x4<f32>,
  viewPosition: vec4<f32>,
  viewResolution: vec2<f32>,
  viewSize: vec2<f32>,
  viewWorldDepth: f32,
  viewPixelRatio: f32,
};

@export @group(VIEW) @binding(VIEW) var<uniform> viewUniforms: ViewUniforms;

@export fn worldToView(position: vec4<f32>) -> vec4<f32> {
  return viewUniforms.viewMatrix * position;
}

@export fn viewToClip(position: vec4<f32>) -> vec4<f32> {
  return viewUniforms.projectionMatrix * position;
}

@export fn worldToClip(position: vec4<f32>) -> vec4<f32> {
  return viewToClip(worldToView(position));
}

@export fn clipToScreen3D(position: vec4<f32>) -> vec3<f32> {
  return vec3<f32>(position.xy * viewUniforms.viewSize, position.z);
}

@export fn screenToClip3D(position: vec4<f32>) -> vec3<f32> {
  return vec3<f32>(position.xy * viewUniforms.viewResolution, position.z);
}

@export fn worldToClip3D(position: vec4<f32>) -> vec3<f32> {
  var pos = viewToClip(worldToView(position));
  return pos.xyz / pos.w;
}

@export fn getPerspectiveScale(w: f32, f: f32) -> f32 {
  var m = viewUniforms.projectionMatrix;
  var worldScale = m[1][1] * viewUniforms.viewWorldDepth;
  var clipScale = mix(1.0, worldScale / w, f);
  var pixelScale = clipScale * viewUniforms.viewPixelRatio;
  return pixelScale;
}
`,

  "@use-gpu/wgsl/use/types": `
@export struct SolidVertex {
  position: vec4<f32>,
  color: vec4<f32>,
  uv: vec2<f32>,
};

@export struct MeshVertex {
  position: vec4<f32>,
  normal: vec3<f32>,
  color: vec4<f32>,
  uv: vec2<f32>,
};
`,
};

export default WGSLModules;
