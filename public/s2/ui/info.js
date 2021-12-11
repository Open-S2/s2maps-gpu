// @flow
/* eslint-env browser */
import type { S2Map } from '../'

export type InfoData = {

}

export type InfoMarker = {

}

export type InfoState = 'null' | 'info' | 'markers'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default class Info {
  state: InfoState = 'null'
  marker: InfoMarker
  s2map: S2Map
  mapContainer: HTMLElement
  _infoCard: null | HTMLElement
  _markerCard: null | HTMLElement
  layers: Array<string>
  constructor (s2map: S2Map, mapContainer: HTMLElement, layers: Array<string>) {
    // store the map and it's container to add and remove info card.
    // layers define the clickable objects we interested in
    this.s2map = s2map
    this.mapContainer = mapContainer
    this.layers = layers
  }

  _clear () {
    const { state, s2map } = this
    s2map.deleteSource(`_${state}`)
    this.state = 'null'
    if (this._infoCard) {
      this._infoCard.remove()
      this._infoCard = null
    }
    if (this._markerCard) {
      this._markerCard.remove()
      this._markerCard = null
    }
  }

  click (feature, lon: number, lat: number) {
    const { s2map, layers } = this
    if (!feature) {
      if (this.state !== 'null') {
        this._clear()
      } else if (lon !== null && lat !== null) { // create a marker
        this.state = 'markers'
        s2map.addMarker({ lon, lat })
        this._createMarkerCard(lon, lat)
      }
    } else if (layers.includes(feature.__name)) {
      this.state = 'info'
      // let the map know we want info
      s2map.getInfo(feature.id)
      // cleanup old or create new;
      if (this._infoCard) {
        if (this._infoCard.skel) this._infoCard.skel.remove()
        if (this._infoCard._bod) this._infoCard._bod.remove()
      } else { this._infoCard = window.document.createElement('div') }
      // build a card
      const card = this._infoCard
      card.infoID = feature.id
      card.id = 's2-card'
      // inject skeleton html
      this._injectInfoSkeleton(card)
      // push to DOM
      this.mapContainer.appendChild(card)
    }
  }

  injectInfo (data: InfoData) {
    const { _infoCard, state } = this
    if (data && _infoCard && _infoCard.infoID === data.id && state === 'info') {
      // create card with details
      this._injectInfo(_infoCard, data)
    }
  }

  _createMarkerCard (lon: number, lat: number) {
    const card = this._markerCard = window.document.createElement('div')
    card.id = 's2-mini-card'
    card.innerHTML = `<div id="s2-mini-card-body">${lon.toFixed(8)}, ${lat.toFixed(8)}</div>`
    this.mapContainer.appendChild(card)
  }

  _injectInfoSkeleton (card: HTMLElement) {
    const self = this
    // build close
    const close = window.document.createElement('div')
    close.id = 's2-card-close-container'
    close.innerHTML = '<div id="s2-card-close"></div>'
    close.onclick = function () { card.remove(); self._clear() }
    card.appendChild(close)
    // build skeleton
    const skeleton = window.document.createElement('div')
    skeleton.id = 's2-skeleton'
    skeleton.innerHTML = '<div class="s2-skel-container"><div class="s2-skel-header"></div></div><div class="s2-skel-container"><div class="s2-skel-line s2-skel-line-1"></div><div class="s2-skel-line s2-skel-line-2"></div><div class="s2-skel-line s2-skel-line-3"></div></div>'
    card.appendChild(skeleton)
    card.skel = skeleton
  }

  _injectInfo (card: HTMLElement, info: InfoData) {
    // first remove the skeleton structure
    if (card.skel) card.skel.remove()
    // create card body
    const body = window.document.createElement('div')
    body.id = 's2-card-body'
    let html = ''
    const { name, details } = info
    let { extract, wikiLink, inception, externalData, motto, officialLanguage } = details
    // prep variables
    if (wikiLink) wikiLink = `<a target="popup" href="${wikiLink}">Wikipedia</a>`
    if (externalData) externalData = `<a target="popup" href="${externalData}">${externalData}</a>`
    if (inception) inception = new Date(inception)
    if (officialLanguage) officialLanguage = officialLanguage[0]
    // title + start card-details
    html += `<div class="s2-card-item s2-card-item-title">${name}</div><div class='s2-card-details'>`
    // extract
    if (extract) html += `<div class="s2-card-item"><div>${extract}${wikiLink}</div></div>`
    // inception
    if (inception) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">Inception: </div><div class="s2-card-item-value">${MONTH_NAMES[inception.getMonth()]} ${Math.max(inception.getDay(), 1)}, ${inception.getFullYear()}</div></div>`
    // motto
    if (motto) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">Motto: </div><div class="s2-card-item-value">${motto}</div></div>`
    // officialLanguage
    if (officialLanguage) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">officialLanguage: </div><div class="s2-card-item-value">${officialLanguage}</div></div>`
    // externalData
    if (externalData) html += `<div class="s2-card-item s2-card-item-flex"><div class="s2-card-item-key">Website: </div><div class="s2-card-item-value">${externalData}</div></div>`
    // append card-details
    html += '</div>'
    // inject html and add to DOM
    body.innerHTML = html
    card._bod = body
    card.appendChild(body)
  }
}
