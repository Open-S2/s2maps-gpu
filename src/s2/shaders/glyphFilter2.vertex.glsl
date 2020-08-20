#version 300 es
precision highp float;

layout (location = 0) in float aStep; // either 0 or 1
layout (location = 1) in vec2 aST; // float [s, t]    (INSTANCED)
layout (location = 2) in vec2 aXY; // float [x, y]    (INSTANCED)
layout (location = 3) in vec2 aPad; // float [x, y]   (INSTANCED)
layout (location = 4) in float aWidth; // float width (INSTANCED)
layout (location = 5) in float aIndex; // float index (INSTANCED)
layout (location = 6) in float aID; // float ID       (INSTANCED)

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform int uMode; // 0 => points ; 1 => quads ; 2 => results
uniform float uDevicePixelRatio;
uniform float uIndexOffset;

uniform sampler2D uPoints;
uniform sampler2D uQuads;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature2;
#include ./ST2XYZ;

out vec4 color;

bool overlap (vec4 a, vec4 b) { // vec4(left, bottom, right, top)
  if (a.x >= b.z || b.x >= a.z) return false;
  if (a.w <= b.y || b.w <= a.y) return false;
  return true;
}

vec4 getBbox (int index) {
  vec4 btmLeft = texelFetch(uQuads, ivec2(index, 0), 0);
  vec4 topRght = texelFetch(uQuads, ivec2(index + 2048, 0), 0);
  return vec4(
    (int(btmLeft.r * 255.) << 8) + int(btmLeft.g * 255.),
    (int(btmLeft.b * 255.) << 8) + int(btmLeft.a * 255.),
    (int(topRght.r * 255.) << 8) + int(topRght.g * 255.),
    (int(topRght.b * 255.) << 8) + int(topRght.a * 255.)
  );
}

void main () {
  // prep xyz
  vec4 xyz = STtoXYZ(aST);
  // for points, add a little to ensure it doesn't get clipped
  xyz.xyz *= 1.001;
  // find the position on screen
  vec4 glPos = uMatrix * xyz;
  glPos.xyz /= glPos.w;
  glPos.w = 1.;
  // set position
  gl_Position = glPos;
  // set point size
  gl_PointSize = 5.;
  // compute based upon our current step
  if (uMode == 0) {
    // MODE 0 - simply draw the texts positional point. Color represents the ID of the text feature
    // This mode will naturally filter out any points that are behind the sphere
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    color = vec4(float(id & 255) / 255., float((id >> 8) & 255) / 255., float(id >> 16) / 255., 1.);
  } else if (uMode == 1) {
    // check if the point exists. If so, we draw the text quad as data in a texture.
    // only draw to one point
    gl_PointSize = 1.;
    // set position
    if (aStep == 0.) gl_Position = vec4(2. * ((aIndex + uIndexOffset) / 4096.) - 1., 0., 0., 1.);
    else gl_Position = vec4(2. * ((2048. + aIndex + uIndexOffset) / 4096.) - 1., 0., 0., 1.);

    // check if point exists, that means it passed the depth test
    int id = int(aID);
    ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
    vec2 pPos = vec2(glPos.xy);
    vec4 point = texture(uPoints, vec2(pPos / 2. + 0.5));
    if (colorID == ivec3(point.rgb * 256.)) {
      // prep the index and featureIndex
      int index = 0;
      int featureIndex = 0;
      // grab the size
      float size = decodeFeature(false, index, featureIndex)[0];
      // create width & height, adding padding to the total size
      vec2 WH = vec2(aWidth, 1.) * size * uDevicePixelRatio + (aPad * 2.);
      // place the x1, y1, x2, y2 into the texture
      // I add the length and width of the canvas to the total just incase a glyph filter
      // starts slightly below or to the left of the canvas
      vec2 bottomLeft = (glPos.xy * uAspect) + uAspect + (aXY * size * uDevicePixelRatio);
      // convert to uAspect integer value and split horizontal and vertical into two 8 bit pieces
      if (aStep == 0.) {
        ivec2 res = ivec2(floor(bottomLeft));
        color = vec4(float(res.x >> 8) / 255., float(res.x & 255) / 255., float(res.y >> 8) / 255., float(res.y & 255) / 255.);
      } else {
        ivec2 res = ivec2(ceil(bottomLeft + WH));
        color = vec4(float(res.x >> 8) / 255., float(res.x & 255) / 255., float(res.y >> 8) / 255., float(res.y & 255) / 255.);
      }
    } else {
      color = vec4(0.);
    }
  } else { // uMode == 2 (result buffer)
    // set color to id
    int id = int(aID);
    color = vec4(float(id & 255) / 255., float((id >> 8) & 255) / 255., float(id >> 16) / 255., 1.);
    // grab the current bbox
    int curIndex = int(aIndex + uIndexOffset);
    vec4 curBbox = getBbox(curIndex);
    // if the current bbox is 0, 0, 0, 0 -> we don't draw
    if (curBbox.x == 0. && curBbox.z == 0.) {
      color = vec4(0.);
    } else {
      // otherwise we loop through bbox's prior, if they are also not 0, 0, 0, 0 we check for overlap
      for (int i = 0; i < curIndex; i++) {
        vec4 bbox = getBbox(i);
        // if any of these bbox's overlap, than we should not render
        if (bbox.x == 0. && bbox.z == 0.) {
          continue;
        } else if (overlap(curBbox, bbox)) {
          color = vec4(0.);
          break;
        }
      }
    }
  }
}
