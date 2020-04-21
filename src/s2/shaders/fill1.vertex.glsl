precision highp float;

attribute vec2 aPos;
attribute float aRadius;
attribute float aIndex;

uniform mat4 uMatrix;
uniform int uMode; // 0 => normal fill ; 1 => evenodd fill ; 2 => quad fill from evenodd texture
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature;
#include ./ST2XYZ;

varying float iMode;
varying vec4 color;
varying vec2 uvPos;

void main () {
  // set position
  if (uMode == 0 || uMode == 1) {
    // prep xyz
    vec4 xyz = STtoXYZ(aPos);
    // if 3D, add radius
    if (u3D) {
      float radius = 1. + (aRadius * 200.);
      xyz.xyz *= radius;
    }
    // set position
    gl_Position = uMatrix * xyz;
  } else if (uMode == 2) {
    uvPos = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0., 1.);
  }

  // set color
  if (uMode == 0 || uMode == 2) {
    // prep layer index and feature index positions
    int index = 0;
    int featureIndex = int(aIndex);
    // decode color
    color = decodeFeature(true, index, featureIndex);
  } else if (uMode == 1) {
    color = vec4(1. / 255., 0., 0., 0.);
  }

  // share the mode with the fragment shader
  iMode = float(uMode);
}
