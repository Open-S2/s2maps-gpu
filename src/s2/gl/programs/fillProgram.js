// @flow
// import Painter from '../painter'
import Program from './program'

// import type { FeatureGuide } from '../../source/tile'
import type { Context } from '../contexts'

export default class FillProgram extends Program {
  uMode: WebGLUniformLocation
  nullTexture: WebGLTexture
  evenOddTexture: WebGLTexture
  evenOddFrameBuffer: WebGLFramebuffer
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { 'aPos': 0, 'aRadius': 6, 'aIndex': 7 }
    // build shaders
    super(gl, require(`../../shaders/fill${type}.vertex.glsl`), require(`../../shaders/fill${type}.fragment.glsl`))
  }

  // fills are two pass. The first pass is to the renderbuffer
  drawFill (painter: Painter, featureGuide: FeatureGuide, source, maskID) {
    // grab context
    const { context } = painter
    const { gl } = context
    // get current source data
    let { count, featureCode, offset, threeD } = featureGuide
    // set 3D uniform
    this.set3D(threeD)
    // set feature code
    if (featureCode && featureCode.length) gl.uniform1fv(this.uFeatureCode, featureCode)

    // PASS 1 - fill the evenOddFrameBuffer
    // setup first pass in the context
    context.fillFirstPass(maskID)
    // set the correct mode
    this.setMode(1)
    // draw the triangles
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, (offset | 0) * 4)




    

    // // PASS 2 - use the evenOdd texture to fill in the data
    // // setup second pass
    // context.fillSecondPass(maskID)
    // // set the correct mode
    // this.setMode(2)
    // gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, (offset | 0) * 4)
    //
    // // PASS 3 - cleanup pass
    // this.setMode(1)
    // context.fillThirdPass(maskID)
    // gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, (offset | 0) * 4)
    //
    // context.fillFinish()
  }

  draw (painter: Painter, featureGuide: FeatureGuide) {
    // ensure default drawing mode is set
    this.setMode(0)
    // draw
    super.draw(painter, featureGuide)
  }

  // drawFill (painter: Painter, featureGuide: FeatureGuide, refMask: number) {
  //   // grab context
  //   const { context } = painter
  //   const { gl } = context
  //   // get current source data
  //   let { count, featureCode, offset, mode, threeD } = featureGuide
  //   // set 3D uniform
  //   this.set3D(threeD)
  //   // set feature code
  //   if (featureCode && featureCode.length) gl.uniform1fv(this.uFeatureCode, featureCode)
  //   // get mode
  //   if (!mode) mode = gl.TRIANGLES
  //   // set first pass
  //   // this.setMode(0)
  //   context.fillFirstPass(refMask)
  //   // draw elements
  //   gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  //   // set for second pass
  //   // this.setMode(1)
  //   context.fillSecondPass(refMask)
  //   // draw elements
  //   gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  //   // third pass
  //   context.fillThirdPass(refMask)
  //   // draw elements
  //   gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  // }
}
