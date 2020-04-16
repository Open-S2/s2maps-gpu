#version 300 es
precision highp float;

layout (location = 0) in vec2 aUV; // float [u, v]
layout (location = 1) in vec2 aST; // float [s, t]           (INSTANCED)
layout (location = 2) in float aID; // float ID              (INSTANCED)
layout (location = 3) in vec2 aXY; // uint16 [x, y]          (INSTANCED)
layout (location = 4) in vec2 aWH; // uint16 [width, height] (INSTANCED)
layout (location = 5) in float aAnchor; // float anchor      (INSTANCED)
layout (location = 6) in float aRadius; // float radius      (INSTANCED)

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform vec2 uTexWH;
uniform int uMode; // 0 => points ; 1 => quads ; 2 => textures
uniform bool u3D;

uniform sampler2D uFeatures;

#include ./ST2XYZ;

flat out int iMode;
out vec2 vTexcoord;
out vec4 color;

void main () {
  // prep xyz
  vec4 xyz = STtoXYZ(aST);
  // if 3D, add radius
  if (u3D) xyz.xyz *= aRadius;
  xyz.xyz *= 1.01;
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
    gl_PointSize = 1.;
  } else if (uMode == 1) {
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    int id = int(aID);
    ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
    // check if the point exists with the same id in our sampler
    vec4 storedID = texelFetch(uFeatures, ivec2((glPos.x / 2. + 0.5) * uAspect.x * 2., (glPos.y / 2. + 0.5) * uAspect.y * 2.), 0);
    ivec3 value = ivec3(storedID.rgb * 256.);
    if (colorID == value) {
      color = storedID;
    } else {
      color = vec4(0, 0, 0, 0);
    }
    // update glPos by width and height
    float width = aWH.x / uAspect.x;
    float height = aWH.y / uAspect.y;
    // use the UV to map the quad, use
    glPos.x += (width * aUV.x) - (width / 2.);
    glPos.y += (height * aUV.y) - (height / 2.);

    vTexcoord = vec2((aXY.x + (aWH.x * aUV.x * 2.)) / uTexWH.x, (aXY.y + (aWH.y * aUV.y * 2.)) / uTexWH.y);
  } else {
    // we check that all 4 corners of the quad are visible, than draw
    // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
    // int id = int(aID);
    // ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
    // // check if the point exists with the same id in our sampler
    // vec4 storedID = texelFetch(uFeatures, ivec2((glPos.x / 2. + 0.5) * uAspect.x * 2., (glPos.y / 2. + 0.5) * uAspect.y * 2.), 0);
    // ivec3 value = ivec3(storedID.rgb * 256.);

    // update glPos by width and height
    float width = aWH.x / uAspect.x;
    float height = aWH.y / uAspect.y;
    // use the UV to map the quad, use
    glPos.x += (width * aUV.x) - (width / 2.);
    glPos.y += (height * aUV.y) - (height / 2.);

    vTexcoord = vec2(aXY.x + (aWH.x * aUV.x), aXY.y + (aWH.y * aUV.y));
  }

  // share mode with fragment
  iMode = uMode;

  // set position
  gl_Position = glPos;
}
