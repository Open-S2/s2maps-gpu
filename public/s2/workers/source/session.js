// @flow
/* eslint-env worker */
import s2mapsURL from '../../util/s2mapsURL'

import type { Analytics } from '../../style'

// an API key enables the user to construct a session token
// a session token lasts 10 minutes and allows the user to make requests for data

type SessionKey = { token: string, apiKey: string, exp: number }

const { NEXT_PUBLIC_API_URL } = process.env

export default class Session {
  analytics: Analytics
  sessionKeys: { [string]: SessionKey } = {} // [mapID]: session
  workers: Array<MessageChannel.port2> = []
  currWorker: number = 0
  totalWorkers: number = 0
  sessionPromise: Promise<SessionKey> = null

  loadStyle (analytics?: Analytics = {}, mapID: string, apiKey: string) {
    if (this.sessionKeys[mapID]) return
    this.analytics = analytics
    this.sessionKeys[mapID] = { apiKey }
  }

  loadWorker (messagePort: MessageChannel.port1, postPort: MessageChannel.port2, id: number) {
    this.totalWorkers++
    this.workers[id] = postPort
  }

  requestWorker () {
    const worker = this.workers[this.currWorker]
    this.currWorker++
    if (this.currWorker >= this.totalWorkers) this.currWorker = 0

    return worker
  }

  async requestStyle (mapID: string, style: string) {
    // grab the auth token
    const Authorization = await this.requestSessionToken(mapID)
    if (!Authorization) return
    // fetch the style
    const json = fetch(s2mapsURL(style), { headers: { Authorization } })
      .then(res => {
        if (res.status !== 200) return null
        return res.json()
      }).catch(err => { console.error(err); return null })
    // send style back to map
    if (json) postMessage({ type: 'setStyle', mapID, style: json, ignorePosition: false })
  }

  async getInfo (mapID: string, featureID: number) {
    // grab the auth token
    const Authorization = await this.requestSessionToken(mapID)
    if (!Authorization) return
    // fetch the json
    const json = await fetch(`${NEXT_PUBLIC_API_URL}/info/${featureID}.json`, { headers: { Authorization } })
      .then(res => {
        if (res.status !== 200) return null
        return res.json()
      }).catch(err => { console.error(err); return null })
      // send json back to map
    if (json) postMessage({ mapID, type: 'info', json })
  }

  async requestSessionToken (mapID: string): string {
    const mapSessionKey = this.sessionKeys[mapID]
    // if there is no apiKey, then the map doesn't requre a session token
    if (!mapSessionKey || !mapSessionKey.apiKey) return null
    // check if the token is already fresh
    const { apiKey, token, exp } = mapSessionKey
    if (exp && token && exp - (new Date()).getTime() > 0) return token
    const { gpu, context, language, width, height } = this.analytics
    // grab a new token
    if (!this.sessionPromise) {
      this.sessionPromise = fetch(`${NEXT_PUBLIC_API_URL}/session`, {
        method: 'POST',
        body: JSON.stringify({ apiKey, gpu, context, language, width, height }),
        headers: { 'Content-Type': 'application/json' }
      }).then(res => {
        if (res.status !== 200 && res.status !== 206) return null
        return res.json()
      }).then(t => {
        const expDate = new Date()
        expDate.setSeconds(expDate.getSeconds() + t.maxAge)
        if (t.token) return { token: t.token, exp: expDate.getTime() }
        return null
      }).catch(err => { console.error(err); return null })
    }
    const sessionKey = await this.sessionPromise
    this.sessionPromise = null
    // store the new key, exp, and return the key to use
    if (!sessionKey) return null
    mapSessionKey.token = sessionKey.token
    mapSessionKey.exp = sessionKey.exp

    return mapSessionKey.token
  }
}
