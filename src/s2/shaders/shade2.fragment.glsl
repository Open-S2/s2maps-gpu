#version 300 es
precision highp float;

@nomangle vPos

vec2 fadeStep = vec2(0., 0.325);
vec4 nullColor = vec4(1.);
vec4 darkColor = vec4(0.6, 0.6, 0.6, 1.);

in vec2 vPos;

out vec4 fragColor;

void main () {
  float len = length(vPos);
  float fade = smoothstep(fadeStep.x, fadeStep.y, 1.0 - len);

  vec4 color = vec4(1.0);
	color = mix(darkColor, nullColor, fade);

  fragColor = color;
}
