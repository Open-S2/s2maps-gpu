#version 300 es

layout (location = 0) in vec4 aPos;

uniform mat4 uMatrix;

out vec4 vPos;

void main () {
  vPos = uMatrix * aPos;
  gl_Position = aPos;
  gl_Position.z = 1.0;
}
