#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute float aStep; // either 0 or 1
attribute vec2 aST; // float [s, t]    (INSTANCED)
attribute vec2 aXY; // float [x, y]    (INSTANCED)
attribute vec2 aPad; // float [x, y]   (INSTANCED)
attribute float aWidth; // float width (INSTANCED)
attribute float aIndex; // float index (INSTANCED)
attribute float aID; // float ID       (INSTANCED)

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform int uMode; // 0 => points ; 1 => quads ; 2 => results
uniform float uDevicePixelRatio;
uniform float uIndexOffset;

uniform sampler2D uPoints;
uniform sampler2D uQuads;

// WebGL1 specific uniforms
uniform float uSize;

@include "./ST2XYZ.glsl"

varying vec4 color;

bool overlap (vec4 a, vec4 b) { // vec4(left, bottom, right, top)
  if (a.x >= b.z || b.x >= a.z) return false;
  if (a.w <= b.y || b.w <= a.y) return false;
  return true;
}

vec4 getBbox (float index) {
  vec4 btmLeft = texture2D(uQuads, vec2(index / 2048., 0.));
  vec4 topRght = texture2D(uQuads, vec2((index + 1024.) / 2048., 0.));
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
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    color = vec4(float(AND(id, 255)) / 255., float(AND(rightShift(id, 8.), 255)) / 255., float(rightShift(id, 16.)) / 255., 1.);
  } else if (uMode == 1) {
    // only draw to one point
    gl_PointSize = 1.;
    // set position
    if (aStep == 0.) gl_Position = vec4(2. * ((0.5 + aIndex + uIndexOffset) / 2048.) - 1., 0., 0., 1.);
    else gl_Position = vec4(2. * ((0.5 + 1024. + aIndex + uIndexOffset) / 2048.) - 1., 0., 0., 1.);

    // check if point exists, that means it passed the depth test
    int id = int(aID);
    ivec3 colorID = ivec3(float(AND(id, 255)), float(AND(rightShift(id, 8.), 255)), float(rightShift(id, 16.)));
    vec2 pPos = vec2(glPos.xy);
    vec4 point = texture2D(uPoints, vec2(pPos / 2. + 0.5));
    if (colorID == ivec3(point.rgb * 256.)) {
      // prep the index and featureIndex
      int index = 0;
      int featureIndex = 0;
      // create size
      float size = uSize * uDevicePixelRatio * 2.;
      // create width & height, adding padding to the total size
      vec2 WH = vec2(aWidth, 1.) * size + (aPad * 2.);
      // place the x1, y1, x2, y2 into the texture
      // I add the length and width of the canvas to the total just incase a glyph filter
      // starts slightly below or to the left of the canvas
      vec2 bottomLeft = (glPos.xy * uAspect) + uAspect + (aXY * size);
      // convert to uAspect integer value and split horizontal and vertical into two 8 bit pieces
      if (aStep == 0.) {
        ivec2 res = ivec2(ceil(bottomLeft));
        color = vec4(float(rightShift(res.x, 8.)) / 255., float(AND(res.x, 255)) / 255., float(rightShift(res.y, 8.)) / 255., float(AND(res.y, 255)) / 255.);
      } else {
        ivec2 res = ivec2(floor(bottomLeft + WH));
        color = vec4(float(rightShift(res.x, 8.)) / 255., float(AND(res.x, 255)) / 255., float(rightShift(res.y, 8.)) / 255., float(AND(res.y, 255)) / 255.);
      }
    } else {
      color = vec4(0.);
    }
  } else { // uMode == 2 (result buffer)
    // set color to id
    int id = int(aID);
    color = vec4(float(AND(id, 255)) / 255., float(AND(rightShift(id, 8.), 255)) / 255., float(rightShift(id, 16.)) / 255., 1.);
    // grab the current bbox
    int curIndex = int(aIndex + uIndexOffset);
    vec4 curBbox = getBbox(float(curIndex));
    // if the current bbox is 0, 0, 0, 0 -> we don't draw
    if (curBbox.x == 0. && curBbox.z == 0.) {
      color = vec4(0.);
    } else {
      // otherwise we loop through bbox's prior, if they are also not 0, 0, 0, 0 we check for overlap
      for (int i = 0; i < 2048; i++) {
        vec4 bbox = getBbox(float(i));
        // if any of these bbox's overlap, than we should not render
        if (i >= curIndex) {
          break;
        } else if (bbox.x == 0. && bbox.z == 0.) {
          continue;
        } else if (overlap(curBbox, bbox)) {
          color = vec4(0.);
          break;
        }
      }
    }
  }
}
