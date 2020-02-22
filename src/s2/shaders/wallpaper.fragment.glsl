#version 300 es
precision mediump float;

// float sqrt2 = 1.4142135623730951;

// vec3 haloColor = vec3(0.95, 1., 1.);
// vec3 fade2Color = vec3(0.88, 1., 1.);
// vec3 fade1Color = vec3(0.54, 0.8, 1.);
// vec3 backgroundColor = vec3(0.11372549, 0.15, 0.33333333);

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
  pos.x *= 0.1 / uScale.x;
  pos.y *= 0.1 / uScale.y;


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
