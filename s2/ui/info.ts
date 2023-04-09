/* eslint-env browser */
import type S2Map from 's2/s2Map'
import type { InteractiveObject } from 's2/workers/worker.spec'

export interface InfoDetails {
  extract?: string
  wikiLink?: string
  inception?: Date
  externalData?: string
  motto?: string
  officialLanguage?: string
}

export interface InfoData {
  id: number
  name: string
  details: InfoDetails
}

interface InfoElement extends HTMLElement {
  _skel?: HTMLDivElement
  _bod?: HTMLDivElement
  infoID?: number
}

export type InfoState = 'null' | 'info' | 'markers'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default class Info {
  state: InfoState = 'null'
  s2map: S2Map
  mapContainer: HTMLElement
  #infoCard: null | InfoElement = null
  #markerCard: null | HTMLElement = null
  layers: string[]
  constructor (s2map: S2Map, mapContainer: HTMLElement, layers: string[]) {
    // store the map and it's container to add and remove info card.
    // layers define the clickable objects we interested in
    this.s2map = s2map
    this.mapContainer = mapContainer
    this.layers = layers
  }

  _clear (): void {
    const { state, s2map } = this
    s2map.deleteSource(`_${state}`)
    this.state = 'null'
    if (this.#infoCard !== null) {
      this.#infoCard.remove()
      this.#infoCard = null
    }
    if (this.#markerCard !== null) {
      this.#markerCard.remove()
      this.#markerCard = null
    }
  }

  click (feature: null | InteractiveObject, lon: number, lat: number): void {
    const { s2map, layers } = this
    if (feature === null) {
      if (this.state !== 'null') {
        this._clear()
      } else if (lon !== null && lat !== null) { // create a marker
        this.state = 'markers'
        s2map.addMarker({ lon, lat })
        this.#createMarkerCard(lon, lat)
      }
    } else if (layers.includes(feature.__name)) {
      this.state = 'info'
      // let the map know we want info
      s2map.getInfo(feature.__id)
      // cleanup old or create new;
      if (this.#infoCard !== null) {
        if (this.#infoCard._skel !== undefined) this.#infoCard._skel.remove()
        if (this.#infoCard._bod !== undefined) this.#infoCard._bod.remove()
      } else { this.#infoCard = window.document.createElement('div') }
      // build a card
      const card = this.#infoCard
      card.infoID = feature.__id
      card.id = 's2-card'
      // inject skeleton html
      this.#injectInfoSkeleton(card)
      // push to DOM
      this.mapContainer.appendChild(card)
    }
  }

  injectInfo (data: InfoData): void {
    const { state } = this
    const infoCard = this.#infoCard
    if (infoCard !== null && infoCard.infoID === data.id && state === 'info') {
      // create card with details
      this.#injectInfo(infoCard, data)
    }
  }

  #createMarkerCard (lon: number, lat: number): void {
    const card = this.#markerCard = window.document.createElement('div')
    card.id = 's2-mini-card'
    card.innerHTML = `<div id="s2-mini-card-body">${lon.toFixed(8)}, ${lat.toFixed(8)}</div>`
    this.mapContainer.appendChild(card)
  }

  #injectInfoSkeleton (card: InfoElement): void {
    // build close
    const close = window.document.createElement('div')
    close.id = 's2-card-close-container'
    close.innerHTML = '<div id="s2-card-close"></div>'
    close.onclick = () => { card.remove(); this._clear() }
    card.appendChild(close)
    // build skeleton
    const skeleton = window.document.createElement('div')
    skeleton.id = 's2-skeleton'
    skeleton.innerHTML = '<div class="s2-skel-container"><div class="s2-skel-header"></div></div><div class="s2-skel-container"><div class="s2-skel-line s2-skel-line-1"></div><div class="s2-skel-line s2-skel-line-2"></div><div class="s2-skel-line s2-skel-line-3"></div></div>'
    card.appendChild(skeleton)
    card._skel = skeleton
  }

  #injectInfo (card: InfoElement, info: InfoData): void {
    // first remove the skeleton structure
    if (card._skel !== undefined) card._skel.remove()
    // create card body
    const body = window.document.createElement('div')
    body.id = 's2-card-body'
    let html = ''
    const { name, details } = info
    let { extract, wikiLink, inception, externalData, motto, officialLanguage } = details
    // prep variables
    if (wikiLink !== undefined) wikiLink = `<a target="popup" href="${wikiLink}">Wikipedia</a>`
    if (externalData !== undefined) externalData = `<a target="popup" href="${externalData}">${externalData}</a>`
    if (inception !== undefined) inception = new Date(inception)
    if (officialLanguage !== undefined) officialLanguage = officialLanguage[0]
    // title + start card-details
    html += `<div class="s2-card-item s2-card-item-title">${name}</div><div class='s2-card-details'>`
    // extract
    if (extract !== undefined) html += `<div class="s2-card-item"><div>${extract}${wikiLink ?? ''}</div></div>`
    // inception
    if (inception !== undefined) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">Inception: </div><div class="s2-card-item-value">${MONTH_NAMES[inception.getMonth()]} ${Math.max(inception.getDay(), 1)}, ${inception.getFullYear()}</div></div>`
    // motto
    if (motto !== undefined) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">Motto: </div><div class="s2-card-item-value">${motto}</div></div>`
    // officialLanguage
    if (officialLanguage !== undefined) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">officialLanguage: </div><div class="s2-card-item-value">${officialLanguage}</div></div>`
    // externalData
    if (externalData !== undefined) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">Website: </div><div class="s2-card-item-value">${externalData}</div></div>`
    // append card-details
    html += '</div>'
    // inject html and add to DOM
    body.innerHTML = html
    card._bod = body
    card.appendChild(body)
  }
}
