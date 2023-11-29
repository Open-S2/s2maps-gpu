struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) texcoord: vec4<f32>,
};

@binding(0) @group(1) var<uniform> matrix: mat4x4<f32>;
@binding(1) @group(1) var skyboxSampler: sampler;
@binding(2) @group(1) var skyboxTexture: texture_cube<f32>;

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

  var pos = vec4<f32>(Inputs[VertexIndex], 0., 1.);
  output.Position = pos;
  output.Position.z = 1.;
  output.texcoord = matrix * pos;
  
  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  return textureSample(skyboxTexture, skyboxSampler, normalize(output.texcoord.xyz / output.texcoord.w));
}
