/* MODULES */
import chroma from 'chroma-js'
import ckmeans from './ckmeans'
import React, { useEffect, useState } from 'react'
/* REACT MODULES */
import Map from '../../../components/map'
import HoverPopup from '../../../components/element/hoverPopup'
/* STYLES */
import styles from '../../../styles/Countries.module.css'
/* JSON */
import topCountries from './topCountries.json'

interface TopCountry {
  queries: number
  topDomains: string[]
  iso2: string
}

// convert topCountry to an array
const tcArray: TopCountry[] = []
for (const [key, value] of Object.entries(topCountries)) tcArray.push({ iso2: key, ...value })
const SECTION_COUNT: number = tcArray.length < 10 ? tcArray.length : tcArray.length > 100 ? 20 : 10
// [{ iso2: 'AF', topDomains: [...], queries }, ...]

// get ckmeans and sort by queries
const mean = ckmeans<TopCountry>(tcArray, SECTION_COUNT, (a: TopCountry, b: TopCountry) => a.queries - b.queries)
// const range = [0, Math.max(...mean[mean.length - 1].map(x => x.queries))]
const filter = ['iso2', 'has', tcArray.map(x => x.iso2)]
const averages = mean.map(cluster => {
  return cluster.reduce((a: number | TopCountry, b: number | TopCountry) => {
    a = (typeof a === 'number') ? a : a.queries
    b = (typeof b === 'number') ? b : b.queries
    return a + b
  }, 0) / cluster.length
})
// ckmeans breaks apart the data into clusters that are close in value to eachother
// the clusters are sorted by lowest queries to highest
// [[{ iso2: 'AF', topDomains: [...], queries }, ...], ...]

// create a logaritmic scale for colors
const limits = chroma.limits(averages, 'l', SECTION_COUNT - 1)
const colorScale = chroma.scale(['#fbf2eb', '#f6821f']).mode('lch').colors(SECTION_COUNT)
// for each average, find the closest number in the limits array and assign the appropriate color
const colorMap: string[] = []
for (let i = 0; i < SECTION_COUNT; i++) {
  const closest = Math.max(...limits.map(x => { return x <= averages[i] ? x : 0 }))
  colorMap.push(colorScale[limits.indexOf(closest)])
}
// map colors to match clusters
// ['#f5f9fb','#d7eefb','#d7eefb','#d7eefb','#d7eefb','#d7eefb','#bbe2fc','#bbe2fc','#83c8ff','#007bfe']

// now build the data conditions
const colorDataCondition: any[] = ['data-condition']
for (let i = 0, ml = mean.length; i < ml; i++) {
  const cluster = mean[i] // [{ iso2, queries }, ...]
  // first push the filter
  colorDataCondition.push(['iso2', 'has', cluster.map(x => x.iso2)])
  // then the corisponding color
  colorDataCondition.push(colorMap[i])
}
colorDataCondition.push('default', '#fbf2eb')
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

const mapStyle = {
  version: 1,
  name: 'countries-example',
  center: [-40, 37.778443127730476],
  zoom: -0.5,
  minzoom: -1,
  maxzoom: 9,
  sources: {
    countries: 's2maps://s2tiles/s2maps/countries4K_CHN.s2tiles',
    bathymetry: 's2maps://s2tiles/s2maps/bathymetry.s2tiles',
    place: 's2maps://s2tiles/s2maps/place.s2tiles'
  },
  fonts: {
    'roboto-medium': 's2maps://glyphs/RobotoMedium',
    'roboto-regular': 's2maps://glyphs/RobotoRegular'
  },
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
      name: 'water-fill',
      source: 'countries',
      layer: 'countries',
      type: 'fill',
      invert: true,
      layout: {},
      paint: {
        color: 'rgb(241, 245, 247)'
      }
    },
    {
      name: 'bath-fill',
      source: 'bathymetry',
      layer: 'bathymetry',
      type: 'fill',
      filter: ['depth', 'has', [1000, 3000, 4000, 5000, 6000, 8000]],
      layout: {},
      paint: {
        color: [
          'data-condition',
          ['depth', '==', 8000],
          'rgb(151, 176, 198)',
          ['depth', '==', 6000],
          'rgb(168,189,206)',
          ['depth', '==', 5000],
          'rgb(185,202,215)',
          ['depth', '==', 4000],
          'rgb(201,214,223)',
          ['depth', '==', 3000],
          'rgb(218,227,232)',
          ['depth', '==', 1000],
          'rgb(230, 237, 237)',
          'default',
          'rgb(241, 245, 247)'
        ],
        opacity: 0.5
      }
    },
    {
      name: 'country-line',
      source: 'countries',
      layer: 'countries',
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
      layer: 'countries',
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
      layer: 'countries',
      type: 'line',
      filter,
      layout: {},
      paint: {
        color: lineDataCondition,
        width: 1.25
      }
    },
    {
      name: 'country_state',
      source: 'place',
      filter: [
        'or',
        ['and', ['class', '==', 'continent'], ['?name', '==', 'Antarctica']],
        ['class', 'has', ['country']]
      ],
      layer: 'place',
      type: 'glyph',
      maxzoom: 12,
      layout: {
        'text-family': 'roboto-medium',
        'text-field': [
          'data-condition',
          ['class', '==', 'continent'],
          '?!P!Uname_en',
          'default',
          '?!Pname_en'
        ],
        'text-anchor': 'center',
        'text-line-height': 0.02,
        'text-offset': [0, 0],
        'text-padding': [4, 2]
      },
      paint: {
        'text-size': [
          'data-condition',
          ['class', '==', 'country'],
          [
            'input-range',
            'zoom',
            'expo',
            1.5,
            0,
            14,
            4,
            28
          ],
          'default',
          15.3
        ],
        'text-fill': [
          'data-condition',
          ['class', '==', 'country'],
          'rgb(80, 80, 80)',
          ['class', '==', 'continent'],
          'rgb(100, 100, 100)',
          'default',
          'rgba(0, 0, 0, 0)'
        ],
        'text-stroke': 'rgba(255, 255, 255, 0.65)',
        'text-stroke-width': [
          'data-condition',
          ['class', '==', 'continent'],
          0.5,
          'default',
          0
        ]
      }
    }
  ]
}

interface Feature {
  iso2?: string
  city: string
  country: string
  iata: string
  name?: string
}

export default function Countries (): JSX.Element {
  const [feature, setFeature] = useState<Feature>()
  const [language, setLanguage] = useState('en-US')

  useEffect(() => {
    setLanguage(navigator.language)
  }, [])

  const mouseenter = (feature: Feature): void => { setFeature(feature) }
  const mouseleave = (): void => { setFeature(undefined) }
  const topCountry = feature !== undefined && topCountries[feature?.iso2 ?? '']

  return (
    <div className={styles.countries}>
      <Map
        style={mapStyle}
        opts={{ zoomController: false }}
        mouseenter={mouseenter}
        mouseleave={mouseleave}
      >
        <HoverPopup visible={feature !== undefined}>
          <div className={styles.popup}>
            <div className={styles.title}>
              {feature?.iso2 !== undefined && <img className={styles.flag} src={`/images/flags/${feature.iso2.toLowerCase()}.svg`} alt='flag' />}
              <div className={styles.name}>{feature?.name}</div>
            </div>
            <div className={styles.queries}>{topCountry?.queries !== undefined && topCountry.queries.toLocaleString(language)} queries</div>
            {
              topCountry?.topDomains?.length !== 0 && (
                <div>
                  <div className={styles.topDomains}>Top Cities</div>
                  {topCountry?.topDomains?.map((domain: string, i: number) => <div key={i} className={styles.domain}>{domain}</div>)}
                </div>
              )
            }
          </div>
        </HoverPopup>
      </Map>
    </div>
  )
}
