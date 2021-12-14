[[stage(vertex)]]
fn main([[builtin(vertex_index)]] VertexIndex : u32)
     -> [[builtin(position)]] vec4<f32> {
  var pos = array<vec2<f32>, 3>(
      vec2<f32>(0.0, 0.5),
      vec2<f32>(-0.5, -0.5),
      vec2<f32>(0.5, -0.5));

  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}

#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 7) in float aIndex;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

out vec4 color;

void main () {
  // set position
  gl_Position = getPos(aPos);
  // set color
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = decodeFeature(true, index, featureIndex);
  color.a *= decodeFeature(false, index, featureIndex)[0];
  color.rgb *= color.a;
}
