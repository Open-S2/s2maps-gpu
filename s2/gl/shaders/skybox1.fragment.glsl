precision highp float;

uniform samplerCube uSkybox;

varying vec4 vPos;

void main () {
  gl_FragColor = textureCube(uSkybox, normalize(vPos.xyz / vPos.w));
}
