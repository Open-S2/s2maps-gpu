#version 300 es
precision highp float;

vec2 fade1SmoothSteps = vec2(0.15, 1.);
vec2 fade2SmoothSteps = vec2(0.55, 1.);
vec2 haloSmoothSteps = vec2(0.77, 0.825);

uniform vec2 uScale;
uniform vec4 backgroundColor;
uniform vec4 haloColor;
uniform vec4 fade1Color;
uniform vec4 fade2Color;

in vec2 vertPos;
out vec4 fragColor;

void main () {
  vec2 pos = vertPos;
  pos *= 0.1 / uScale;


  float fade1 = length(pos);
  float fade2 = fade1;
  float haloSmooth = fade1;
  fade1 = smoothstep(fade1SmoothSteps.x, fade1SmoothSteps.y, 1.0 - fade1);
  fade2 = smoothstep(fade2SmoothSteps.x, fade2SmoothSteps.y, 1.0 - fade2);
  haloSmooth = smoothstep(haloSmoothSteps.x, haloSmoothSteps.y, 1.0 - haloSmooth);

  vec4 color = vec4(1.0);
	color = mix(backgroundColor, fade1Color, fade1);
  color = mix(color, haloColor, haloSmooth);
  color = mix(color, fade2Color, fade2);

  fragColor = color;
}
