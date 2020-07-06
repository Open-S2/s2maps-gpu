#version 300 es
precision mediump float;

layout (location = 0) in vec2 aUV; // float [u, v]
layout (location = 1) in vec2 aST; // float [s, t]           (INSTANCED)
layout (location = 2) in vec2 aXY; // float [x, y]           (INSTANCED)
layout (location = 3) in vec2 aPad; // float [x, y]          (INSTANCED)
layout (location = 4) in float aWidth; // float width        (INSTANCED)
layout (location = 5) in float aID; // float ID              (INSTANCED)

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform int uMode; // 0 => points ; 1 => quads ; 2 => textures
uniform float uDevicePixelRatio;

uniform sampler2D uFeatures;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature2;
#include ./ST2XYZ;

out vec4 color;

void main () {
  // prep xyz
  vec4 xyz = STtoXYZ(aST);
  // for points, add a little to ensure it doesn't get clipped
  xyz.xyz *= 1.001;
  // find the position on screen
  vec4 glPos = uMatrix * xyz;
  glPos.xyz /= glPos.w;
  glPos.w = 1.;
  // compute based upon our current step
  if (uMode == 0) {
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    color = vec4(float(id & 255) / 255., float((id >> 8) & 255) / 255., float(id >> 16) / 255., 1.);
    // set pointSize
    gl_PointSize = 5.;
  } else if (uMode == 1) {
    // prep the index and featureIndex
    int index = 0;
    int featureIndex = 0;
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    ivec3 colorID = ivec3(id & 255, (id >> 8) & 255, id >> 16);
    // grab the size
    float size = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio;
    // create width & height, adding padding to the total size
    vec2 WH = vec2(aWidth * size, size) + (aPad * 2. * uDevicePixelRatio);

    // check if the point exists with the same id in our sampler
    vec2 texPos = vec2(glPos.x / 2. + 0.5, glPos.y / 2. + 0.5);
    vec4 pointID = texture(uFeatures, texPos);

    // add x-y offset & use the UV to map the quad
    glPos.xy += (aXY * size) / uAspect;
    glPos.xy += WH / uAspect * aUV;
    // if colorID matches the existing pixels value, we draw the quad, otherwise we draw nothing
    if (colorID == ivec3(pointID.rgb * 256.)) {
      pointID.a = 0.1; // 2 / 255
      color = pointID;
    } else {
      color = vec4(0.);
    }
  } else { // uMode == 2 (result buffer)
    // prep the index and featureIndex
    int index = 0;
    int featureIndex = 0;
    // we check that all 4 corners of the quad are 1/255th opacity AND the same colorID
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
    // grab the size
    float size = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio;
    // create width & height, adding padding to the total size
    vec2 WH = vec2(aWidth * size, size) + (aPad * 2. * uDevicePixelRatio);

    vec2 tPos = vec2(glPos.xy);
    // add x-y offset & add half width and height position
    tPos += (aXY * size) / uAspect;

    // get bottom left
    tPos += vec2(1., 1.) / uAspect;
    vec4 btmLft = texture(uFeatures, vec2(tPos / 2. + 0.5));
    // get top left
    tPos.y += (WH.y - 2.) / uAspect.y;
    vec4 topLft = texture(uFeatures, vec2(tPos / 2. + 0.5));

    if (colorID == ivec3(btmLft.rgb * 256.) && btmLft.a <= 0.1 && colorID == ivec3(topLft.rgb * 256.) && topLft.a <= 0.1) {
      // check top right, if top right, we are done
      tPos.x += (WH.x - 2.) / uAspect.x;
      vec4 topRght = texture(uFeatures, vec2(tPos / 2. + 0.5));
      ivec3 topRghtValue = ivec3(topRght.rgb * 256.);
      if (colorID == topRghtValue && topRght.a <= 0.1) {
        color = btmLft;
        color.a = 1.;
      } else {
        // check bottom right, bottom right we still pass colorID
        tPos.y -= (WH.y - 2.) / uAspect.y;
        vec4 btmRght = texture(uFeatures, vec2(tPos / 2. + 0.5));
        ivec3 btmRghtValue = ivec3(btmRght.rgb * 256.);
        if (colorID == btmRghtValue && btmRght.a <= 0.1) {
          color = btmLft;
          color.a = 1.;
        } else {
          color = vec4(0.);
        }
      }
    } else {
      color = vec4(0.);
    }

    // set point size
    gl_PointSize = 5.;
  }

  // set position
  gl_Position = glPos;
}
