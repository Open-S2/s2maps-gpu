struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) color : vec4<f32>,
};

@vertex
fn main(
  @location(0) position : vec2<f32>,
  @location(1) aID : vec2<f32>,
  @location(2) aIndex : f32
) -> @builtin(color) vec4<f32> {
  var output : VertexOutput;

  output.Position = getPos(position);
  output.color = vec4(1.0, 0.0, 0.0, 1.0);

  return output;
}
