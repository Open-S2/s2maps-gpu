// @flow
import Program from './program'

// WEBGL1
import vert1 from '../shaders/line1.vertex.glsl'
import frag1 from '../shaders/line1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/line2.vertex.glsl'
import frag2 from '../shaders/line2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class LineProgram extends Program {
  uColor: WebGLUniformLocation
  uWidth: WebGLUniformLocation
  uCap: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aType: 0, aPrev: 1, aCurr: 2, aNext: 3 }
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // activate so we can setup samplers
    this.use()
    // set device pixel ratio
    this.setDevicePixelRatio(devicePixelRatio)
  }

  draw (featureGuide: FeatureGuide, source: VectorTileSource) {
    // grab context
    const { gl, context } = this
    const { type } = context
    // get current source data
    let { cap, count, offset, depthPos, featureCode, mode, color, width } = featureGuide
    // ensure no culling
    context.disableCullFace()
    // ensure proper blend state
    context.defaultBlend()
    // adjust to current depthPos
    context.lequalDepth()
    if (depthPos) context.setDepthRange(depthPos)
    else context.resetDepthRange()
    // set cap
    gl.uniform1f(this.uCap, cap)
    // set feature code
    if (type === 1) {
      gl.uniform4fv(this.uColor, color)
      gl.uniform1f(this.uWidth, width)
    } else { this.setFeatureCode(featureCode) }
    // apply the appropriate offset in the source vertexBuffer attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
    gl.vertexAttribPointer(1, 2, gl.SHORT, false, 12, 0 + ((offset | 0) * 12))
    gl.vertexAttribPointer(2, 2, gl.SHORT, false, 12, 4 + ((offset | 0) * 12))
    gl.vertexAttribPointer(3, 2, gl.SHORT, false, 12, 8 + ((offset | 0) * 12))
    // draw elements
    gl.drawArraysInstanced(mode || gl.TRIANGLES, 0, 9, count) // gl.drawArraysInstancedANGLE(mode, first, count, primcount)
  }
}

// precision highp float;
// attribute float aG;
// attribute vec2 aH;a
// ttribute vec2 aI;
// attribute vec2 aJ;
// varying vec2 aB;
// varying vec2 aC;
// varying vec2 aD;
// varying vec4 aE;
// varying float aF;
// uniform vec2 uK;
// uniform float uA;
// uniform float uL;
// uniform vec4 uM;
// uniform float uN;
// uniform float uO[6];
// uniform vec4 uP;
// uniform vec4 uQ;
// uniform mat4 uR;
// float STtoUV(float s){if(s>=0.5) return(1./3.)*(4.*s*s-1.);else return(1./3.)*(1.-4.*(1.-s)*(1.-s));}
// vec4 STtoXYZ(in vec2 st){st/=8192.;int face=int(uO[0]);vec3 xyz;vec2 uv=vec2(STtoUV(uO[2]*st.x+uO[3]),STtoUV(uO[4]*st.y+uO[5]) );if(face==0) xyz=vec3(uv.x,uv.y,1.);else if(face==1) xyz=vec3(1.,uv.y,-uv.x);else if(face==2) xyz=vec3(-uv.y,1.,-uv.x);else if(face==3) xyz=vec3(-uv.y,-uv.x,-1.);else if(face==4) xyz=vec3(-1.,-uv.x,uv.y);else xyz=vec3(uv.x,-1.,uv.y);xyz=normalize(xyz)*6371.0088;return vec4(xyz,1.);}
// vec4 getPosLocal(in vec2 pos){pos/=8192.;vec2 deltaBottom=uP.zw-uP.xy;vec2 deltaTop=uQ.zw-uQ.xy;vec2 bottomPosS=uP.xy+deltaBottom*pos.x;vec2 topPosS=uQ.xy+deltaTop*pos.x;vec2 deltaS=topPosS-bottomPosS;vec2 res=bottomPosS+deltaS*pos.y;return vec4(res,0.,1.);}
// vec4 getPos(in vec2 pos){if(uO[1]<12.){return uR*STtoXYZ(pos);}else{return getPosLocal(pos);}}
// vec4 getZero(){if(uO[1]<12.){return uR*vec4(0.,0.,0.,1.);}else{return vec4(0.,0.,1.,1.);}}
// bool isCCW(in vec2 cPrev,in vec2 aS,in vec2 aT){float det=(aS.y-cPrev.y)*(aT.x-aS.x)-(aS.x-cPrev.x)*(aT.y-aS.y);return det<0.;}
//
// void main(){
//   int index=0;
//   int featureIndex=0;
//   float width;
//   vec4 prev,curr,next,zero;
//   vec2 aspectAdjust=vec2(uK.x/uK.y,1.);
//   aF=0.;
//   aE=uM;
//   aE.rgb*=aE.a;
//   width=uN*uA;
//   aB=vec2(width,0.);
//   curr=getPos(aI);
//   next=getPos(aJ);
//   prev=getPos(aH);
//   zero=getZero();
//   curr.xyz/=curr.w;
//   next.xyz/=next.w;
//   prev.xyz/=prev.w;
//   zero.xyz/=zero.w;
//   vec2 currScreen=curr.xy*aspectAdjust;
//   vec2 nextScreen=next.xy*aspectAdjust;
//   vec2 prevScreen=prev.xy*aspectAdjust;
//   vec2 screen=curr.xy;
//   vec2 normal;
//   vec4 pos=vec4(0.);
//   if(curr.z<zero.z && next.z<zero.z){
//     bool currPrev=curr==prev;
//     if(uL !=0. && (currPrev||curr==next) && (aG==0.||aG==5.||aG==6.) ){
//       aF=uL;aD=(curr.xy/2.+0.5)*uK;
//       normal=(currPrev)?normalize(nextScreen-currScreen):normalize(currScreen-prevScreen);
//       vec2 capNormal=normal;
//       normal=vec2(-normal.y,normal.x);
//       if(aG==0.||aG==5.) normal*=-1.;
//       if(currPrev) capNormal*=-1.;
//       if(aG==5.||(aG==6. && currPrev)) screen+=capNormal*width/uK;
//       pos=vec4(screen+normal*width/uK,0.,1.);
//     }else{
//       if(aG==0.) normal=vec2(0.);
//       else if(aG==5.) normal=normalize(currScreen-prevScreen);
//       else normal=normalize(nextScreen-currScreen);
//       normal=vec2(-normal.y,normal.x);
//       if(aG==1.||aG==3.||((aG==5.||aG==6.) && isCCW(prevScreen,currScreen,nextScreen)) ) normal*=-1.;
//       if(aG==3.||aG==4.) screen=next.xy;
//       pos=vec4(screen+normal*width/uK,0.,1.);
//     }
//   }
//   aC=normal;
//   gl_Position=pos;
// }

// aCurr: "aI"
// aNext: "aJ"
// aPrev: "aH"
// aType: "aG"
// cCurr: "aS"
// cNext: "aT"
// vCenter: "aD"
// vColor: "aE"
// vDrawType: "aF"
// vNorm: "aC"
// vWidth: "aB"

// uAspect: "uK"
// uBottom: "uP"
// uCap: "uL"
// uColor: "uM"
// uDevicePixelRatio: "uA"
// uFaceST: "uO"
// uMatrix: "uR"
// uTop: "uQ"
// uWidth: "uN"

// "precision highp float;layout(location=0) in float aH;layout(location=1) in vec2 aI;layout(location=2) in vec2 aJ;layout(location=3) in vec2 aK;out vec2 aA;out vec2 aB;out vec2 aC;out vec4 aD;out float aE;uniform float uG;uniform vec2 uL;uniform float uM;uniform float uN[16];uniform float uO[128];uniform float uP[64];uniform bool uQ;vec4 LCH2LAB(in vec4 lch){float h=lch.b*(3.1415926538/180.);return vec4(lch.r,cos(h)*lch.g,sin(h)*lch.g,lch.a );}float LAB2XYZ(in float t){return t>0.206896552?t*t*t:0.12841855*(t-0.137931034);}float XYZ2RGB(in float r){return 255.*(r<=0.00304?12.92*r:1.055*pow(r,1./2.4)-0.055);}vec4 LAB2RGB(in vec4 lab){float x,y,z,r,g,b;y=(lab.r+16.)/116.;x=y+lab.g/500.;z=y-lab.b/200.;x=0.950470*LAB2XYZ(x);y=1.*LAB2XYZ(y);z=1.088830*LAB2XYZ(z);r=XYZ2RGB(3.2404542*x-1.5371385*y-0.4985314*z);g=XYZ2RGB(-0.9692660*x+1.8760108*y+0.0415560*z);b=XYZ2RGB(0.0556434*x-0.2040259*y+1.0572252*z);if(r<0.) r=0.;else if(r>255.) r=255.;if(g<0.) g=0.;else if(g>255.) g=255.;if(b<0.) b=0.;else if(b>255.) b=255.;return vec4(r,g,b,lab.a);}vec4 LCH2RGB(in vec4 lch){vec4 res;res=LCH2LAB(lch);res=LAB2RGB(res);res.r/=255.;res.g/=255.;res.b/=255.;return res;}float exponentialInterpolation(float inputVal,float start,float end,float base){float diff=end-start;if(diff==0.) return 0.;if(base<=0.) base=0.1;else if(base>2.) base=2.;float progress=inputVal-start;if(base==1.) return progress/diff;return(pow(base,progress)-1.)/(pow(base,diff)-1.);}vec4 interpolateColor(vec4 color1,vec4 color2,float t){if(t==0.) return color1;else if(t==1.) return color2;float sat,hue,lbv,dh,alpha;if(uQ){if(color2[0]>color1[0] && color2[0]-color1[0]>180.) dh=color2[0]-color1[0]+360.;else if(color2[0]<color1[0] && color1[0]-color2[0]>180.) dh=color2[0]+360.-color1[0];else dh=color2[0]-color1[0];hue=color1[0]+t*dh;}else{hue=color1[0]+t*(color2[0]-color1[0]);}sat=color1[1]+t*(color2[1]-color1[1]);lbv=color1[2]+t*(color2[2]-color1[2]);alpha=color1[3]+t*(color2[3]-color1[3]);return vec4(hue,sat,lbv,alpha);}vec4 decodeFeature(bool color,inout int index,inout int featureIndex){int decodeOffset=index;int startingOffset=index;int featureSize=int(uO[index])>>10;vec4 res=vec4(-1,-1,-1,-1);int conditionStack[6];float tStack[6];int stackIndex=1;conditionStack[0]=index;int len,conditionSet,condition;do{stackIndex--;startingOffset=index=conditionStack[stackIndex];conditionSet=int(uO[index]);len=conditionSet>>10;condition=(conditionSet & 1008)>>4;index++;if(condition==0){}else if(condition==1){if(res[0]==-1.){for(int i=0;i<len-1;i++) res[i]=uO[index+i];}else{if(color){vec4 val=vec4(uO[index],uO[index+1],uO[index+2],uO[index+3]);res=interpolateColor(res,val,tStack[stackIndex]);}else{for(int i=0;i<len-1;i++) res[i]=res[i]+tStack[stackIndex]*(uO[index+i]-res[i]);}}}else if(condition==2||condition==3){float inputVal,conditionInput;if(condition==2){inputVal=uP[featureIndex];featureIndex++;}else{inputVal=uN[(conditionSet & 14)>>1];}conditionInput=uO[index];while(inputVal !=conditionInput){index+=(int(uO[index+1])>>10)+1;conditionInput=uO[index];if(conditionInput==0.) break;}index++;conditionStack[stackIndex]=index;tStack[stackIndex]=1.;stackIndex++;}else if(condition==4||condition==5){int interpolationType=conditionSet & 1;int inputType=(conditionSet & 14)>>1;float base=1.;if(interpolationType==1){base=uO[index];index++;}float inputVal,start,end;int startIndex,endIndex,subCondition;if(condition==4){inputVal=uP[featureIndex];featureIndex++;}else{inputVal=uN[inputType];}start=end=uO[index];startIndex=endIndex=index+1;while(end<inputVal && endIndex<len+startingOffset){subCondition=(int(uO[startIndex]) & 1008)>>4;if(subCondition==2||subCondition==4) featureIndex++;index++;index+=int(uO[index])>>10;start=end;startIndex=endIndex;endIndex=index+1;if(endIndex<len+startingOffset) end=uO[index];}if(startIndex==endIndex){conditionStack[stackIndex]=startIndex;tStack[stackIndex]=1.;if(stackIndex>0) tStack[stackIndex]=tStack[stackIndex-1];stackIndex++;}else if(end==inputVal){conditionStack[stackIndex]=endIndex;tStack[stackIndex]=1.;if(stackIndex>0) tStack[stackIndex]=tStack[stackIndex-1];stackIndex++;}else{float t=exponentialInterpolation(inputVal,start,end,base);conditionStack[stackIndex]=startIndex;tStack[stackIndex]=1.-t;stackIndex++;conditionStack[stackIndex]=endIndex;tStack[stackIndex]=t;stackIndex++;}while(endIndex<len+startingOffset){subCondition=(int(uO[startIndex]) & 1008)>>4;if(subCondition==2||subCondition==4) featureIndex++;index++;index+=int(uO[index])>>10;endIndex=index+1;}}else if(condition==6){res=vec4(0.,0.,0.,1.);return res;}else if(condition==7){}if(stackIndex>5){index=featureSize+decodeOffset;if(color && uQ) res=LCH2RGB(res);return res;}}while(stackIndex>0);index=featureSize+decodeOffset;if(color && uQ) res=LCH2RGB(res);return res;}uniform float uR[6];uniform vec4 uS;uniform vec4 uT;uniform mat4 uU;float STtoUV(float s){if(s>=0.5) return(1./3.)*(4.*s*s-1.);else return(1./3.)*(1.-4.*(1.-s)*(1.-s));}vec4 STtoXYZ(in vec2 st){st/=8192.;int face=int(uR[0]);vec3 xyz;vec2 uv=vec2(STtoUV(uR[2]*st.x+uR[3]),STtoUV(uR[4]*st.y+uR[5]) );if(face==0) xyz=vec3(uv.x,uv.y,1.);else if(face==1) xyz=vec3(1.,uv.y,-uv.x);else if(face==2) xyz=vec3(-uv.y,1.,-uv.x);else if(face==3) xyz=vec3(-uv.y,-uv.x,-1.);else if(face==4) xyz=vec3(-1.,-uv.x,uv.y);else xyz=vec3(uv.x,-1.,uv.y);xyz=normalize(xyz)*6371.0088;return vec4(xyz,1.);}vec4 getPosLocal(in vec2 pos){pos/=8192.;vec2 deltaBottom=uS.zw-uS.xy;vec2 deltaTop=uT.zw-uT.xy;vec2 bottomPosS=uS.xy+deltaBottom*pos.x;vec2 topPosS=uT.xy+deltaTop*pos.x;vec2 deltaS=topPosS-bottomPosS;vec2 res=bottomPosS+deltaS*pos.y;return vec4(res,0.,1.);}vec4 getPos(in vec2 pos){if(uR[1]<12.){return uU*STtoXYZ(pos);}else{return getPosLocal(pos);}}vec4 getZero(){if(uR[1]<12.){return uU*vec4(0.,0.,0.,1.);}else{return vec4(0.,0.,1.,1.);}}bool isCCW(in vec2 cPrev,in vec2 aV,in vec2 aW){float det=(aV.y-cPrev.y)*(aW.x-aV.x)-(aV.x-cPrev.x)*(aW.y-aV.y);return det<0.;}void main(){int index=0;int featureIndex=0;float width;vec4 prev,curr,next,zero;vec2 aspectAdjust=vec2(uL.x/uL.y,1.);aE=0.;aD=decodeFeature(true,index,featureIndex);aD.rgb*=aD.a;width=decodeFeature(false,index,featureIndex)[0]*uG;aA=vec2(width,0.);curr=getPos(aJ);next=getPos(aK);prev=getPos(aI);zero=getZero();curr.xyz/=curr.w;next.xyz/=next.w;prev.xyz/=prev.w;zero.xyz/=zero.w;vec2 currScreen=curr.xy*aspectAdjust;vec2 nextScreen=next.xy*aspectAdjust;vec2 prevScreen=prev.xy*aspectAdjust;vec2 screen=curr.xy;vec2 normal;vec4 pos=vec4(0.);if(curr.z<zero.z && next.z<zero.z){bool currPrev=curr==prev;if(uM !=0. && (currPrev||curr==next) && (aH==0.||aH==5.||aH==6.) ){aE=uM;aC=(curr.xy/2.+0.5)*uL;normal=(currPrev)?normalize(nextScreen-currScreen):normalize(currScreen-prevScreen);vec2 capNormal=normal;normal=vec2(-normal.y,normal.x);if(aH==0.||aH==5.) normal*=-1.;if(currPrev) capNormal*=-1.;if(aH==5.||(aH==6. && currPrev)) screen+=capNormal*width/uL;pos=vec4(screen+normal*width/uL,0.,1.);}else{if(aH==0.) normal=vec2(0.);else if(aH==5.) normal=normalize(currScreen-prevScreen);else normal=normalize(nextScreen-currScreen);normal=vec2(-normal.y,normal.x);if(aH==1.||aH==3.||((aH==5.||aH==6.) && isCCW(prevScreen,currScreen,nextScreen)) ) normal*=-1.;if(aH==3.||aH==4.) screen=next.xy;pos=vec4(screen+normal*width/uL,0.,1.);}}aB=normal;gl_Position=pos;}"
