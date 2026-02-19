precision highp float;

varying vec2 vertPos;

uniform vec2 uScale;
uniform vec4 uBackground;
uniform vec4 uHalo;
uniform vec4 uFade1;
uniform vec4 uFade2;

void main () {
  vec2 pos = vertPos;
  pos *= 0.065 / uScale;


  float fade1 = length(pos);
  float fade2 = fade1;
  float haloSmooth = fade1;
  fade1 = smoothstep(0.15, 1., 1.0 - fade1);
  fade2 = smoothstep(0.55, 1., 1.0 - fade2);
  haloSmooth = smoothstep(0.77, 0.825, 1.0 - haloSmooth);

  vec4 color = vec4(1.0);
	color = mix(uBackground, uFade1, fade1);
  color = mix(color, uHalo, haloSmooth);
  color = mix(color, uFade2, fade2);

  gl_FragColor = color;
}
