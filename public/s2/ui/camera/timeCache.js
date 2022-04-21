// @flow
import TileCache from './tileCache'
import type { VectorTileSource, RasterTileSource } from '../../gl/contexts/context'
import { invert } from '../../util/mat4'

export type TimeSource = {
  interval: number
}

export type TimeLayerState = 'play' | 'pause' | 'stop'

export type TimeSeries = {
  startTime: number,
  endTime: number,
  speed: number, // seconds traveled per second
  pauseDuration: number, // in seconds
  autoPlay: boolean,
  loop: boolean,
  cursor: number,
  state: TimeLayerState
}
// play -> animation based upon startTime -> endTime using cursor
// pause -> running through pause duration
// stop -> do nothing

export default class TimeCache extends TileCache<string, VectorTileSource | RasterTileSource> {
  camera: Camera
  sources: { [string]: TimeSource } = {} // [sourceName]: { interval: number }
  lastFrame: number
  webworker: boolean
  timeSeries: TimeSeries
  constructor (camera: Map, webworker: boolean, timeSeries: TimeSeries) {
    super()
    this.camera = camera
    this.webworker = webworker
    this.timeSeries = timeSeries
  }

  addSource (sourceName: string, interval: number) {
    const step = interval / 4
    this.sources[sourceName] = { interval, step }
    // grab timeseries variables
    const { startTime, autoPlay, state } = this.timeSeries
    // source data is always added at the beginning of the animation. The first source added triggers the animation
    if (autoPlay && state === 'stop') this.timeSeries.state = 'play'
    // build a request for the first frame
    const sourceTime = startTime - (startTime % interval)
    this._requestTiles(sourceTime, sourceName, sourceName)
  }
  
  addSourceData (id: BigInt, time: number, sourceName: string, source: VectorTileSource | RasterTileSource) {
    this.set(`${id}#${time}#${sourceName}`, source)
  }

  getTextures (id: BigInt, sourceName: string) {
    const shortName = sourceName.split(':')[0]
    const { cursor, endTime } = this.timeSeries
    const timeSource = this.sources[shortName]
    if (!timeSource) return {}
    const { step, interval } = timeSource
    // build keys
    const curTime = cursor - (cursor % interval)
    const nextTime = curTime + interval
    // find source data
    const curSource = super.get(`${id}#${curTime}#${sourceName}`)
    const nextSource = super.get(`${id}#${nextTime}#${sourceName}`)
    // if nextSource is not found, request it
    if (!curSource) this._requestTiles(curTime, shortName, sourceName, id)
    if (!nextSource && nextTime <= endTime) this._requestTiles(nextTime, shortName, sourceName, id)
    // grab data (if raster its a texture, if vector its a pointer to buffer)
    // if no source data, return
    const { texture } = curSource || {}
    if (!texture) return {}
    let { texture: textureNext } = nextSource || {}

    // build time. Range of 0->4 : 0->1 red; 1->2 green; 2->3 blue; 3->4 alpha
    // time increments of source interval
    const time = (cursor - curTime) / step
    return { time, texture, textureNext }
  }

  // update layer positions.
  // play state: increment cursor by speed * deltaTime. If cursor >= endTime, set cursor to pause state or startTime.
  // pause state: increment cursor by deltaTime. If cursor > pauseDuration, set state to play
  animate (now: number, render: Function) {
    const { timeSeries } = this
    if (timeSeries.state === 'stop') return
    // if no last frame, set last frame to begin animation and return
    if (!this.lastFrame) this.lastFrame = now
    // find delta
    const delta = (now - this.lastFrame) / 1000 // convert to seconds
    this.lastFrame = now
    // grab time series variables
    const { startTime, endTime, speed, loop } = timeSeries
    // if cursor is exactly endTime, if pauseDuration is set, set to pause, otherwise set to startTime if loop
    if (timeSeries.cursor === endTime) {
      if (loop) timeSeries.cursor = startTime
      else timeSeries.state = 'stop'
    } else {
      // increment cursor
      timeSeries.cursor += delta * speed
      // if cursor is past endTime, set to endTime to finish animation
      if (timeSeries.cursor > endTime) timeSeries.cursor = endTime
    }
    // send off a render
    render()
  }

  // rather than animate, the user can specify a time, and this will update to current time
  setTime (time: number) {
    const { timeSeries } = this
    timeSeries.cursor = time
  }

  _requestTiles (time: number, shortName: string, sourceName: string, id?: BigInt) {
    const { webworker, camera } = this
    const tiles = id ? [camera.getTile(id)] : camera.getTiles()
    if (!tiles || !tiles.length) return
    const tileRequests: Array<TileRequest> = []
    // build tile requests
    for (const tile of tiles) {
      // build time id
      const timeID = `${tile.id}#${time}#${sourceName}`
      // if source data is already in cache, return
      if (super.has(timeID)) continue
      // place a temporary source in the cache
      // this will be replaced by the source data when it arrives
      super.set(timeID, {})
      const { id, face, i, j, zoom, bbox, division, size } = tile
      tileRequests.push({ id, face, i, j, zoom, bbox, division, size, time })
    }
    // get list of current tiles in view
    if (tileRequests.length) {
      if (webworker) { // $FlowIgnore
        postMessage({ mapID: camera.id, type: 'timerequest', tiles: tileRequests, sourceNames: [shortName] })
      } else {
        window.S2WorkerPool.timeRequest(camera.id, tileRequests, [shortName])
      }
    }
  }
}
