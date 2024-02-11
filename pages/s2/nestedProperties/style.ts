import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Hilbert',
  center: [0, 0],
  zoom: -0.5,
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    hilbert: {
      type: 'json',
      data: {
        type: 'S2FeatureCollection',
        faces: [0],
        features: [
          {
            type: 'S2Feature',
            properties: {
              class: 'hilbert',
              level: 4,
              levels: [0, 1, 2, 3]
            },
            face: 0,
            geometry: {
              type: 'Point',
              face: 0,
              coordinates: [0.5, 0.5]
            }
          }
        ]
      }
    }
  },
  fonts: {},
  layers: [
    {
      name: 'hilbert_point',
      source: 'hilbert',
      // filter: {
      //   key: {
      //     nestedKey: 'subClass',
      //     key: {
      //       nestedKey: 'subSubClass',
      //       key: 'type'
      //     }
      //   },
      //   comparator: '==',
      //   value: 'hil'
      // },
      type: 'point',
      color: '#475569',
      radius: {
        inputValue: {
          key: {
            nestedKey: 'subClass',
            key: {
              nestedKey: 'subSubClass',
              key: 'radius'
            }
          },
          fallback: 5
        }
      }
    }
  ]
}

export default style
