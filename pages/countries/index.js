/* MODULES */
import { useEffect, useState } from 'react'
import ckmeans from './ckmeans'
import chroma from 'chroma-js'
/* REACT MODULES */
import Map from '../../components/map'
import HoverPopup from '../../components/element/hoverPopup'
/* STYLES */
import styles from '../../styles/Countries.module.css'
/* JSON */
import topCountries from './topCountries.json'

// convert topCountries to an array
const tcArray = []
for (const [key, value] of Object.entries(topCountries)) tcArray.push({ iso2: key, ...value })
const SECTION_COUNT = tcArray.length < 10 ? tcArray : tcArray > 100 ? 20 : 10
// [{ iso2: 'AF', topDomains: [...], queries }, ...]

// get ckmeans and sort by queries
const mean = ckmeans(tcArray, SECTION_COUNT, (a, b) => a.queries - b.queries)
const range = [0, Math.max(...mean[mean.length - 1].map(x => x.queries))]
const filter = ['iso2', 'has', tcArray.map(x => x.iso2)]
const averages = mean.map(cluster => {
  return cluster.reduce((a, b) => a + b.queries, 0) / cluster.length
})
// ckmeans breaks apart the data into clusters that are close in value to eachother
// the clusters are sorted by lowest queries to highest
// [[{ iso2: 'AF', topDomains: [...], queries }, ...], ...]

// create a logaritmic scale for colors
let limits = chroma.limits(averages, 'l', SECTION_COUNT - 1)
const colorScale = chroma.scale(['#fbf2eb','#f6821f']).mode('lch').colors(SECTION_COUNT)
// for each average, find the closest number in the limits array and assign the appropriate color
const colorMap = []
for (let i = 0; i < SECTION_COUNT; i++) {
  const closest = Math.max(...limits.map(x => { return x <= averages[i] ? x : 0 }))
  colorMap.push(colorScale[limits.indexOf(closest)])
}
// map colors to match clusters
// ['#f5f9fb','#d7eefb','#d7eefb','#d7eefb','#d7eefb','#d7eefb','#bbe2fc','#bbe2fc','#83c8ff','#007bfe']

// now build the data conditions
const colorDataCondition = ['data-condition']
for (let i = 0, ml = mean.length; i < ml; i++) {
  const cluster = mean[i] // [{ iso2, queries }, ...]
  // first push the filter
  colorDataCondition.push(['iso2', 'has', cluster.map(x => x.iso2)])
  // then the corisponding color
  colorDataCondition.push(colorMap[i])
}
// ['data-condition', ['iso2', 'has', ['AF', 'AL', ...]], '#f5f9fb', ...]

// not necessary, but aesthetically nicer
// reuse the color map for lines, but use default lines for light colors
const neutral = '#bbd3de'
const lineDataCondition = colorDataCondition.map(color => {
  if (typeof color === 'string' && color.startsWith('#')) {
    const distance = chroma.distance('#fff', color) - chroma.distance('#fff', neutral)
    color = distance > 0 ? color : neutral
  }
  return color
})
// ['data-condition', ['iso2', 'has', ['AF', 'AL', ...]], '#f5f9fb', ...]

const style = {
  version: 1,
  name: 'countries-example',
  center: [-40, 37.778443127730476],
  zoom: -0.5,
  minzoom: -1,
  maxzoom: 5,
  sources: { countries: 'http://localhost:8000/s2json/countriesHD.s2json' },
  fonts: {},
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      layout: {},
      paint: {
        color: '#fff'
      }
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      layout: {},
      paint: {
        color: '#f5f9fb'
      }
    },
    {
      name: 'country-line',
      source: 'countries',
      filter: ['type', '!=', 'river'],
      type: 'line',
      layout: {},
      paint: {
        color: '#bbd3de',
        width: 1.25
      }
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      filter,
      interactive: true,
      cursor: 'pointer',
      layout: {},
      paint: {
        color: colorDataCondition
      }
    },
    {
      name: 'country-fill-active',
      source: 'countries',
      type: 'line',
      filter,
      layout: {},
      paint: {
        color: lineDataCondition,
        width: 1.25
      }
    }
  ]
}

export default function Countries () {
  const [feature, setFeature] = useState(null)
  const [language, setLanguage] = useState('en-US')

  useEffect(() => {
    // set user language for number formatting
    const userLanguage = navigator.language || navigator.userLanguage
    if (userLanguage) setLanguage(userLanguage)
  }, [])

  const mouseenter = (feature) => { setFeature(feature) }
  const mouseleave = () => { setFeature(null) }

  const topCountry = feature && topCountries[feature.iso2]

  return (
    <div>
      <div>
        <Map
          style={style}
          opts={{ zoomController: false }}
          mouseenter={mouseenter}
          mouseleave={mouseleave}
          noAPIKey
        />
        <HoverPopup visible={feature !== null}>
          <div className={styles.popup}>
            <div className={styles.title}>
              {feature && feature.iso2 && <img className={styles.flag} src={`/images/flags/${feature.iso2.toLowerCase()}.svg`} alt='flag' />}
              <div className={styles.name}>{feature && feature.name}</div>
            </div>
            <div className={styles.queries}>{topCountry && topCountry.queries.toLocaleString(language)} queries</div>
            {topCountry && topCountry.topDomains.length && <div>
              <div className={styles.topDomains}>Top Cities</div>
              {topCountry.topDomains.map((domain, i) => <div key={i} className={styles.domain}>{domain}</div>)}
            </div>}
            
          </div>
        </HoverPopup>
      </div>
    </div>
  )
}
