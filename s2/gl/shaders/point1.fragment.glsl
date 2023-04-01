precision highp float;

varying vec2 extent;
varying float antialiasFactor;
varying vec4 color;
varying float radius;
varying vec4 stroke;
varying float strokeWidth;

uniform bool uInteractive;

void main () {
  if (color.a < 0.01) discard;
  float extentLength = length(extent);

  float opacityT = smoothstep(0., antialiasFactor, extentLength - 1.);
  if (opacityT < 0.01) discard;
  if (uInteractive && opacityT != 1.) discard;

  float colorT = strokeWidth < 0.01 ? 0. : smoothstep(
    antialiasFactor,
    0.,
    extentLength - radius / (radius + strokeWidth)
  );

  gl_FragColor = opacityT * mix(color, stroke, colorT);
}
