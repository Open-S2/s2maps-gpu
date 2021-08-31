// @flow
import type { Analytics } from '../../style'

// an API key enables the user to construct a session token
// a session token lasts 10 minutes and allows the user to make requests for data

export default class Session {
  analytics: Analytics
  sessionKeys: { [string]: { token: string, apiKey: string, exp: number } } = {} // [mapID]: session
  workers: Array<MessageChannel.port2> = []
  currWorker: number = 0
  totalWorkers: number = 0

  loadStyle (analytics?: Analytics = {}, mapID: string, apiKey: string) {
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

  async getInfo (mapID: string, featureID: number) {
    // grab the auth token
    const Authorization = await this.requestSessionToken(mapID)
    if (!Authorization) return
    // fetch the json
    const json = await fetch(`https://data.s2maps.io/data/info/${featureID}.json`, { headers: { Authorization } })
      .then(res => {
        if (res.status !== 200) return null
        return res.json()
      })
    if (json) postMessage({ mapID, type: 'info', json })
  }

  async requestSessionToken (mapID: string): string {
    const { sessionKeys, analytics } = this
    const mapSessionKey = sessionKeys[mapID]
    // if there is no apiKey, then the map doesn't requre a session token
    if (!mapSessionKey || !mapSessionKey.apiKey) return null
    // check if the token is already fresh
    const { apiKey, token, exp } = mapSessionKey
    if (exp && token && exp - (new Date()).getTime() > 0) return token
    const { gpu, context, language, width, height } = analytics
    // grab a new token
    // const sessionKey = await fetch(`${process.env.REACT_APP_API_URL}/session`, {
    const sessionKey = await fetch('https://api.s2maps.io/session', {
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
    })
    // store the new key, exp, and return the key to use
    if (!sessionKey) return null
    mapSessionKey.token = sessionKey.token
    mapSessionKey.exp = sessionKey.exp

    return mapSessionKey.token
  }
}
