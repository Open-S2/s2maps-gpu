precision highp float;

attribute vec2 aPos;
attribute vec2 aNormal;
attribute float aRadius;
attribute float aIndex;

uniform mat4 uMatrix;
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature;
#include ./ST2XYZ;

varying vec4 color;

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
  width /= scale * 512. * 2.;

  // multiply width by pos and normal
  vec2 newPos = aPos + aNormal * width;
  // send off the length so far
  // lengthSoFar = aLengthSoFar;
  // set position
  gl_Position = uMatrix * STtoXYZ(newPos);
}
