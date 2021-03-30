precision highp float;

@nomangle vPos uSkybox

uniform samplerCube uSkybox;

varying vec4 vPos;

void main () {
  gl_FragColor = textureCube(uSkybox, normalize(vPos.xyz / vPos.w));
}
