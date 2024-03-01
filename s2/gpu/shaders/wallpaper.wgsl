struct ViewUniforms {
  cBlind: f32, // colorblind support
  zoom: f32, // exact zoom
  lon: f32,
  lat: f32,
  bearing: f32,
  pitch: f32,
  time: f32,
  aspectX: f32,
  aspectY: f32,
  mouseX: f32,
  mouseY: f32,
  deltaMouseX: f32,
  deltaMouseY: f32,
  featureState: f32,
  curFeature: f32,
  devicePixelRatio: f32,
};

struct WallpaperUniforms {
  fade1: vec4<f32>,
  fade2: vec4<f32>,
  halo: vec4<f32>,
  background: vec4<f32>,
  scale: vec2<f32>,
  padding: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) screenPos: vec2<f32>,
  @location(1) fade1: vec4<f32>,
  @location(2) fade2: vec4<f32>,
  @location(3) halo: vec4<f32>,
  @location(4) background: vec4<f32>,
};

#include shared/color.wgsl;

@binding(0) @group(0) var<uniform> view: ViewUniforms;
@binding(0) @group(1) var<uniform> uniforms: WallpaperUniforms;

const Inputs = array<vec2<f32>, 6>(
  vec2(-1., -1.),
  vec2(1., -1.),
  vec2(-1., 1.),
  vec2(1., -1.),
  vec2(1., 1.),
  vec2(-1., 1.)
);

@vertex
fn vMain(
  @builtin(vertex_index) VertexIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  output.Position = vec4<f32>(Inputs[VertexIndex], 1., 1.);
  output.screenPos = Inputs[VertexIndex];
  output.fade1 = cBlindAdjust(uniforms.fade1);
  output.fade2 = cBlindAdjust(uniforms.fade2);
  output.halo = cBlindAdjust(uniforms.halo);
  output.background = cBlindAdjust(uniforms.background);
  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  var pos = vec2<f32>(output.screenPos);
  pos *= 0.065 / uniforms.scale;

  var fade1 = length(pos);
  var fade2 = fade1;
  var haloSmooth = fade1;
  fade1 = smoothstep(0.15, 1., 1.0 - fade1);
  fade2 = smoothstep(0.55, 1., 1.0 - fade2);
  haloSmooth = smoothstep(0.77, 0.825, 1.0 - haloSmooth);

  var color = vec4<f32>(1.0);
	color = mix(output.background, output.fade1, fade1);
  color = mix(color, output.halo, haloSmooth);
  color = mix(color, output.fade2, fade2);

  return color;
}
