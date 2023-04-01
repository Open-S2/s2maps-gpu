// @flow
/* MODULES */
import { useState } from 'react'
import { HexColorPicker, HslStringColorPicker, HslaStringColorPicker, RgbStringColorPicker, RgbaStringColorPicker, HsvStringColorPicker, HsvaStringColorPicker } from 'react-colorful'
/* COMPONENTS */
import Code from '../code/index.jsx'

/* STYLESHEET */
import stylesLayers from '../../styles/layers.module.css'
import stylesLayer from '../../styles/layer.module.css'

import CloseIcon from '../../public/images/studio/icons/close.svg'
import ChevronRightIcon from '../../public/images/studio/icons/chevron-right.svg'

export default function Layer ({ style, layerIndex, setEditor, s2map }) {
  style = style.current
  if (!style || isNaN(layerIndex)) {
    setEditor({ page: 'layers', layerIndex: null })
    return null
  }
  // grab the layer
  const [layer, setLayer] = useState(style.layers[layerIndex])
  const { _name, name, type, source, filter, minzoom, maxzoom, interactive, invert, overdraw, opaque, lch, paint, layout } = layer
  const sourceName = style.sources[layer.source] || `s2MapsGL.${layer.source}`

  const code = JSON.stringify({ name, type, source, layer: layer.layer, filter, minzoom, maxzoom, interactive, invert, overdraw, opaque, lch, paint, layout }, null, 2)

  function updateLayer (layer, fullUpdate = false) {
    style.layers[layerIndex] = layer
    // s2map.updateLayer(layer, layerIndex, fullUpdate)
    setLayer(layer)
  }

  return (
    <div id={stylesLayer.layer}>
      <div id={stylesLayer.header}>
        <div id={stylesLayer.headerLeft}>
          <div id={stylesLayer.headerName}>{_name}</div>
        </div>
        <div id={stylesLayer.headerRight}>
          <div id={stylesLayer.headerNew} onClick={() => setEditor({ page: 'layers', layerIndex: null })}><CloseIcon /></div>
        </div>
      </div>

      <div id={stylesLayer.body}>
        <div id={stylesLayer.layerContainer}>
          <div id={stylesLayer.layerSubcontainer}>

            <Section name='Source'><SourceTypeFilter layer={layer} sourceName={sourceName} /></Section>

            <Section name='Properties'><LayerProperties layer={layer} updateLayer={updateLayer} s2map={s2map} /></Section>

            {
              layer && layer.paint && Object.keys(layer.paint).length
                ? <Section name='Paint'><LayerPaint layer={layer} s2map={s2map} /></Section>
                : null
            }

            <Section name='Code'><Code showLineNumbers light code={code} language='json' /></Section>

          </div>
        </div>
      </div>
    </div>
  )
}

function SourceTypeFilter ({ layer, sourceName }) {
  const { _type, source, filter } = layer

  // cleanup sourceName
  if (sourceName.includes('s2maps://data/')) sourceName = sourceName.replace('s2maps://data/', '').replaceAll('/', '.')

  const hasFilter = Array.isArray(filter) && filter.length > 0

  return (
    <div id={stylesLayer.sourceTypeFilter}>
      <div id={stylesLayer.stfTop}>
        <div id={stylesLayer.stfLeft}>
          <div id={stylesLayer.stfSource}>{source}{layer.layer && `.${layer.layer}`}</div>
          <div id={stylesLayer.stfSourceName}>{sourceName}</div>
        </div>
        <ChevronRightIcon id={stylesLayer.stfSVG} />
      </div>

      <div id={stylesLayer.stfBottom}>
        <div id={stylesLayer.stfBottomLeft}>
          <div className={`${stylesLayer.layerType} ${stylesLayers[`layerType${_type}`]}`} />
          <div id={stylesLayer.stfLayerLeft}>{_type}</div>
        </div>
        <div id={stylesLayer.stfLayerFilter} style={!hasFilter ? { borderColor: '#bccbd7', color: '#bccbd7' } : {}}>Filter</div>
      </div>
    </div>
  )
}

function LayerProperties ({ layer, updateLayer, s2map }) {
  const { minzoom, maxzoom, interactive, invert, overdraw, opaque, lch } = layer

  const minzoomChange = (e) => {
    const { value } = e.target
    updateLayer({ ...layer, minzoom: +value, maxzoom: Math.max(+value, maxzoom) })
  }

  const maxzoomChange = (e) => {
    const { value } = e.target
    updateLayer({ ...layer, maxzoom: +value })
  }

  return (
    <div id={stylesLayer.layerProperties}>
      <PropertiesContainer name='minzoom'>
        <div className={stylesLayer.zoomContainer}>
          <input className={stylesLayer.zoomInput} onChange={minzoomChange} type='range' tabindex='-1' min='0' max='20' step='1' value={minzoom} />
          <div className={stylesLayer.zoomValue}>{minzoom}</div>
        </div>
      </PropertiesContainer>

      <PropertiesContainer name='maxzoom'>
        <div className={stylesLayer.zoomContainer}>
          <input className={stylesLayer.zoomInput} onChange={maxzoomChange} type='range' tabindex='-1' min={minzoom} max='20' step='1' value={maxzoom} />
          <div className={stylesLayer.zoomValue}>{maxzoom}</div>
        </div>
      </PropertiesContainer>

      {
        typeof interactive === 'boolean'
          ? (
            <PropertiesContainer name='interactive'>
              <PropertiesSwitch checked={interactive} onChange={(e) => updateLayer({ ...layer, interactive: e.target.checked })} />
            </PropertiesContainer>
            )
          : null
      }

      {
        typeof invert === 'boolean'
          ? (
            <PropertiesContainer name='invert'>
              <PropertiesSwitch checked={invert} onChange={(e) => updateLayer({ ...layer, invert: e.target.checked })} />
            </PropertiesContainer>
            )
          : null
      }

      {
        typeof overdraw === 'boolean'
          ? (
            <PropertiesContainer name='overdraw'>
              <PropertiesSwitch checked={overdraw} onChange={(e) => updateLayer({ ...layer, overdraw: e.target.checked })} />
            </PropertiesContainer>
            )
          : null
      }

      {
        typeof opaque === 'boolean'
          ? (
            <PropertiesContainer name='opaque'>
              <PropertiesSwitch checked={opaque} onChange={(e) => updateLayer({ ...layer, opaque: e.target.checked })} />
            </PropertiesContainer>
            )
          : null
      }

      {
        typeof lch === 'boolean'
          ? (
            <PropertiesContainer name='lch'>
              <PropertiesSwitch checked={lch} onChange={(e) => updateLayer({ ...layer, lch: e.target.checked })} />
            </PropertiesContainer>
            )
          : null
      }
    </div>
  )
}

function PropertiesContainer ({ name, children }) {
  return (
    <div className={stylesLayer.layerPropContainer}>
      <div className={stylesLayer.layerPropKey}>{name}</div>
      <div className={stylesLayer.layerPropValue}>{children}</div>
    </div>
  )
}

function PropertiesSwitch ({ checked, onChange }) {
  return (
    <div className={stylesLayer.switchContainer}>
      <label className={stylesLayer.switch}>
        <input type='checkbox' checked={checked} onChange={onChange} />
        <span className={stylesLayer.slider} />
      </label>
      <div className={stylesLayer.switchName}>{checked ? 'True' : 'False'}</div>
    </div>
  )
}

function LayerPaint ({ layer }) {
  const { paint } = layer
  const { color, opacity, radius, stroke, strokeWidth, width, dasharray, gapwidth } = paint
  const textSize = paint['text-size']
  const textFill = paint['text-fill']
  const textStroke = paint['text-stroke']
  const textStrokeWidth = paint['text-stroke-width']
  const iconSize = paint['icon-size']

  return (
    <div>
      {color ? <SubSection name='Color'><ColorFunctionComponent func={color} /></SubSection> : null}
      {opacity ? <SubSection name='Opacity'><ColorFunctionComponent func={opacity} /></SubSection> : null}
      {radius ? <SubSection name='Radius'><ColorFunctionComponent func={radius} /></SubSection> : null}
      {stroke ? <SubSection name='Stroke'><ColorFunctionComponent func={stroke} /></SubSection> : null}
      {strokeWidth ? <SubSection name='Stroke Width'><ColorFunctionComponent func={strokeWidth} /></SubSection> : null}
      {width ? <SubSection name='Width'><ColorFunctionComponent func={width} /></SubSection> : null}
      {dasharray ? <SubSection name='Dasharray'><ColorFunctionComponent func={dasharray} /></SubSection> : null}
      {gapwidth ? <SubSection name='Gapwidth'><ColorFunctionComponent func={gapwidth} /></SubSection> : null}
      {textSize ? <SubSection name='Text Size'><ColorFunctionComponent func={textSize} /></SubSection> : null}
      {textFill ? <SubSection name='Text Fill'><ColorFunctionComponent func={textFill} /></SubSection> : null}
      {textStroke ? <SubSection name='Text Stroke'><ColorFunctionComponent func={textStroke} /></SubSection> : null}
      {textStrokeWidth ? <SubSection name='Text Stroke Width'><ColorFunctionComponent func={textStrokeWidth} /></SubSection> : null}
      {iconSize ? <SubSection name='Icon Size'><ColorFunctionComponent func={iconSize} /></SubSection> : null}
    </div>
  )
}

// function LayerLayout ({ layer }) {
//   let { layout } = layer
// }

function Section ({ name, children }) {
  return (
    <div className={stylesLayer.section}>
      <div className={stylesLayer.sectionName}>{name}</div>
      <div className={stylesLayer.sectionContainer}>{children}</div>
    </div>
  )
}

function SubSection ({ name, children }) {
  return (
    <div className={stylesLayer.subSection}>
      <div className={stylesLayer.subSectionName}>{name}</div>
      <div className={stylesLayer.subSectionContainer}>{children}</div>
    </div>
  )
}

function ColorFunctionComponent ({ func }) {
  const [active, setActive] = useState(false)

  if (!active) {
    return (
      <div className={stylesLayer.colorFunction}>
        <div className={stylesLayer.colorContainer} style={{ cursor: 'pointer' }} onClick={() => setActive(true)}>
          <div className={stylesLayer.colorBlock} style={{ backgroundColor: func }} />
          <div className={stylesLayer.colorString}>{func}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={stylesLayer.colorFunction}>
      <div className={stylesLayer.colorContainer}>
        <ColorComponent colorString={func} />
      </div>
    </div>
  )
}

function ColorComponent ({ layer, colorString }) {
  const [color, setColor] = useState(colorString)
  const type = color.slice(0, 4)

  const ColorPicker = (type === 'rgb(')
    ? RgbStringColorPicker // "rgb(255, 255, 255)"
    : (type === 'rgba')
        ? RgbaStringColorPicker // "rgba(255, 255, 255, 1)"
        : (type === 'hsl(')
            ? HslStringColorPicker // "hsl(0, 0%, 0%)"
            : (type === 'hsla')
                ? HslaStringColorPicker // "hsla(0, 0%, 0%, 1)"
                : (type === 'hsv(')
                    ? HsvStringColorPicker // "hsv(0, 0%, 0%)"
                    : (type === 'hsva')
                        ? HsvaStringColorPicker // "hsva(0, 0%, 0%, 1)"
                        : HexColorPicker // #ff0000

  return <ColorPicker className={stylesLayer.colorComponent} color={color} onChange={setColor} />
}
