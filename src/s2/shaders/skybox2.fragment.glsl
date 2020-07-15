#version 300 es
precision highp float;

uniform samplerCube uSkybox;

in vec4 vPos;

out vec4 fragColor;

void main () {
  fragColor = texture(uSkybox, normalize(vPos.xyz / vPos.w));
}
