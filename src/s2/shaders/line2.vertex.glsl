#version 300 es
precision highp float;

layout (location = 1) in vec2 aPos;
layout (location = 2) in vec2 aNormal;
// layout (location = 3) in float aLengthSoFar;
layout (location = 6) in float aRadius;
layout (location = 7) in float aIndex;

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature2;
#include ./ST2XYZ;

// out float lengthSoFar;
out vec2 vWidth;
out vec2 vNorm;
out vec4 color;

void main () {
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // decode line width
  float width = decodeFeature(false, index, featureIndex)[0];

  // get pos and vector normal
  vec4 xyz = STtoXYZ(aPos / 4096.);
  vec2 norm = aNormal / 32767.;
  vNorm = norm;
  vWidth = vec2(width, 0.);
  // add radius if it exists
  if (u3D) xyz.xyz *= aRadius;
  // get position on the canvas
  vec4 glPos = uMatrix * xyz;
  // apply w correction
  glPos.xyz /= glPos.w;
  glPos.w = 1.;
  // apply normal
  glPos.xy += norm * width / uAspect;
  // set position
  gl_Position = glPos;
}


// void main () {
//   // prep layer index and feature index positions
//   int index = 0;
//   int featureIndex = int(aIndex);
//   // get proper normal
//   vec2 norm = aNormal / 32767.;
//   // decode color
//   color = decodeFeature(true, index, featureIndex);
//   // decode line width
//   float width = decodeFeature(false, index, featureIndex)[0];
//   vWidth = vec2(width, 0.);
//   // get scale
//   float scale = pow(2., uInputs[0] - uFaceST[1]);
//   // apply scale according to tile size
//   width /= scale * 512. * 2.;
//
//   // set variants
//   vNorm = norm;
//
//   // multiply width by pos and normal
//   vec2 newPos = (aPos / 4096.) + norm * width;
//   // send off the length so far
//   // lengthSoFar = aLengthSoFar;
//   // set position
//   gl_Position = uMatrix * STtoXYZ(newPos);
// }
