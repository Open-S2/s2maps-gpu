#version 300 es
precision highp float;

in vec2 extent;
in float antialiasFactor;
in vec4 color;
in float radius;
in vec4 stroke;
in float strokeWidth;
out vec4 fragColor;

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

  fragColor = opacityT * mix(color, stroke, colorT);
}
