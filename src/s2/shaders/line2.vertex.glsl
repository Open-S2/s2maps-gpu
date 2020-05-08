#version 300 es
precision highp float;

layout (location = 1) in vec2 aPos;
layout (location = 2) in vec2 aNormal;
// layout (location = 3) in float aLengthSoFar;
layout (location = 6) in float aRadius;
layout (location = 7) in float aIndex;

uniform mat4 uMatrix;
// uniform vec2 uAspect;
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature2;
#include ./ST2XYZ;

// out float lengthSoFar;
out float vWidth;
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
  // get scale
  float scale = pow(2., uInputs[0] - uFaceST[1]);
  // apply scale according to tile size
  // width += 0.5; // add 1 pixel (on each side for antialias)
  width /= scale * 512. * 2.;
  // send width to fragment shader
  vWidth = width;
  // send normal to fragment shader
  vNorm = aNormal;

  // multiply width by pos and normal
  vec2 newPos = aPos + aNormal * width;
  // send off the length so far
  // lengthSoFar = aLengthSoFar;
  // set position
  gl_Position = uMatrix * STtoXYZ(newPos);
}


// ALTERNATE METHOD:
// // get vector normal
// vec4 xyz = STtoXYZ(aPos);
// // add radius if it exists
// if (u3D) xyz.xyz *= aRadius;
// // get position on the canvas
// vec4 glPos = uMatrix * xyz;
// // apply w correction
// glPos.xyz /= glPos.w;
// glPos.w = 1.;
// // apply normal
// glPos.xy += aNormal * width / uAspect;
// // set position
// gl_Position = glPos;
