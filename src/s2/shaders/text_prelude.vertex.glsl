#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos; // float [s, t]
layout (location = 1) in vec2 aParam; // uint16 [width, height]
layout (location = 2) in vec2 aTexPos; // float [s, t]
layout (location = 3) in float aID;
layout (location = 6) in float aRadius;

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform uint textAnchor; // 0 => auto ; 1 => center ; 2 => top; 3 => topRight ; 4 => right ; 5 => bottomRight ; 6 => bottom ; 7 => bottomLeft ; 8 => left ; 9 => topLeft
uniform bool u3D;

@import ./ST2XYZ;

out vec2 vTexcoord;
out vec4 color;

void main () {
  // set where we are on the texture
  vTexcoord = aTexPos;
  // convert aID (really a uint32) to an rgba equivalent (split into 4 pieces of 8 bits)
  uint id = uint(aID);
  color = vec4(id & );
  // prep xyz
  vec4 xyz = STtoXYZ(aPos);
  // if 3D, add radius
  if (u3D) {
    xyz.x *= aRadius;
    xyz.y *= aRadius;
    xyz.z *= aRadius;
  }
  // find the position on screen
  vec4 glPos = uMatrix * xyz;
  // If we are using the textAnchor "auto" placement feature, we check the texture to see
  // if the font can be displayed or not. If any of the corners are already covered by another
  // text or billboard, we check another corner and draw there. For simplicity, only
  // top, left, right, bottom are checked

  // set position
  gl_Position = glPos;
}
