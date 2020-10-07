precision highp float;

vec2 fadeStep = vec2(0., 0.325);
vec4 nullColor = vec4(1.);
vec4 darkColor = vec4(0.6, 0.6, 0.6, 1.);

varying vec2 vPos;

void main () {
  float len = length(vPos);
  float fade = smoothstep(fadeStep.x, fadeStep.y, 1.0 - len);

  vec4 color = vec4(1.0);
	color = mix(darkColor, nullColor, fade);

  gl_FragColor = color;
}
