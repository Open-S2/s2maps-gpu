#version 300 es
precision highp float;

in vec4 vPos;
out vec4 fragColor;

uniform samplerCube uSkybox;

void main () {
  fragColor = texture(uSkybox, normalize(vPos.xyz / vPos.w));
}
