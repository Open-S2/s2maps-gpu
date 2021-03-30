#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

#define MIN_SDF_SIZE 0.08

@nomangle aUV aST aXY aOffset aTexUV aTexWH aID aColor draw buf vTexcoord color stroke shouldDraw uIsIcon

attribute vec2 aUV; // float [u, v]
attribute vec2 aST; // float [s, t]                   (INSTANCED)
attribute vec2 aXY; // float [x, y]                   (INSTANCED)
attribute vec2 aOffset; // float [xOffset, yOffset]   (INSTANCED)
attribute vec2 aTexUV; // float [u, v]                (INSTANCED)
attribute vec2 aTexWH; // float [width, height]       (INSTANCED)
attribute float aID; // float ID                      (INSTANCED)
attribute vec4 aColor; // [r, g, b, a]                (INSTANCED)

varying float draw;
varying float buf;
varying vec2 vTexcoord;
varying vec4 color;
varying vec4 stroke;

// glyph texture
uniform bool uIsIcon;
uniform bool uOverdraw;
uniform vec2 uTexSize;
uniform vec2 uAspect;
uniform bool uInteractive;
uniform float uDevicePixelRatio;
// WebGL1 specific uniforms
uniform float uSize;
uniform vec4 uFill;
uniform vec4 uStroke;
uniform float uStrokeWidth;
// The glyph filter texture.
uniform sampler2D uFeatures;

@include "./getPos.glsl"

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

// text order: (paint)size->strokeWidth->fill->stroke
void main () {
  vec4 glPos;
  if (uFaceST[1] < 12.) {
    // prep xyz
    vec4 xyz = STtoXYZ(aST);
    // for points, add a little to ensure it doesn't get clipped
    xyz.xyz *= 1.001;
    // find the position on screen
    glPos = uMatrix * xyz;
    glPos.xyz /= glPos.w;
    glPos.w = 1.;
  } else {
    glPos = getPosLocal(aST);
  }

  bool shouldDraw = true;
  float strokeWidth;
  vec4 inputID;
  // if we are filtering, check if this glyph was filtered out
  if (!uOverdraw || uInteractive) {
    // Check the "glyphFilter" result texture at current glPos to see if the aID matches
    // if not, we stop right here for color (discard)
    int id = int(aID);
    ivec3 colorID = ivec3(float(AND(id, 255)), float(AND(rightShift(id, 8.), 255)), float(rightShift(id, 16.)));
    inputID = texture2D(uFeatures, vec2(glPos / 2. + 0.5));
    if (colorID != ivec3(inputID.rgb * 256.)) shouldDraw = false;
  }
  // move on if not drawing
  if (!shouldDraw) return;

  // explain to fragment we are going to draw
  draw = (uInteractive) ? 2. : 1.;

  // prep the index and featureIndex
  int index = 0;
  int featureIndex = 0;
  // decode size
  float size = uSize * uDevicePixelRatio * 2.;
  // set fill
  color = (uInteractive)
    ? vec4(inputID.rgb, 1.)
    : (uIsIcon)
      ? aColor
      : uFill;

  color.rgb *= color.a;

  // prep texture read buffer
  buf = 0.49;
  if (!uIsIcon) {
    strokeWidth = uStrokeWidth * uDevicePixelRatio * 2.;
    stroke = uStroke;
    stroke.rgb *= stroke.a;
    if (strokeWidth > 0.) {
      buf = clamp((MIN_SDF_SIZE - buf) * strokeWidth + buf, MIN_SDF_SIZE, buf); // deltaY / deltaX + y-intercept
    }
  }

  // get the size of the glyph stored
  vec2 glyphSize = vec2(aTexWH.x * size, size);
  // add x-y offset as well as use the UV to map the quad
  vec2 XY = vec2(aXY.x + aOffset.x, aXY.y - aOffset.y) * size; // subtract the sdfWidth
  glPos.xy += (XY / uAspect) + (glyphSize / uAspect * aUV);
  // set texture position (don't bother wasting time looking up if drawing "interactive quad")
  if (!uInteractive) vTexcoord = (aTexUV / uTexSize) + (vec2(aTexWH.x * aTexWH.y, aTexWH.y) / uTexSize * aUV);

  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = glPos;
}
