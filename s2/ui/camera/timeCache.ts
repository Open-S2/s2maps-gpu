import Cache from './cache'

import type Camera from '.'
import type { SensorSource } from 'gl/contexts/context.spec'
import type { TileRequest } from 'workers/worker.spec'
import type { TileGL, TileGPU } from 'source/tile.spec'
import type { TimeSeriesStyle } from 'style/style.spec'

export interface TimeSource {
  step: number
  interval: number
}

export type TimeLayerState = 'play' | 'pause' | 'stop'

export interface TimeSeries {
  startTime: number
  endTime: number
  speed: number // seconds traveled per second
  pauseDuration: number // in seconds
  autoPlay: boolean
  loop: boolean
  cursor: number
  state: TimeLayerState
}
// play -> animation based upon startTime -> endTime using cursor
// pause -> running through pause duration
// stop -> do nothing

export interface SensorTextureDefinition {
  time?: number
  texture?: WebGLTexture
  textureNext?: WebGLTexture
}

export default class TimeCache extends Cache<string, SensorSource> {
  camera: Camera
  sources: Record<string, TimeSource> = {} // [sourceName]: { interval: number }
  lastFrame?: number
  webworker: boolean
  timeSeries!: TimeSeries
  constructor (camera: Camera, webworker: boolean, timeSeries: TimeSeriesStyle) {
    super()
    this.camera = camera
    this.webworker = webworker
    this.#buildTimeSeries(timeSeries)
  }

  addSource (sourceName: string, interval: number): void {
    const step = interval / 4
    this.sources[sourceName] = { interval, step }
    // grab timeseries variables
    const { startTime, autoPlay, state } = this.timeSeries
    // source data is always added at the beginning of the animation. The first source added triggers the animation
    if (autoPlay && state === 'stop') this.timeSeries.state = 'play'
    // build a request for the first frame
    const sourceTime = startTime - (startTime % interval)
    this.#requestTiles(sourceTime, sourceName, sourceName)
  }

  addSourceData (
    id: bigint, time: number, sourceName: string,
    source: SensorSource
  ): void {
    this.set(`${id}#${time}#${sourceName}`, source)
  }

  getTextures (id: bigint, sourceName: string): SensorTextureDefinition {
    const shortName = sourceName.split(':')[0]
    const { cursor, endTime } = this.timeSeries
    const timeSource = this.sources[shortName]
    if (timeSource === undefined) return {}
    const { step, interval } = timeSource
    // build keys
    const curTime = cursor - (cursor % interval)
    const nextTime = curTime + interval
    // find source data
    const curSource = this.get(`${id}#${curTime}#${sourceName}`)
    const nextSource = this.get(`${id}#${nextTime}#${sourceName}`)
    // if nextSource is not found, request it
    if (curSource === undefined) this.#requestTiles(curTime, shortName, sourceName, id)
    if (nextSource === undefined && nextTime <= endTime) this.#requestTiles(nextTime, shortName, sourceName, id)
    // grab data (if raster its a texture, if vector its a pointer to buffer)
    // if no source data, return
    const { texture } = curSource ?? {}
    if (texture === undefined) return {}
    const { texture: textureNext } = nextSource ?? {}

    // build time. Range of 0->4 : 0->1 red; 1->2 green; 2->3 blue; 3->4 alpha
    // time increments of source interval
    const time = (cursor - curTime) / step
    return { time, texture, textureNext }
  }

  // update layer positions.
  // play state: increment cursor by speed * deltaTime. If cursor >= endTime, set cursor to pause state or startTime.
  // pause state: increment cursor by deltaTime. If cursor > pauseDuration, set state to play
  animate (now: number, render: () => void): void {
    const { timeSeries } = this
    if (timeSeries.state === 'stop') return
    // if no last frame, set last frame to begin animation and return
    if (this.lastFrame === undefined) this.lastFrame = now
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
  setTime (time: number): void {
    const { timeSeries } = this
    timeSeries.cursor = time
  }

  #requestTiles (time: number, shortName: string, sourceName: string, id?: bigint): void {
    const { webworker, camera } = this
    let tiles: Array<TileGL & TileGPU> = []
    if (id !== undefined) {
      const tile = camera.getTile(id)
      if (tile !== undefined) tiles = [tile as any]
      else tiles = []
    } else {
      tiles = camera.getTiles() as any
    }
    const tileRequests: TileRequest[] = []
    // build tile requests
    for (const tile of tiles) {
      // build time id
      const timeID = `${tile.id}#${time}#${sourceName}`
      // if source data is already in cache, return
      if (this.has(timeID)) continue
      // place a temporary source in the cache
      // this will be replaced by the source data when it arrives
      this.set(timeID, {})
      const { id, face, i, j, zoom, bbox, type, division, size } = tile
      tileRequests.push({ id, face, i, j, zoom, bbox, type, division, size, time })
    }
    // get list of current tiles in view
    if (tileRequests.length > 0) {
      if (webworker) {
        postMessage({ mapID: camera.id, type: 'timerequest', tiles: tileRequests, sourceNames: [shortName] })
      } else {
        window.S2WorkerPool.timeRequest(camera.id, tileRequests, [shortName])
      }
    }
  }

  #buildTimeSeries (timeSeries: TimeSeriesStyle): void {
    const {
      startDate,
      endDate,
      speed,
      pauseDuration,
      loop,
      autoPlay
    } = timeSeries
    // setup date to beginning of current day
    const date = new Date()
    date.setHours(0)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)
    // date.set
    const dateNum = date.getTime()
    // tell the map about the time series
    const startTime = parseDate(startDate ?? dateNum)
    this.timeSeries = {
      startTime,
      endTime: parseDate(endDate ?? dateNum + 162000), // 45 hour sequence (basically 2 tiles per face)
      speed: speed ?? 1, // 1 hour per second (0 -> no animation)
      pauseDuration: pauseDuration ?? 0,
      loop: loop ?? false,
      autoPlay: autoPlay ?? false,
      state: 'stop',
      cursor: startTime
    }
  }
}

function parseDate (d: string | number): number {
  const date = new Date(d)
  return date.getTime() / 1000
}
