#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;

uniform mat4 uMatrix;

@import ./ST2XYZ;

out vec2 v_texcoord;

void main () {
  // set position
  v_texcoord = aPos;
  gl_Position = uMatrix * ST2XYZ(aPos);
}
