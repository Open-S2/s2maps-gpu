#version 300 es
precision highp float;

@nomangle vertPos

in vec2 vertPos;
out vec4 fragColor;

uniform vec2 uScale;
uniform vec4 uBackgroundColor;
uniform vec4 uHaloColor;
uniform vec4 uFade1Color;
uniform vec4 uFade2Color;

void main () {
  vec2 pos = vertPos;
  pos *= 0.1 / uScale;


  float fade1 = length(pos);
  float fade2 = fade1;
  float haloSmooth = fade1;
  fade1 = smoothstep(0.15, 1., 1.0 - fade1);
  fade2 = smoothstep(0.55, 1., 1.0 - fade2);
  haloSmooth = smoothstep(0.77, 0.825, 1.0 - haloSmooth);

  vec4 color = vec4(1.0);
	color = mix(uBackgroundColor, uFade1Color, fade1);
  color = mix(color, uHaloColor, haloSmooth);
  color = mix(color, uFade2Color, fade2);

  fragColor = color;
}
