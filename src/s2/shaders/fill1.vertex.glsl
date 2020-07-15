precision highp float;

attribute vec2 aPos;
attribute float aRadius;
attribute float aIndex;

uniform mat4 uMatrix;
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[64];
uniform float uFeatureCode[64];

#include ./ST2XYZ;

varying vec4 color;
varying vec2 uvPos;

void main () {
  // set position
  vec4 xyz = STtoXYZ(aPos / 4096.);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 150.);
    xyz.xyz *= radius;
  }
  // set position
  gl_Position = uMatrix * xyz;
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = vec4(0., 0., 0., 1.);
}
