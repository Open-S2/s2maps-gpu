precision highp float;

attribute vec2 aUV; // float [u, v]
attribute vec2 aST; // float [s, t]           (INSTANCED)
attribute vec2 aXY; // float [x, y]           (INSTANCED)
attribute vec2 aWidth; // float width         (INSTANCED)
attribute float aID; // float ID              (INSTANCED)
attribute float aRadius; // float radius      (INSTANCED)

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform int uMode; // 0 => points ; 1 => quads ; 2 => textures
uniform bool u3D;

uniform sampler2D uFeatures;

#include ./ST2XYZ;

varying vec4 color;

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
  // if 3D, add radius
  // if (u3D) xyz.xyz *= aRadius;
  // for points, extend a little to ensure it doesn't get improperly clipped
  xyz.xyz *= 1.01;
  // find the position on screen
  vec4 glPos = uMatrix * xyz;
  glPos.xyz /= glPos.w;
  glPos.w = 1.;
  // compute based upon our current step
  if (uMode == 0) {
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    color = vec4(float(AND(id, 255)) / 255., float(AND(rightShift(id, 8.), 255)) / 255., float(rightShift(id, 16.)) / 255., 1.);
    // set pointSize
    gl_PointSize = 5.;
  } else if (uMode == 1) {
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    ivec3 colorID = ivec3(AND(id, 255), AND(rightShift(id, 8.), 255), rightShift(id, 16.));
    // grab the size
    float size = 26;
    // create width height
    vec2 WH = vec2(aWidth * size, size);

    // check if the point exists with the same id in our sampler
    vec2 texPos = vec2(glPos.x / 2. + 0.5, glPos.y / 2. + 0.5);
    vec4 pointID = texture2D(uFeatures, texPos);

    // add x-y offset & use the UV to map the quad
    glPos.xy += aXY / uAspect;
    glPos.xy += WH / uAspect * aUV;
    // if colorID matches the existing pixels value, we draw the quad, otherwise we draw nothing
    if (colorID == ivec3(pointID.rgb * 256.)) {
      pointID.a = 0.025; // 2 / 255
      color = pointID;
    } else {
      color = vec4(0.);
    }
  } else { // uMode == 2 (result buffer)
    // we check that all 4 corners of the quad are 1/255th opacity AND the same colorID
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    ivec3 colorID = ivec3(AND(id, 255), AND(rightShift(id, 8.), 255), rightShift(id, 16.));

    vec2 tPos = vec2(glPos.xy);
    // add x-y offset & add half width and height position
    tPos += aXY / uAspect;

    // get bottom left
    tPos += vec2(1., 1.) / uAspect;
    vec4 btmLft = texture2D(uFeatures, vec2(tPos / 2. + 0.5));
    // get top left
    tPos.y += (WH.y - 2.) / uAspect.y;
    vec4 topLft = texture2D(uFeatures, vec2(tPos / 2. + 0.5));

    if (colorID == ivec3(btmLft.rgb * 256.) && btmLft.a <= 0.025 && colorID == ivec3(topLft.rgb * 256.) && topLft.a <= 0.025) {
      // check top right, if top right, we are done
      tPos.x += (WH.x - 2.) / uAspect.x;
      vec4 topRght = texture2D(uFeatures, vec2(tPos / 2. + 0.5));
      ivec3 topRghtValue = ivec3(topRght.rgb * 256.);
      if (colorID == topRghtValue && topRght.a <= 0.025) {
        color = btmLft;
        color.a = 1.;
      } else {
        // check bottom right, bottom right we still pass colorID
        tPos.y -= (WH.y - 2.) / uAspect.y;
        vec4 btmRght = texture2D(uFeatures, vec2(tPos / 2. + 0.5));
        ivec3 btmRghtValue = ivec3(btmRght.rgb * 256.);
        if (colorID == btmRghtValue && btmRght.a <= 0.025) {
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
    gl_PointSize = 4.;
  }

  // set position
  gl_Position = glPos;
}
