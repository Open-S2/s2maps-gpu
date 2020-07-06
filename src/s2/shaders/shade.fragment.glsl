#version 300 es
precision mediump float;

uniform vec2 uOffset;
uniform vec2 uRadius;

in vec2 vertPos;
out vec4 fragColor;

void main () {
  vec2 uScale = vec2(0.1 / uRadius.x, 0.1 / uRadius.y);
  vec2 pos = vertPos;
  pos.x *= uScale.x * 2.;
  pos.y *= uScale.y * 2.;

  if (length(pos) > length(uRadius)) discard;
  fragColor = vec4(0., 0., 0.05, 0.1);
}


// #version 300 es
// precision mediump float;
//
// uniform vec2 uOffset;
// uniform vec2 uScale;
// uniform float uRadius;
//
// in vec2 vertPos;
// out vec4 fragColor;
//
// void main () {
//   vec2 radius = vec2(uRadius * uScale.x, uRadius * uScale.y);
//   vec2 pos = vertPos;
//   pos.x *= uScale.x;
//   pos.y *= uScale.y;
//
//   if (length(pos) > length(radius)) discard;
//   fragColor = vec4(0., 0., 0., 0.5);
// }
