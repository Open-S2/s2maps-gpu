import { Tree } from '@lezer/common';
import { parser } from './glsl';
import { formatAST, formatASTNode } from '../../util/tree';
import { addASTSerializer } from '../../test/snapshot';

addASTSerializer(expect);

describe("GLSL grammar snapshots", () => {
  
  it("parses a test program", () => {
    for (const program of PROGRAMS) {
      const parsed = parser.parse(program);
      parsed.text = program;
      
      const compact = formatASTNode(parsed.topNode);
      const hasError = compact.indexOf('⚠') >= 0;
      if (hasError) {
        console.error("Error while parsing");
        console.log(formatAST(parsed.topNode, program));
      }
      expect(hasError).toBe(false);
      expect(parsed).toMatchSnapshot();
    }
  });
  
});

const PROGRAMS = [

//////////////////////////////////////////////////////////////////////

`
float foo = 1.0;
`,

//////////////////////////////////////////////////////////////////////

`
#define WAT
`,

//////////////////////////////////////////////////////////////////////

`
struct light {
 float intensity;
 vec3 position;
} lightVar;

struct light2 {
 float intensity;
 vec3 position;
};
`,

//////////////////////////////////////////////////////////////////////

`
void main();
`,

//////////////////////////////////////////////////////////////////////

`
layout(location = 0) in wat;
layout(location = 0) in wat1, wat2;
layout(location = 1) in vec2;
`,

//////////////////////////////////////////////////////////////////////

`
float foo = 1.0;
#define WAT
void main() {
  int bar = wat(5, 6);
  int x = 4 + 5 + +6;
  struct s { } x;
  gl_FragColor = vec4(0.1, 0.2, 0.3, 1.0);
}
`,

//////////////////////////////////////////////////////////////////////

`
void main() {
  int x = 1;
  int y = 2;
  if (x) if (y) { } else { }
}
`,

//////////////////////////////////////////////////////////////////////

`
void main() {
  int x = 1;
  /*
  int y = 2;
  if (x) if (y) { } else { }
  */
  wat();
}
`,

//////////////////////////////////////////////////////////////////////

`
#pragma import {MeshVertex} from 'use/types'
#pragma import {viewUniforms as view, worldToClip} from 'use/view'
#pragma import {getQuadUV} from 'geometry/quad'

#pragma import 'test'

#ifdef DEF
#pragma optional
int getInt();
#endif

#pragma export
void main();
`,

//////////////////////////////////////////////////////////////////////

`
MeshVertex getQuad(int vertex) {
  vec2 uv = getQuadUV(vertex);
  vec4 position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vec4 color = vec4(1.0, 0.0, 1.0, 1.0);
  return MeshVertex(position, color, uv);
}
`,

//////////////////////////////////////////////////////////////////////

`
#version 450

layout(set = 0, binding = 0) uniform ViewUniforms {
  mat4 projectionMatrix;
  mat4 viewMatrix;
  vec4 viewPosition;
  vec4 lightPosition;
} view;

layout(location = 0) in vec4 position;
layout(location = 1) in vec4 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 uv;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec2 fragUV;

layout(location = 2) out vec3 fragNormal;
layout(location = 3) out vec3 fragLight;
layout(location = 4) out vec3 fragView;

void main() {
  gl_Position = view.projectionMatrix * view.viewMatrix * position;

  fragColor = color;
  fragUV = uv;

  fragNormal = normal.xyz;
  fragLight = view.lightPosition.xyz - position.xyz;
  fragView = view.viewPosition.xyz - position.xyz;
}
`,

//////////////////////////////////////////////////////////////////////

`
#version 450

layout(location = 0) in vec4 fragColor;
layout(location = 1) in vec2 fragUV;

layout(location = 2) in vec3 fragNormal;
layout(location = 3) in vec3 fragLight;
layout(location = 4) in vec3 fragView;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 pickingColor;

float PI = 3.141592;

float F_DIELECTRIC = 0.04;

float getGrid(vec2 uv) {
  vec2 xy = abs(fract(uv) - 0.5);
  return max(xy.x, xy.y) > 0.45 ? 1.0 : 0.75;
}

float saturate(float x) {
  return max(x, 0.0);
}

float pow5(float x) {
  float x2 = x * x;
  return x2 * x2 * x;
}
// https://www.shadertoy.com/view/XlKSDR
// D - Normal distribution term
float ndfGGX2(float cosTheta, float alpha) {
  float alphaSqr = alpha * alpha;
  float denom = cosTheta * cosTheta * (alphaSqr - 1.0) + 1.0f;
  return alphaSqr / (PI * denom * denom);
}

float ndfGGX(float cosTheta, float alpha) {
  float oneMinus = 1.0 - cosTheta * cosTheta;
  float a = cosTheta * alpha;
  float k = alpha / (oneMinus + a * a);
  float d = k * k * (1.0 / PI);
  return d;
}

// F - Schlick approximation of Fresnel
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  float FT = pow5(1.0f - cosTheta);
  return F0 + (1.0 - F0) * FT;
}

float fresnelSchlick(float cosTheta, float f0, float f90) {
  return f0 + (f90 - f0) * pow(1.0 - cosTheta, 5.0);
}

float fdBurley(float dotNL, float dotNV, float dotLH, float alpha) {
  float f90 = 0.5 + 2.0 * alpha * dotLH * dotLH;
  float lightScatter = fresnelSchlick(dotNL, 1.0, f90);
  float viewScatter = fresnelSchlick(dotNV, 1.0, f90);
  return lightScatter * viewScatter * (1.0 / PI);
}

// G - Geometric attenuation term
float G1X(float dotNX, float k) {
  return 1.0f / (dotNX * (1.0f - k) + k);
}

float smithGGXCorrelated(float dotNL, float dotNV, float alpha) {
  float a2 = alpha * alpha;
  float GGXL = dotNV * sqrt((dotNL - a2 * dotNL) * dotNL + a2);
  float GGXV = dotNL * sqrt((dotNV - a2 * dotNV) * dotNV + a2);
  return 0.5 / (GGXL + GGXV);
}

float geometricGGX(float dotNL, float dotNV, float alpha) {
  float k = alpha / 2.0f;
  return G1X(dotNL, k) * G1X(dotNV, k);
}

vec3 PBR(vec3 N, vec3 L, vec3 V, vec3 albedo, float metalness, float roughness) {

  vec3 diffuseColor = albedo * (1.0 - metalness);
  vec3 F0 = mix(vec3(F_DIELECTRIC), albedo, metalness);

  float alpha = roughness * roughness;
  float dotNV = saturate(dot(N, V));

  float radiance = 3.1415;

  vec3 H = normalize(V + L);
  float dotNL = saturate(dot(N, L));
  float dotNH = saturate(dot(N, H));
  float dotLH = saturate(dot(L, H));

  vec3 F = fresnelSchlick(dotLH, F0);
  float D = ndfGGX(dotNH, alpha);
  float G = smithGGXCorrelated(dotNL, dotNV, alpha);
  //float G2 = geometricGGX(dotNL, dotNV, alpha);
  //return vec3(abs(G - G2) / 100.0);
  
  vec3 Fd = albedo * fdBurley(dotNL, dotNV, dotLH, alpha);
  vec3 Fs = F * D * G;

  vec3 direct = (Fd + Fs) * radiance * dotNL;
  return direct;
}

void main() {
  vec3 N = normalize(fragNormal);
  vec3 L = normalize(fragLight);
  vec3 V = normalize(fragView);

  vec3 albedo = vec3(1.0);//fragColor.rgb;
  float metalness = 0.2;
  float roughness = 0.8;
  
  float grid = getGrid(fragUV);
  vec3 color = PBR(N, L, V, albedo, metalness, roughness);
  
  outColor = vec4(color * grid, fragColor.a);
}

`,

//////////////////////////////////////////////////////////////////////

];


