precision highp float;

attribute float aStep; // either 0 or 1
attribute vec2 aST; // float [s, t]     (INSTANCED)
attribute vec2 aXY; // float [x, y]     (INSTANCED)
attribute vec2 aOffset; // float [x, y] (INSTANCED)
attribute vec2 aPad; // float [x, y]    (INSTANCED)
attribute vec2 aWH; // float [w, h]     (INSTANCED)
attribute float aIndex; // float index  (INSTANCED)
attribute vec4 aID; // float ID         (INSTANCED)

varying vec4 vColor;

uniform vec2 uAspect;
uniform int uMode; // 0 => points ; 1 => quads ; 2 => results
uniform float uDevicePixelRatio;
uniform float uIndexOffset;

uniform sampler2D uQuads;

// WebGL1 specific uniforms
uniform float uSize;

@import "./getPos.glsl"

bool overlap (vec4 aOverlap, vec4 bOverlap) { // vec4(left, bottom, right, top)
  if (bOverlap.x == 0. && bOverlap.z == 0.) return false;
  if (aOverlap.x >= bOverlap.z || bOverlap.x >= aOverlap.z) return false;
  if (aOverlap.w <= bOverlap.y || bOverlap.w <= aOverlap.y) return false;
  return true;
}

vec4 getBbox (float bboxIndex) {
  vec4 btmLeft = texture2D(uQuads, vec2(bboxIndex / 4096., 0.));
  vec4 topRght = texture2D(uQuads, vec2(bboxIndex / 4096., 1.));
  return vec4(
    (btmLeft.r * 255. * pow(2., 8.)) + btmLeft.g * 255.,
    (btmLeft.b * 255. * pow(2., 8.)) + btmLeft.a * 255.,
    (topRght.r * 255. * pow(2., 8.)) + topRght.g * 255.,
    (topRght.b * 255. * pow(2., 8.)) + topRght.a * 255.
  );
}

// https://gist.github.com/EliCDavis/f35a9e4afb8e1c9ae94cce8f3c2c9b9a
int AND (int n1, int n2) {
  float v1 = float(n1);
  float v2 = float(n2);

  int byteVal = 1;
  int result = 0;

  for (int i = 0; i < 32; i++) {
    bool keepGoing = v1 > 0.0 || v2 > 0.0;
    if (keepGoing) {
      bool addOn = mod(v1, 2.0) > 0.0 && mod(v2, 2.0) > 0.0;

      if (addOn) result += byteVal;

      v1 = floor(v1 / 2.0);
      v2 = floor(v2 / 2.0);
      byteVal *= 2;
    } else { return result; }
  }

  return result;
}

int rightShift (int num, float shifts) {
  return int(floor(float(num) / pow(2.0, shifts)));
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
    float size = uSize;
    // create width & height, adding padding to the total size
    vec2 WH = aWH * (size * uDevicePixelRatio) + (aPad * 2.);
    // place the x1, y1, x2, y2 into the texture
    // I add the length and width of the canvas to the total just incase a glyph filter
    // starts slightly below or to the left of the canvas
    vec2 bottomLeft = (((glPos.xy + 1.) / 2.) * uAspect) + 1000. + (((aXY * size) + aOffset) * uDevicePixelRatio);
    // convert to uAspect integer value and split horizontal and vertical into two 8 bit pieces
    if (glPos.z > zero.z) {
      vColor = vec4(0.);
    } else if (aStep == 0.) {
      ivec2 res = ivec2(floor(bottomLeft));
      // vColor = vec4(float(res.x >> 8) / 255., float(res.x & 255) / 255., float(res.y >> 8) / 255., float(res.y & 255) / 255.);
      vColor = vec4(float(AND(rightShift(res.x, 8.), 255)) / 255., float(AND(res.x, 255)) / 255., float(AND(rightShift(res.y, 8.), 255)) / 255., float(AND(res.y, 255)) / 255.);
    } else {
      ivec2 res = ivec2(ceil(bottomLeft + WH));
      // vColor = vec4(float(res.x >> 8) / 255., float(res.x & 255) / 255., float(res.y >> 8) / 255., float(res.y & 255) / 255.);
      vColor = vec4(float(AND(rightShift(res.x, 8.), 255)) / 255., float(AND(res.x, 255)) / 255., float(AND(rightShift(res.y, 8.), 255)) / 255., float(AND(res.y, 255)) / 255.);
    }
  } else { // uMode == 2 (result buffer)
    // set point size
    gl_PointSize = 3.;
    // set color to id
    vColor = aID;
    // grab the current bbox
    int curIndex = int(aIndex + uIndexOffset);
    vec4 curBbox = getBbox(float(curIndex));
    // if the current bbox is 0, 0, 0, 0 -> we don't draw
    if (curBbox.x == 0. && curBbox.z == 0.) {
      vColor = vec4(0.);
    } else {
      // otherwise we loop through bbox's prior, if they are also not 0, 0, 0, 0 we check for overlap
      for (int i = 0; i < 4096; i++) {
        vec4 bbox = getBbox(float(i));
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
