#version 300 es
precision highp float;

layout (location = 0) in float aStep; // either 0 or 1
layout (location = 1) in vec2 aST; // float [s, t]    (INSTANCED)
layout (location = 2) in vec2 aXY; // float [x, y]    (INSTANCED)
layout (location = 3) in vec2 aPad; // float [x, y]   (INSTANCED)
layout (location = 4) in vec2 aWH; // float [w, h]    (INSTANCED)
layout (location = 5) in float aIndex; // float index (INSTANCED)
layout (location = 6) in vec4 aID; // [r, g, b, a]    (INSTANCED)

out vec4 vColor;

uniform vec2 uAspect;
uniform int uMode; // 0 => points ; 1 => quads ; 2 => results
uniform float uDevicePixelRatio;
uniform float uIndexOffset;

uniform sampler2D uQuads;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

bool overlap (in vec4 aOverlap, in vec4 bOverlap) { // vec4(left, bottom, right, top)
  if (bOverlap.x == 0. && bOverlap.z == 0.) return false;
  if (aOverlap.x >= bOverlap.z || bOverlap.x >= aOverlap.z) return false;
  if (aOverlap.w <= bOverlap.y || bOverlap.w <= aOverlap.y) return false;
  return true;
}

vec4 getBbox (in int bboxIndex) {
  vec4 btmLeft = texelFetch(uQuads, ivec2(bboxIndex, 0), 0);
  vec4 topRght = texelFetch(uQuads, ivec2(bboxIndex, 1), 0);
  return vec4(
    float(int(btmLeft.r * 255.) << 8) + btmLeft.g * 255., // left
    float(int(btmLeft.b * 255.) << 8) + btmLeft.a * 255., // bottom
    float(int(topRght.r * 255.) << 8) + topRght.g * 255., // right
    float(int(topRght.b * 255.) << 8) + topRght.a * 255.  // top
  );
}

void main () {
  vec4 glPos = getPos(aST);
  vec4 zero = getZero();
  glPos.xyz /= glPos.w;
  glPos.w = 1.;
  zero.xyz /= zero.w;
  // set position
  gl_Position = glPos;
  // compute based upon our current step
  if (uMode == 1) {
    gl_PointSize = 1.;
    // set position
    if (aStep == 0.) gl_Position = vec4(2. * ((0.5 + aIndex + uIndexOffset) / 4096.) - 1., -0.5, 0., 1.);
    else gl_Position = vec4(2. * ((0.5 + aIndex + uIndexOffset) / 4096.) - 1., 0.5, 0., 1.);

    // prep the index and featureIndex
    int index = 0;
    int featureIndex = 0;
    // grab the size
    float size = decodeFeature(false, index, featureIndex)[0];
    // create width & height, adding padding to the total size
    vec2 WH = aWH * (size * uDevicePixelRatio) + (aPad * 2.);
    // place the x1, y1, x2, y2 into the texture
    // I add the length and width of the canvas to the total just incase a glyph filter
    // starts slightly below or to the left of the canvas
    vec2 bottomLeft = (((glPos.xy + 1.) / 2.) * uAspect) + 1000. + (aXY * size * uDevicePixelRatio);
    // convert to uAspect integer value and split horizontal and vertical into two 8 bit pieces
    if (glPos.z > zero.z) {
      vColor = vec4(0.);
    } else if (aStep == 0.) {
      ivec2 res = ivec2(floor(bottomLeft));
      vColor = vec4(float(res.x >> 8) / 255., float(res.x & 255) / 255., float(res.y >> 8) / 255., float(res.y & 255) / 255.);
    } else {
      ivec2 res = ivec2(ceil(bottomLeft + WH));
      vColor = vec4(float(res.x >> 8) / 255., float(res.x & 255) / 255., float(res.y >> 8) / 255., float(res.y & 255) / 255.);
    }
  } else { // uMode == 2 (result buffer)
    // set point size
    gl_PointSize = 3.;
    // set color to id
    vColor = aID;
    // grab the current bbox
    int curIndex = int(aIndex + uIndexOffset);
    vec4 curBbox = getBbox(curIndex);
    // if the current bbox is 0, 0, 0, 0 -> we don't draw
    if (curBbox.x == 0. && curBbox.z == 0.) {
      vColor = vec4(0.);
    } else {
      // otherwise we loop through bbox's prior, if they are also not 0, 0, 0, 0 we check for overlap
      for (int i = 0; i < curIndex; i++) {
        vec4 bbox = getBbox(i);
        // if any of these bbox's overlap, than we should not render
        if (i >= curIndex) {
          break;
        } else if (overlap(curBbox, bbox)) {
          vColor = vec4(0.);
          break;
        }
      }
    }
  }
}
