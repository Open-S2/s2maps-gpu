import type { StyleDefinition } from 's2'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Streets Example',
  experimental: true,
  view: {
    lon: -111.88683599228256,
    lat: 40.76645913667518,
    zoom: 0
  },
  minzoom: -0.5,
  maxzoom: 18.99,
  sources: {
    streets: 'apiURL://s2tiles/s2maps/streets-v1.s2tiles',
    terrain: 'apiURL://s2tiles/s2maps/terrain-v1.s2tiles'
  },
  fonts: {
    robotoRegular: 'apiURL://glyphs-v2/RobotoRegular',
    robotoMedium: 'apiURL://glyphs-v2/RobotoMedium',
    notoRegular: 'apiURL://glyphs-v2/NotoRegular',
    notoMedium: 'apiURL://glyphs-v2/NotoMedium'
  },
  wallpaper: {
    background: '#030a2d',
    fade1: 'rgb(138, 204, 255)',
    fade2: 'rgb(217, 255, 255)',
    halo: 'rgb(230, 255, 255)'
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      opaque: true,
      source: 'mask',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.7,
          ranges: [
            { stop: 2.75, input: '#f9f7e7' },
            { stop: 3, input: '#f5f5f5' },
            { stop: 6.5, input: '#f0e9d7' },
            { stop: 9, input: '#f0e9d7' },
            { stop: 13, input: '#e8e8e8' },
            { stop: 14, input: '#f8f9fa' }
          ]
        }
      }
    },
    {
      name: 'landcover',
      source: 'terrain',
      layer: 'landcover',
      type: 'fill',
      minzoom: 0,
      maxzoom: 5,
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: '==', value: 'snow' },
              input: '#ffffff'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'wood' },
              input: '#93d2a5'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'tree' },
              input: '#a8dab5'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'crop' },
              input: '#bbe2c6'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'shrub' },
              input: '#f1e9d7'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'wasteland' },
              input: '#e8e8e1'
            }
          ],
          fallback: '#93d2a5'
        }
      },
      opacity: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.75,
          ranges: [
            { stop: 4.5, input: 1 },
            { stop: 5, input: 0 }
          ]
        }
      }
    },
    {
      name: 'landuse',
      source: 'streets',
      layer: 'landuse',
      type: 'fill',
      opaque: true,
      filter: {
        or: [
          { key: 'class', comparator: '==', value: 'aeroway' },
          {
            key: 'type',
            comparator: 'has',
            value: [
              'park', 'national_park', 'protected_area', 'grass', 'grassland',
              'garden', 'meadow', 'farmland', 'heath', 'swamp', 'wetland', 'zoo', 'cemetery',
              'sand', 'beach', 'desert', 'hospital', 'school', 'parking', 'glacier',
              'quarry', 'retail', 'urban', 'pitch'
            ]
          }
        ]
      },
      minzoom: 4,
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: '==', value: 'parking' },
              input: 'rgb(241, 243, 244)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'wetland' },
              input: 'rgb(210, 233, 255)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'quarry' },
              input: 'rgb(206, 208, 211)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'glacier' },
              input: 'rgb(249, 249, 249)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'beach' },
              input: 'rgb(255, 239, 195)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'cemetery' },
              input: 'rgb(208, 236, 208)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'pitch' },
              input: '#9dd2ac'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['grass', 'grassland', 'garden', 'meadow', 'swamp', 'zoo'] },
              input: '#a8dab5'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['park', 'national_park', 'protected_area'] },
              input: '#aee0bc'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['apron', 'airstrip'] },
              input: '#d4d8ea'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'aeroway' },
              input: 'rgb(219, 222, 235)'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['farmland', 'heath'] },
              input: 'rgb(228, 234, 210)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'hospital' },
              input: 'rgb(252, 228, 228)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'school' },
              input: 'rgb(226, 233, 238)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'retail' },
              input: 'rgb(254, 245, 220)'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['desert', 'sand'] },
              input: 'rgb(241, 233, 195)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'urban' },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 13,
                      input: '#e9eaed'
                    },
                    {
                      stop: 14,
                      input: '#f8f9fa'
                    }
                  ]
                }
              }
            }
          ],
          fallback: 'rgba(0, 0, 0, 0)'
        }
      }
    },
    {
      name: 'landuse_transparent',
      source: 'streets',
      layer: 'landuse',
      type: 'fill',
      filter: {
        key: 'type',
        comparator: 'has',
        value: ['aboriginal_lands', 'military']
      },
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: '==', value: 'aboriginal_lands' },
              input: 'rgba(240, 242, 240, 0.5)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'military' },
              input: 'rgba(226, 226, 224, 0.5)'
            }
          ],
          fallback: 'rgba(0, 0, 0, 0)'
        }
      },
      opacity: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.5,
          ranges: [
            {
              stop: 9,
              input: 1
            },
            {
              stop: 10,
              input: 0
            }
          ]
        }
      }
    },
    {
      name: 'golf',
      source: 'streets',
      layer: 'landuse',
      type: 'fill',
      opaque: true,
      filter: {
        and: [
          { key: 'class', comparator: '==', value: 'golf' },
          {
            key: 'type',
            comparator: 'has',
            value: ['course', 'rough', 'fairway', 'green', 'bunker']
          }
        ]
      },
      minzoom: 0,
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: '==', value: 'bunker' },
              input: 'rgb(255, 239, 195)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'green' },
              input: 'rgb(233, 251, 217)'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'fairway' },
              input: 'rgb(218, 245, 205)'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['course', 'rough'] },
              input: 'rgb(201, 238, 201)'
            }
          ],
          fallback: 'rgba(0, 0, 0, 0)'
        }
      }
    },
    {
      name: 'water',
      source: 'streets',
      filter: {
        key: 'class',
        comparator: '!has',
        value: ['bay', 'reef', 'shoal']
      },
      layer: 'water',
      type: 'fill',
      opaque: true,
      minzoom: 0,
      color: '#86bff2'
    },
    {
      name: 'reef_shoal',
      source: 'streets',
      filter: {
        key: 'class',
        comparator: 'has',
        value: ['reef', 'shoal']
      },
      layer: 'water',
      type: 'fill',
      opaque: true,
      minzoom: 0,
      color: 'rgb(185, 225, 255)'
    },
    {
      name: 'hillshade',
      source: 'terrain',
      layer: 'hillshade',
      type: 'fill',
      minzoom: 0,
      maxzoom: 10,
      color: {
        dataCondition: {
          conditions: [
            {
              filter: {
                and: [
                  { key: 'class', comparator: '==', value: 'shade' },
                  { key: 'level', comparator: '==', value: 3 }
                ]
              },
              input: 'rgba(31, 81, 56, 0.25)'
            },
            {
              filter: {
                and: [
                  { key: 'class', comparator: '==', value: 'shade' },
                  { key: 'level', comparator: '==', value: 2 }
                ]
              },
              input: 'rgba(31, 81, 56, 0.2)'
            },
            {
              filter: {
                and: [
                  { key: 'class', comparator: '==', value: 'shade' },
                  { key: 'level', comparator: '==', value: 1 }
                ]
              },
              input: 'rgba(31, 81, 56, 0.15)'
            },
            {
              filter: {
                and: [
                  { key: 'class', comparator: '==', value: 'shade' },
                  { key: 'level', comparator: '==', value: 0 }
                ]
              },
              input: 'rgba(31, 81, 56, 0.1)'
            },
            {
              filter: {
                and: [
                  { key: 'class', comparator: '==', value: 'highlight' },
                  { key: 'level', comparator: '==', value: 1 }
                ]
              },
              input: 'rgba(255, 254, 250, 0.4)'
            },
            {
              filter: {
                and: [
                  { key: 'class', comparator: '==', value: 'highlight' },
                  { key: 'level', comparator: '==', value: 0 }
                ]
              },
              input: 'rgba(255, 254, 250, 0.2)'
            }
          ],
          fallback: 'rgba(0, 0, 0, 0)'
        }
      },
      opacity: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.75,
          ranges: [
            {
              stop: 10.5,
              input: 1
            },
            {
              stop: 11,
              input: 0
            }
          ]
        }
      }
    },
    {
      name: 'parcel-lines',
      source: 'streets',
      layer: 'parcel',
      type: 'line',
      minzoom: 15,
      cap: 'butt',
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.5,
          ranges: [
            {
              stop: 15,
              input: 'rgba(219, 222, 227, 0)'
            },
            {
              stop: 16,
              input: '#dbdee3'
            }
          ]
        }
      }
    },
    {
      name: 'water_lines',
      source: 'streets',
      layer: 'water',
      geoFilter: ['line'],
      minzoom: 10,
      filter: {
        key: 'class',
        comparator: 'has',
        value: ['river', 'riverbank', 'stream', 'canal', 'drain', 'ditch']
      },
      type: 'line',
      cap: 'butt',
      join: 'bevel',
      color: '#86bff2',
      width: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.5,
          ranges: [
            {
              stop: 9,
              input: 1
            },
            {
              stop: 12,
              input: 2.5
            }
          ]
        }
      }
    },
    {
      name: 'aboriginal_border',
      source: 'streets',
      layer: 'landuse',
      filter: {
        key: 'type',
        comparator: '==',
        value: 'aboriginal_lands'
      },
      minzoom: 3,
      type: 'line',
      join: 'bevel',
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 12,
              input: 'round'
            }
          ]
        }
      },
      color: 'rgb(198, 212, 205)',
      width: 1.5
    },
    {
      name: 'motor_trunk_borders_tunnel',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'tunnel', comparator: '==', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 2,
      cap: 'round',
      join: 'bevel',
      color: '#afafaf',
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    {
                      stop: 2,
                      input: 1.33
                    },
                    {
                      stop: 7,
                      input: 1.66
                    },
                    {
                      stop: 10,
                      input: 2.66
                    },
                    {
                      stop: 13,
                      input: 8.66
                    },
                    {
                      stop: 18,
                      input: 40
                    }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                {
                  stop: 2,
                  input: 2
                },
                {
                  stop: 7,
                  input: 2.5
                },
                {
                  stop: 10,
                  input: 4
                },
                {
                  stop: 13,
                  input: 13
                },
                {
                  stop: 18,
                  input: 60
                }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_tunnel',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'tunnel', comparator: '==', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 4,
      cap: 'round',
      join: 'bevel',
      color: '#e3e3e3',
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    {
                      stop: 2,
                      input: 0.66
                    },
                    {
                      stop: 7,
                      input: 0.833
                    },
                    {
                      stop: 10,
                      input: 1
                    },
                    {
                      stop: 13,
                      input: 6.66
                    },
                    {
                      stop: 18,
                      input: 36.75
                    }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                {
                  stop: 2,
                  input: 1
                },
                {
                  stop: 7,
                  input: 1.25
                },
                {
                  stop: 10,
                  input: 1.5
                },
                {
                  stop: 13,
                  input: 10
                },
                {
                  stop: 18,
                  input: 56
                }
              ]
            }
          }
        }
      }
    },
    {
      name: 'transport_borders',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['unclassified', 'tertiary', 'tertiary_link', 'street', 'street_limited', 'residential', 'pedestrian', 'road']
          }
        ]
      },
      type: 'line',
      minzoom: 7,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 12,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: 'rgb(218, 220, 224)',
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['tertiary', 'tertiary_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 7,
                      input: 1
                    },
                    {
                      stop: 12,
                      input: 7
                    },
                    {
                      stop: 15,
                      input: 19
                    },
                    {
                      stop: 18,
                      input: 40
                    }
                  ]
                }
              }
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['road', 'street', 'street_limited', 'residential'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 10,
                      input: 1
                    },
                    {
                      stop: 13,
                      input: 5.5
                    },
                    {
                      stop: 15,
                      input: 14
                    },
                    {
                      stop: 18,
                      input: 36
                    }
                  ]
                }
              }
            }
          ],
          fallback: 3.5
        }
      }
    },
    {
      name: 'transport_primary_secondary_borders',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['primary', 'primary_link', 'secondary', 'secondary_link']
          }
        ]
      },
      type: 'line',
      minzoom: 5,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 11,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'tunnel', comparator: '==', value: true },
              input: '#afafaf'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['primary', 'primary_link'] },
              input: '#f9ca4a'
            }
          ],
          fallback: '#dadce0'
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['primary', 'primary_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    {
                      stop: 2,
                      input: 2
                    },
                    {
                      stop: 7,
                      input: 2.5
                    },
                    {
                      stop: 10,
                      input: 4
                    },
                    {
                      stop: 13,
                      input: 13
                    },
                    {
                      stop: 18,
                      input: 60
                    }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                {
                  stop: 2,
                  input: 2
                },
                {
                  stop: 7,
                  input: 2.5
                },
                {
                  stop: 10,
                  input: 4
                },
                {
                  stop: 13,
                  input: 13
                },
                {
                  stop: 18,
                  input: 32.75
                }
              ]
            }
          }
        }
      }
    },
    {
      name: 'transport_aeroway',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'class', comparator: '==', value: 'aeroway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['taxiway', 'runway']
          }
        ]
      },
      type: 'line',
      minzoom: 9,
      cap: 'butt',
      join: 'bevel',
      color: '#c7cadc',
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: '==', value: 'runway' },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 9,
                      input: 2
                    },
                    {
                      stop: 12,
                      input: 18
                    }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.7,
              ranges: [
                {
                  stop: 9,
                  input: 1.5
                },
                {
                  stop: 13,
                  input: 4.5
                }
              ]
            }
          }
        }
      }
    },
    {
      name: 'transport_piste_aerialway',
      source: 'streets',
      layer: 'transport',
      filter: {
        or: [
          { key: 'class', comparator: '==', value: 'piste' },
          { key: 'class', comparator: '==', value: 'aerialway' }
        ]
      },
      type: 'line',
      minzoom: 9,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 12,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'piste:difficulty', comparator: 'has', value: ['novice', 'easy'] },
              input: '#67b346'
            },
            {
              filter: { key: 'piste:difficulty', comparator: '==', value: 'intermediate' },
              input: '#507bee'
            },
            {
              filter: { key: 'piste:difficulty', comparator: '==', value: 'freeride' },
              input: '#ffa500'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'aerialway' },
              input: '#fe0252'
            }
          ],
          fallback: '#585753'
        }
      },
      width: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            {
              stop: 9,
              input: 1
            },
            {
              stop: 12,
              input: 2
            }
          ]
        }
      }
    },
    {
      name: 'transport_low_zoom',
      source: 'streets',
      layer: 'transport',
      filter: {
        or: [
          { key: 'class', comparator: '==', value: 'water' },
          { key: 'class', comparator: '==', value: 'railway' },
          {
            and: [
              { key: 'class', comparator: '==', value: 'man_made' },
              { key: 'type', comparator: '==', value: 'pier' }
            ]
          },
          {
            and: [
              { key: 'class', comparator: '==', value: 'highway' },
              {
                key: 'type',
                comparator: 'has',
                value: ['track', 'tertiary', 'tertiary_link', 'street', 'road', 'service', 'unclassified', 'street_limited', 'residential', 'pedestrian', 'path']
              }
            ]
          }
        ]
      },
      type: 'line',
      minzoom: 7,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 12,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: '==', value: 'water' },
              input: '#6296ce'
            },
            {
              filter: { key: 'type', comparator: '==', value: 'path' },
              input: 'rgb(91, 185, 116)'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['road', 'unclassified'] },
              input: '#f6f3ee'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'railway' },
              input: 'rgb(199, 202, 205)'
            }
          ],
          fallback: 'rgb(255, 255, 255)'
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['tertiary', 'tertiary_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 7,
                      input: 1
                    },
                    {
                      stop: 12,
                      input: 4
                    },
                    {
                      stop: 15,
                      input: 15
                    },
                    {
                      stop: 18,
                      input: 36.75
                    }
                  ]
                }
              }
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['road', 'street', 'street_limited', 'residential'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 10,
                      input: 1.1
                    },
                    {
                      stop: 13,
                      input: 4
                    },
                    {
                      stop: 15,
                      input: 10
                    },
                    {
                      stop: 18,
                      input: 33.25
                    }
                  ]
                }
              }
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['track', 'railway'] },
              input: 1.5
            },
            {
              filter: { key: 'type', comparator: '==', value: 'path' },
              input: 1.5
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'lin',
              ranges: [
                {
                  stop: 12,
                  input: 2
                },
                {
                  stop: 15,
                  input: 6
                }
              ]
            }
          }
        }
      }
    },
    {
      name: 'transport-primary',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['primary', 'primary_link', 'secondary', 'secondary_link']
          }
        ]
      },
      type: 'line',
      minzoom: 5,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 11,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'tunnel', comparator: '==', value: true },
              input: '#e3e3e3'
            },
            {
              filter: { key: 'type', comparator: 'has', value: ['primary', 'primary_link'] },
              input: '#fbefb2'
            }
          ],
          fallback: '#ffffff'
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['primary', 'primary_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    {
                      stop: 7,
                      input: 1
                    },
                    {
                      stop: 10,
                      input: 1.5
                    },
                    {
                      stop: 13,
                      input: 10
                    },
                    {
                      stop: 18,
                      input: 36.75
                    }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                {
                  stop: 7,
                  input: 1
                },
                {
                  stop: 10,
                  input: 1.5
                },
                {
                  stop: 13,
                  input: 10
                },
                {
                  stop: 18,
                  input: 30
                }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_borders',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          {
            or: [
              { key: 'layer', comparator: '==', value: undefined },
              { key: 'layer', comparator: '<=', value: 0 }
            ]
          },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 2,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 10,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            {
              stop: 10,
              input: '#f9ca4a'
            },
            {
              stop: 12,
              input: '#f1b743'
            }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 1.33 },
                    { stop: 7, input: 1.66 },
                    { stop: 10, input: 2.66 },
                    { stop: 13, input: 8.66 },
                    { stop: 18, input: 40 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 2 },
                { stop: 7, input: 2.5 },
                { stop: 10, input: 4 },
                { stop: 13, input: 13 },
                { stop: 18, input: 60 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          {
            or: [
              { key: 'layer', comparator: '==', value: undefined },
              { key: 'layer', comparator: '<=', value: 0 }
            ]
          },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 5,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 10,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            {
              stop: 2,
              input: '#f9ca4a'
            },
            {
              stop: 7,
              input: '#fde293'
            }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 0.66 },
                    { stop: 7, input: 0.833 },
                    { stop: 10, input: 1 },
                    { stop: 13, input: 6.66 },
                    { stop: 18, input: 36.75 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 1 },
                { stop: 7, input: 1.25 },
                { stop: 10, input: 1.5 },
                { stop: 13, input: 10 },
                { stop: 18, input: 56 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_borders_1',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'layer', comparator: '==', value: 1 },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 2,
      cap: 'butt',
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 10, input: '#f9ca4a' },
            { stop: 12, input: '#f1b743' }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 1.33 },
                    { stop: 7, input: 1.66 },
                    { stop: 10, input: 2.66 },
                    { stop: 13, input: 8.66 },
                    { stop: 18, input: 40 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 2 },
                { stop: 7, input: 2.5 },
                { stop: 10, input: 4 },
                { stop: 13, input: 13 },
                { stop: 18, input: 60 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_1',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'layer', comparator: '==', value: 1 },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 4,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 10,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 2, input: '#f9ca4a' },
            { stop: 7, input: '#fde293' }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 0.66 },
                    { stop: 7, input: 0.833 },
                    { stop: 10, input: 1 },
                    { stop: 13, input: 6.66 },
                    { stop: 18, input: 36.75 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 1 },
                { stop: 7, input: 1.25 },
                { stop: 10, input: 1.5 },
                { stop: 13, input: 10 },
                { stop: 18, input: 56 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_borders_2',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'layer', comparator: '==', value: 2 },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 2,
      cap: 'butt',
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 10, input: '#f9ca4a' },
            { stop: 12, input: '#f1b743' }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 1.33 },
                    { stop: 7, input: 1.66 },
                    { stop: 10, input: 2.66 },
                    { stop: 13, input: 8.66 },
                    { stop: 18, input: 40 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 2 },
                { stop: 7, input: 2.5 },
                { stop: 10, input: 4 },
                { stop: 13, input: 13 },
                { stop: 18, input: 60 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_2',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'layer', comparator: '==', value: 2 },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 4,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            {
              stop: 0,
              input: 'butt'
            },
            {
              stop: 10,
              input: 'round'
            }
          ]
        }
      },
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 2, input: '#f9ca4a' },
            { stop: 7, input: '#fde293' }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 0.66 },
                    { stop: 7, input: 0.833 },
                    { stop: 10, input: 1 },
                    { stop: 13, input: 6.66 },
                    { stop: 18, input: 36.75 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 1 },
                { stop: 7, input: 1.25 },
                { stop: 10, input: 1.5 },
                { stop: 13, input: 10 },
                { stop: 18, input: 56 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_borders_3',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'layer', comparator: '>=', value: 3 },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 2,
      cap: 'butt',
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 10, input: '#f9ca4a' },
            { stop: 12, input: '#f1b743' }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 1.33 },
                    { stop: 7, input: 1.66 },
                    { stop: 10, input: 2.66 },
                    { stop: 13, input: 8.66 },
                    { stop: 18, input: 40 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 2 },
                { stop: 7, input: 2.5 },
                { stop: 10, input: 4 },
                { stop: 13, input: 13 },
                { stop: 18, input: 60 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'motor_trunk_3',
      source: 'streets',
      layer: 'transport',
      filter: {
        and: [
          { key: 'layer', comparator: '>=', value: 3 },
          { key: 'tunnel', comparator: '!=', value: true },
          { key: 'class', comparator: '==', value: 'highway' },
          {
            key: 'type',
            comparator: 'has',
            value: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
          }
        ]
      },
      type: 'line',
      minzoom: 4,
      cap: {
        inputRange: {
          type: 'zoom',
          ease: 'step',
          ranges: [
            { stop: 0, input: 'butt' },
            { stop: 10, input: 'round' }
          ]
        }
      },
      join: 'bevel',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 2, input: '#f9ca4a' },
            { stop: 7, input: '#fde293' }
          ]
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: 'has', value: ['motorway_link', 'trunk_link'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 2, input: 0.66 },
                    { stop: 7, input: 0.833 },
                    { stop: 10, input: 1 },
                    { stop: 13, input: 6.66 },
                    { stop: 18, input: 36.75 }
                  ]
                }
              }
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'expo',
              base: 1.5,
              ranges: [
                { stop: 2, input: 1 },
                { stop: 7, input: 1.25 },
                { stop: 10, input: 1.5 },
                { stop: 13, input: 10 },
                { stop: 18, input: 56 }
              ]
            }
          }
        }
      }
    },
    {
      name: 'boundaries',
      source: 'streets',
      layer: 'boundary',
      filter: {
        and: [
          { key: 'adminLevel', comparator: 'has', value: [2, 4] },
          { key: 'maritime', comparator: '==', value: false }
        ]
      },
      type: 'line',
      minzoom: 0,
      cap: 'butt',
      join: 'bevel',
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'adminLevel', comparator: '==', value: 2 },
              input: 'rgb(120, 120, 120)'
            }
          ],
          fallback: 'rgb(160, 160, 160)'
        }
      },
      width: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'adminLevel', comparator: '==', value: 4 },
              input: 1.25
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'lin',
              ranges: [
                {
                  stop: 1.25,
                  input: 1
                },
                {
                  stop: 2,
                  input: 1.75
                }
              ]
            }
          }
        }
      }
    },
    {
      name: 'equator',
      source: 'streets',
      layer: 'equator',
      type: 'line',
      minzoom: 0,
      maxzoom: 10,
      cap: 'butt',
      join: 'bevel',
      color: 'rgba(125, 102, 97, 0.8)',
      dasharray: [
        [20, 'rgba(125, 102, 97, 0.8)'],
        [20, 'rgba(255, 255, 255, 0)']
      ],
      width: 1.5
    },
    {
      name: 'buildings',
      source: 'streets',
      layer: 'buildings',
      type: 'fill',
      opaque: true,
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: 'has', value: ['aeroway', 'office', 'hotel', 'hospital', 'shop', 'retail', 'industrial', 'school', 'commercial', 'public', 'warehouse', 'service', 'stadium'] },
              input: '#fdf9e9'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'police' },
              input: '#9bc1ef'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'fire_station' },
              input: '#fba69e'
            }
          ],
          fallback: '#f2f3f4'
        }
      }
    },
    {
      name: 'buildings_highlight',
      source: 'streets',
      layer: 'buildings',
      type: 'line',
      cap: 'butt',
      join: 'bevel',
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: 'has', value: ['aeroway', 'office', 'hotel', 'hospital', 'shop', 'retail', 'industrial', 'school', 'commercial', 'public', 'warehouse', 'service', 'stadium'] },
              input: '#f5e0a4'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'police' },
              input: '#648dbf'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'fire_station' },
              input: '#d07870'
            }
          ],
          fallback: '#d8dade'
        }
      },
      width: 1.5
    },
    {
      name: 'info-fill',
      source: '_info',
      type: 'fill',
      invert: true,
      minzoom: 0,
      color: 'rgba(64, 64, 64, 0.15)'
    },
    {
      name: 'info-border',
      source: '_info',
      type: 'line',
      minzoom: 0,
      cap: 'butt',
      join: 'bevel',
      color: 'rgba(161, 106, 179, 0.85)',
      width: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            {
              stop: 0,
              input: 2
            },
            {
              stop: 3,
              input: 2.5
            }
          ]
        }
      }
    },
    {
      name: 'shade',
      source: 'mask',
      type: 'shade',
      maxzoom: 2
    },
    {
      name: 'address',
      source: 'streets',
      layer: 'addr',
      type: 'glyph',
      minzoom: 16,
      textFamily: ['robotoRegular', 'notoRegular'],
      textField: '?housenumber',
      textAnchor: 'center',
      textLineHeight: 0.02,
      textOffset: [0, 0],
      textPadding: [4, 2],
      textSize: 14,
      textFill: 'rgb(100, 100, 100)',
      textStroke: 'rgba(255, 255, 255, 0.65)',
      textStrokeWidth: 0.7,
      noShaping: true,
      viewCollisions: false
    },
    {
      name: 'country_state',
      source: 'streets',
      filter: {
        or: [
          {
            and: [
              { key: 'class', comparator: '==', value: 'continent' },
              { key: '?name', comparator: '==', value: 'Antarctica' }
            ]
          },
          { key: 'class', comparator: 'has', value: ['country', 'state', 'province', 'territory'] }
        ]
      },
      layer: 'place',
      type: 'glyph',
      maxzoom: 12,
      textFamily: ['robotoMedium', 'notoMedium'],
      textField: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: '==', value: 'continent' },
              input: '?!P!Uname_XX'
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'step',
              ranges: [
                {
                  stop: 0,
                  input: '?abbr,?name'
                },
                {
                  stop: 3,
                  input: {
                    dataCondition: {
                      conditions: [
                        {
                          filter: {
                            and: [
                              { key: '?!Pname_XX', comparator: '!=', value: '' },
                              { key: '?!Pname_XX', comparator: 'has', value: '?name' }
                            ]
                          },
                          input: '?name'
                        }
                      ],
                      fallback: ['?name', '\n', '?!Pname_XX']
                    }
                  }
                }
              ]
            }
          }
        }
      },
      textAnchor: 'center',
      textLineHeight: 0.02,
      textOffset: [0, 0],
      textPadding: [4, 2],
      textSize: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: '==', value: 'country' },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 0, input: 14 },
                    { stop: 4, input: 28 }
                  ]
                }
              }
            },
            {
              filter: { key: 'class', comparator: 'has', value: ['state', 'province', 'territory'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    { stop: 0, input: 10 },
                    { stop: 6, input: 20 }
                  ]
                }
              }
            }
          ],
          fallback: 15.3
        }
      },
      textFill: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: '==', value: 'country' },
              input: 'rgb(42, 42, 42)'
            },
            {
              filter: { key: 'class', comparator: '==', value: 'continent' },
              input: 'rgb(65, 65, 65)'
            },
            {
              filter: { key: 'class', comparator: 'has', value: ['state', 'province', 'territory'] },
              input: 'rgb(90, 90, 90)'
            }
          ],
          fallback: 'rgba(0, 0, 0, 0)'
        }
      },
      textStroke: 'rgba(255, 255, 255, 0.65)',
      textStrokeWidth: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: 'has', value: ['state', 'province', 'territory'] },
              input: 0.7
            },
            {
              filter: { key: 'class', comparator: '==', value: 'continent' },
              input: 0.5
            }
          ],
          fallback: 0
        }
      },
      textWordWrap: 8,
      noShaping: true,
      viewCollisions: false
    },
    {
      name: 'places',
      source: 'streets',
      minzoom: 4,
      maxzoom: 13,
      filter: {
        key: 'class',
        comparator: 'has',
        value: ['city', 'town', 'village', 'hamlet', 'locality', 'neighbourhood', 'island', 'suburb']
      },
      layer: 'place',
      type: 'glyph',
      textFamily: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: 'has', value: ['town', 'hamlet'] },
              input: ['robotoRegular']
            }
          ],
          fallback: ['robotoMedium']
        }
      },
      textField: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: 'has', value: ['hamlet', 'village', 'neighbourhood', 'suburb', 'island'] },
              input: {
                dataCondition: {
                  conditions: [
                    {
                      filter: { key: '?!Pname_en', comparator: '!=', value: '' },
                      input: '?!Uname_en'
                    }
                  ],
                  fallback: '?!Uname'
                }
              }
            }
          ],
          fallback: {
            dataCondition: {
              conditions: [
                {
                  filter: { key: '?!Pname_en', comparator: '!=', value: '' },
                  input: '?name_en'
                }
              ],
              fallback: '?name'
            }
          }
        }
      },
      textAnchor: 'center',
      textOffset: [0, 0],
      textPadding: [1, 1],
      textSize: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: '==', value: 'city' },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 5,
                      input: 12
                    },
                    {
                      stop: 9,
                      input: 17
                    },
                    {
                      stop: 13,
                      input: 32.3
                    }
                  ]
                }
              }
            },
            {
              filter: { key: 'class', comparator: '==', value: 'town' },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 8,
                      input: 12
                    },
                    {
                      stop: 10,
                      input: 15.3
                    },
                    {
                      stop: 13,
                      input: 21.25
                    }
                  ]
                }
              }
            },
            {
              filter: { key: 'class', comparator: 'has', value: ['neighbourhood', 'suburb'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 10,
                      input: 13.6
                    },
                    {
                      stop: 15,
                      input: 15.3
                    }
                  ]
                }
              }
            },
            {
              filter: { key: 'class', comparator: 'has', value: ['hamlet', 'village', 'locality'] },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'lin',
                  ranges: [
                    {
                      stop: 10.5,
                      input: 12
                    },
                    {
                      stop: 12,
                      input: 15.3
                    }
                  ]
                }
              }
            }
          ],
          fallback: 14.45
        }
      },
      textFill: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'class', comparator: 'has', value: ['village', 'island'] },
              input: 'rgb(98, 114, 138)'
            },
            {
              filter: { key: 'class', comparator: 'has', value: ['hamlet', 'neighbourhood', 'locality'] },
              input: '#7d8ca2'
            }
          ],
          fallback: {
            inputRange: {
              type: 'zoom',
              ease: 'lin',
              ranges: [
                {
                  stop: 9,
                  input: 'rgb(75, 75, 75)'
                },
                {
                  stop: 12,
                  input: 'rgb(100, 100, 100)'
                }
              ]
            }
          }
        }
      },
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.65,
      noShaping: true,
      viewCollisions: false
    },
    {
      name: 'water_label',
      source: 'streets',
      filter: { key: 'class', comparator: '==', value: 'water' },
      layer: 'poi',
      type: 'glyph',
      textFamily: ['robotoMedium', 'notoMedium'],
      textField: {
        dataCondition: {
          conditions: [{
            filter: { key: 'name_en', comparator: '!=', value: '' },
            input: '?name_en'
          }],
          fallback: '?name'
        }
      },
      textAnchor: 'center',
      textOffset: [0, 0],
      textPadding: [1, 1],
      textSize: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'type', comparator: '==', value: 'ocean' },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 0, input: 14 },
                    { stop: 3, input: 22 }
                  ]
                }
              }
            },
            {
              filter: { key: 'type', comparator: '==', value: 'sea' },
              input: {
                inputRange: {
                  type: 'zoom',
                  ease: 'expo',
                  base: 1.5,
                  ranges: [
                    { stop: 0, input: 10 },
                    { stop: 4, input: 16 },
                    { stop: 7, input: 22 }
                  ]
                }
              }
            }
          ],
          fallback: 13.6
        }
      },
      textFill: '#00669E',
      textStroke: '#00669E',
      textStrokeWidth: 0,
      noShaping: true,
      viewCollisions: false
    }
  ]
}

export default style
