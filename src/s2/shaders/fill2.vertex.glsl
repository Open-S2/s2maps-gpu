#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 6) in float aRadius;
layout (location = 7) in float aIndex;

uniform mat4 uMatrix;
uniform int uMode; // 0 => normal fill ; 1 => evenodd fill ; 2 => quad fill from evenodd texture
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature2;
#include ./ST2XYZ;

flat out int iMode;
out vec4 color;

void main () {
  // // set position
  // if (uMode == 0 || uMode == 1) {
  //   // prep xyz
  //   vec4 xyz = STtoXYZ(aPos);
  //   // if 3D, add radius
  //   if (u3D) {
  //     float radius = 1. + (aRadius * 200.);
  //     xyz.xyz *= radius;
  //   }
  //   // set position
  //   gl_Position = uMatrix * xyz;
  // } else if (uMode == 2) {
  //   gl_Position = vec4(aPos, 0., 1.);
  // }


  // set position
  // prep xyz
  vec4 xyz = STtoXYZ(aPos);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 200.);
    xyz.xyz *= radius;
  }
  // set position
  gl_Position = uMatrix * xyz;

  

  if (uMode == 1) {
    color = vec4(1., 1., 1., 1.);
  } else {
    // set color
    // prep layer index and feature index positions
    int index = 0;
    int featureIndex = int(aIndex);
    // decode color
    color = decodeFeature(true, index, featureIndex);
  }

  // share the mode with the fragment shader
  iMode = uMode;
}
