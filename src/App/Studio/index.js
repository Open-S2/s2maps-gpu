import React, { useState, useEffect } from 'react'
import { List, arrayMove } from 'react-movable'
import { S2Map } from '../../s2'

import './studio.css'

import Starter from './style.json'

const buttonStyles = {
  border: 'none',
  margin: 0,
  padding: 0,
  width: 'auto',
  overflow: 'visible',
  cursor: 'pointer',
  background: 'transparent'
}

function StudioContainer () {
  return <Studio style={Starter} />
}

function Studio ({ style }) {
  const [position, setPosition] = useState({ zoom: 0, lon: 0, lat: 0 })
  const [activeLayer, setActiveLayer] = useState()
  const [beforeStyle, setBeforeStyle] = useState()
  const [afterStyle, setAfterStyle] = useState()
  const [editor, setEditor] = useState()

  console.log(beforeStyle)

  useEffect(() => {
    if (style) {
      setBeforeStyle(JSON.parse(JSON.stringify(style)))
      setAfterStyle(prepStyle(JSON.parse(JSON.stringify(style))))
    }
  }, [style])

  let { zoom, lon, lat } = position
  zoom = zoom.toFixed(3)
  while (lon > 180) lon -= 360
  lon = lon.toFixed(5)
  lat = lat.toFixed(5)

  return (
    <div className="Studio">
      <div id="studio-header">
        <div id="studio-header-container">
          <div id="studio-header-left">
            <div id="studio-header-jolly-roger" />
            <div id="studio-header-back">Back</div>
          </div>

          <div id="studio-header-mid"><span id="studio-header-mid-zoom">{zoom}</span> {lon}, {lat}</div>

          <div id="studio-header-right">
            <div id="studio-header-settings"></div>
            <button id="studio-header-publish">Publish</button>
          </div>
        </div>
      </div>

      <div id="studio-body">
        <div id="studio-body-editor">
          { (afterStyle) ? <Layers layers={afterStyle.layers} activeLayer={activeLayer} setActiveLayer={setActiveLayer} /> : null }
        </div>

        <div id="studio-body-spacer"></div>

        <div id="studio-body-map">
          <div id="studio-body-map-editor">
            <div id="studio-body-map-editor-top" />

            <div id="studio-body-map-editor-middle">
              <div className="studio-body-map-editor-container" onClick={() => { (editor === 'info') ? setEditor(null) : setEditor('info') }}>
                <div id="studio-body-map-info" style={(editor === 'info') ? { backgroundPosition: '0% 50%' } : {}} />
              </div>
              <div className="studio-body-map-editor-container" onClick={() => { (editor === 'source') ? setEditor(null) : setEditor('source') }}>
                <div id="studio-body-map-source" style={(editor === 'source') ? { backgroundPosition: '0% 50%' } : {}} />
              </div>
              <div className="studio-body-map-editor-container" onClick={() => { (editor === 'glyph') ? setEditor(null) : setEditor('glyph') }}>
                <div id="studio-body-map-glyph" style={(editor === 'glyph') ? { backgroundPosition: '0% 50%' } : {}} />
              </div>
              <div className="studio-body-map-editor-container" onClick={() => { (editor === 'wallpaper') ? setEditor(null) : setEditor('wallpaper') }}>
                <div id="studio-body-map-wallpaper" style={(editor === 'wallpaper') ? { backgroundPosition: '0% 50%' } : {}} />
              </div>
              <div className="studio-body-map-editor-container" onClick={() => { (editor === 'split') ? setEditor(null) : setEditor('split') }}>
                <div id="studio-body-map-split" style={(editor === 'split') ? { backgroundPosition: '0% 50%' } : {}} />
              </div>
            </div>

            <div id="studio-body-map-editor-bottom">
              <div className="studio-body-map-editor-container">
                <div id="studio-body-map-refresh" />
              </div>
            </div>
          </div>
          <div id="studio-body-map-container">
            {/* { (beforeStyle) ? <Map style={beforeStyle} before={true} /> : null } */}
            { (afterStyle) ? <Map style={afterStyle} before={false} split={false} setPosition={setPosition} /> : null }
          </div>
          <Editor position={position} activeLayer={activeLayer} style={afterStyle} editor={editor} setEditor={setEditor} />
        </div>
      </div>

      <div id="studio-footer">
        <div id="studio-footer-logs"></div>
        <div id="studio-footer-s2-explain">S2 Maps Inc. ©  {(new Date()).getFullYear()}</div>
      </div>

      <svg height="0px" width="0">
        <defs>
          <clipPath viewBox="0 0 64 64" id="split-clip-path" clipPathUnits="objectBoundingBox" transform="scale(0.015625, 0.015625)">
            <path d="M2.882,23.10764H25.06906a2.77527,2.77527,0,0,1,2.77527,2.77527V38.11709a2.77527,2.77527,0,0,1-2.77527,2.77527H2.882A2.77527,2.77527,0,0,1,.10671,38.11709V25.88291A2.77526,2.77526,0,0,1,2.882,23.10764Z" />
            <rect x="36.15567" y="23.10764" width="27.73763" height="17.78471" rx="2.77526" />
            <rect x="30.5" y="15.85441" width="3" height="32.29119" rx="1.84483" />
          </clipPath>
          <clipPath viewBox="0 0 64 64" id="source-clip-path" clipPathUnits="objectBoundingBox" transform="scale(0.015625, 0.015625)">
            <path d="M32,6.73754c-12.167,0-25.26251,2.15639-25.26251,6.88977V21.6654c0,5.89732,15.10721,8.0381,25.26251,8.0381s25.26251-2.14067,25.26251-8.0381V13.62731C57.26241,8.89393,44.167,6.73754,32,6.73754Zm0,11.483c-13.37357,0-20.6693-3.03451-20.6693-4.59321S18.62643,9.03409,32,9.03409s20.6693,3.03441,20.6693,4.59322S45.37357,18.22052,32,18.22052Z"/>
            <path d="M55.52694,41.37057C48.39463,45.61789,34.103,45.77948,32,45.77948s-16.39463-.1617-23.52694-4.40891a1.13624,1.13624,0,0,0-1.73557.96952v6.88427c0,5.27724,12.7086,8.0381,25.26251,8.0381s25.26251-2.76086,25.26251-8.0381V42.34009A1.13628,1.13628,0,0,0,55.52694,41.37057Z"/>
            <path d="M55.52694,27.591C48.39463,31.83836,34.103,32,32,32S15.60537,31.83825,8.47306,27.591a1.13624,1.13624,0,0,0-1.73557.96952v6.88428c0,5.89732,15.10721,8.03809,25.26251,8.03809s25.26251-2.14067,25.26251-8.03809V28.56055A1.13628,1.13628,0,0,0,55.52694,27.591Z"/>
          </clipPath>
          <clipPath viewBox="0 0 64 64" id="info-clip-path" clipPathUnits="objectBoundingBox" transform="scale(0.015625, 0.015625)">
            <path d="M50.45377,54.69568,30.22088,43.98283a1.62286,1.62286,0,0,0-1.66866.09646L13.081,54.79214a1.60786,1.60786,0,0,0,.9131,2.929H49.69821a1.60734,1.60734,0,0,0,.75556-3.02545Z"/>
            <path d="M57.22485,51.6413,52.46644,30.21881a1.61005,1.61005,0,0,0-2.4853-.97419L34.50666,39.95748a1.606,1.606,0,0,0,.164,2.73929L54.90031,53.40963a1.61239,1.61239,0,0,0,.75234.18969,1.586,1.586,0,0,0,.97419-.33116A1.60923,1.60923,0,0,0,57.22485,51.6413Z"/>
            <path d="M46.02973,26.69823a1.61128,1.61128,0,0,0-1.53684-1.12851H29.819a67.09979,67.09979,0,0,1-8.24041,11.25942,4.821,4.821,0,0,1-7.1762,0c-.627-.69768-1.59792-1.81334-2.71036-3.19585L7.8017,51.143a1.6065,1.6065,0,0,0,1.569,1.95481,1.59169,1.59169,0,0,0,.91631-.28615L45.406,28.4955A1.60164,1.60164,0,0,0,46.02973,26.69823Z"/>
            <path d="M17.99048,6.27887a11.26535,11.26535,0,0,0-11.253,11.253c0,5.7744,9.02811,16.00176,10.057,17.14957a1.607,1.607,0,0,0,2.39206,0c1.02885-1.14781,10.057-11.37517,10.057-17.14957A11.26536,11.26536,0,0,0,17.99048,6.27887Zm0,16.07571a4.82272,4.82272,0,1,1,4.82271-4.82272A4.82447,4.82447,0,0,1,17.99048,22.35458Z"/>
          </clipPath>
          <clipPath viewBox="0 0 64 64" id="wallpaper-clip-path" clipPathUnits="objectBoundingBox" transform="scale(0.015625, 0.015625)">
            <path d="M54.8847,52.62548H12.084a2.37782,2.37782,0,0,0,0,4.75563H54.8847a2.37782,2.37782,0,0,0,0-4.75563Z"/>
            <path d="M26.77891,50.24528a6.97066,6.97066,0,0,0,4.94348-2.04492L49.66777,30.255a2.37515,2.37515,0,0,0,0-3.36223L30.09121,7.31619a2.37515,2.37515,0,0,0-3.36223,0L8.78122,25.25919a7.00063,7.00063,0,0,0,0,9.887L21.83305,48.198a6.97269,6.97269,0,0,0,4.94586,2.0473Zm1.63118-37.88812L44.62442,28.57149l-.27583.27583H11.996a2.32007,2.32007,0,0,1,.1498-.2259Z"/>
            <path d="M45.37343,44.10576a5.94771,5.94771,0,1,0,11.88908,0c0-2.72973-3.40978-8.11549-4.456-9.69911a1.84833,1.84833,0,0,0-2.977,0c-1.04624,1.58362-4.456,6.96938-4.456,9.69911Z"/>
          </clipPath>
          <clipPath viewBox="0 0 64 64" id="glyph-clip-path" clipPathUnits="objectBoundingBox" transform="scale(0.015625, 0.015625)">
            <path d="M8.91476,23.31885A2.17733,2.17733,0,0,0,11.092,21.14158V11.092H21.14158a2.17727,2.17727,0,1,0,0-4.35454H8.91476A2.17731,2.17731,0,0,0,6.73749,8.91476V21.14158A2.17722,2.17722,0,0,0,8.91476,23.31885Z"/>
            <path d="M55.08524,6.73749H42.85842a2.17727,2.17727,0,0,0,0,4.35454H52.908V21.14158a2.17727,2.17727,0,1,0,4.35454,0V8.91476A2.17731,2.17731,0,0,0,55.08524,6.73749Z"/>
            <path d="M55.08524,40.68115A2.17733,2.17733,0,0,0,52.908,42.85842V52.908H42.85842a2.17727,2.17727,0,1,0,0,4.35454H55.08524a2.17731,2.17731,0,0,0,2.17727-2.17727V42.85842A2.17722,2.17722,0,0,0,55.08524,40.68115Z"/>
            <path d="M21.14158,52.908H11.092V42.85842a2.17727,2.17727,0,1,0-4.35454,0V55.08524a2.17731,2.17731,0,0,0,2.17727,2.17727H21.14158a2.17727,2.17727,0,1,0,0-4.35454Z"/>
            <path d="M48.15025,24.8645v-8.652a.8106.8106,0,0,0-.84077-.77724h-30.619a.8106.8106,0,0,0-.84077.77724v8.652a.81073.81073,0,0,0,.84077.77816h4.46436a.81045.81045,0,0,0,.83978-.77816V21.90075a.81136.81136,0,0,1,.84077-.77816h5.25085a.81073.81073,0,0,1,.84077.77816V43.28544a.81073.81073,0,0,1-.84077.77816H25.79a.81073.81073,0,0,0-.84077.77816v4.1319a.8106.8106,0,0,0,.84077.77724H38.21a.8106.8106,0,0,0,.84077-.77724v-4.1319A.81073.81073,0,0,0,38.21,44.0636H35.91372a.81073.81073,0,0,1-.84077-.77816V21.90075a.81073.81073,0,0,1,.84077-.77816h5.25085a.81136.81136,0,0,1,.84077.77816V24.8645a.81045.81045,0,0,0,.83978.77816h4.46436a.81072.81072,0,0,0,.84076-.77816Z"/>
          </clipPath>
          <clipPath viewBox="0 0 64 64" id="refresh-clip-path" clipPathUnits="objectBoundingBox" transform="scale(0.015625, 0.015625)">
            <path d="M56.53455,9.5621a2.05684,2.05684,0,0,0-2.948,0l-4.258,4.22611a25.37079,25.37079,0,0,0-8.02519-5.12663A24.72006,24.72006,0,0,0,32.00017,6.844a24.18814,24.18814,0,0,0-15.72294,5.45384A25.54751,25.54751,0,0,0,7.433,26.53v.22912a1.06267,1.06267,0,0,0,1.04807,1.04807h6.51831a.98312.98312,0,0,0,.98279-.75321,39.60086,39.60086,0,0,1,1.736-3.83236,16.70709,16.70709,0,0,1,14.28157-7.99272,16.27552,16.27552,0,0,1,11.43235,4.4877L38.911,24.23663a2.09654,2.09654,0,0,0,1.47475,3.57065H55.06049a2.12452,2.12452,0,0,0,2.0959-2.09625V11.03616A2.01108,2.01108,0,0,0,56.53455,9.5621Z"/>
            <path d="M55.289,36.1933H49a.98189.98189,0,0,0-.98233.75332,39.63527,39.63527,0,0,1-1.73576,3.832A16.70532,16.70532,0,0,1,32.00017,48.771,16.348,16.348,0,0,1,25.875,47.59237a16.91031,16.91031,0,0,1-5.27372-3.3421l4.4877-4.48736a2.09712,2.09712,0,0,0-1.474-3.571H8.9402a2.12652,2.12652,0,0,0-2.09659,2.09716V52.964a2.12614,2.12614,0,0,0,2.0967,2.0967,2.0177,2.0177,0,0,0,1.474-.62276L14.63968,50.212a25.01354,25.01354,0,0,0,7.97643,5.14258A24.53151,24.53151,0,0,0,31.86949,57.156a24.01394,24.01394,0,0,0,15.65743-5.45361A25.4586,25.4586,0,0,0,56.30612,37.47a.56157.56157,0,0,0,.03224-.22889A1.062,1.062,0,0,0,55.289,36.1933Z"/>
          </clipPath>
        </defs>
      </svg>
    </div>
  )
}

const Layers = ({ layers, activeLayer, setActiveLayer }) => {
  const elements = layers.map((layer, i) => {
    const { _color, _name, _type } = layer
    return <Layer key={i} color={_color} name={_name} type={_type} />
  })

  const [items, setItems] = useState([...Array(elements.length).keys()])

  return (
    <div className="studio-layers">
      <div className="studio-layers-header">
        <div className="studio-layers-header-text">Layers</div>
        <div className="studio-layers-header-right">
          <div className="studio-layers-header-new">
            <svg viewBox="0 0 50.48752 50.48595">
              <path d="M46.72553,31.99921a2.10307,2.10307,0,0,0-2.10365,2.10365V50.932a2.10576,2.10576,0,0,1-2.10365,2.10365h-29.451A2.10577,2.10577,0,0,1,10.96353,50.932V21.481a2.10577,2.10577,0,0,1,2.10365-2.10365H29.89635a2.10365,2.10365,0,1,0,0-4.20729H13.06718A6.31864,6.31864,0,0,0,6.75624,21.481V50.932A6.31865,6.31865,0,0,0,13.06718,57.243H42.51823A6.31865,6.31865,0,0,0,48.82917,50.932V34.10286A2.10172,2.10172,0,0,0,46.72553,31.99921Z" transform="translate(-6.75624 -6.75703)"/>
              <path d="M26.48,30.08279a1.065,1.065,0,0,0-.2882.53643l-1.48728,7.43849a1.05131,1.05131,0,0,0,1.03289,1.258.99449.99449,0,0,0,.20616-.021L33.38,37.80738a1.04612,1.04612,0,0,0,.53854-.2882l16.64405-16.644-7.43639-7.4364Z" transform="translate(-6.75624 -6.75703)"/>
              <path d="M55.70389,8.29532a5.26275,5.26275,0,0,0-7.43639,0l-2.91145,2.91145,7.43639,7.43639,2.91145-2.91145a5.25894,5.25894,0,0,0,0-7.43639Z" transform="translate(-6.75624 -6.75703)"/>
            </svg>
          </div>
          <div className="studio-layers-header-text-count">{layers.length}</div>
        </div>
      </div>

      <div className="studio-layers-body">
        <div className="studio-layers-list-container">
          <List
            lockVertically
            values={items}
            onChange={({ oldIndex, newIndex }) => {
              setItems(arrayMove(items, oldIndex, newIndex))
              setActiveLayer(null)
            }}
            renderList={({ children, props, isDragged }) => (
              <ul
                {...props}
                style={{
                  padding: 0,
                  margin: 0,
                  cursor: isDragged ? 'grabbing' : undefined,
                  height: '100%',
                  overflowY: 'scroll',
                  overflowX: 'hidden'
                }}
              >
                {children}
              </ul>
            )}
            renderItem={({ value, props, isDragged, isSelected, index }) => (
              <li
                className="studio-layer-li"
                {...props}
                style={{
                  ...props.style,
                  cursor: isDragged ? 'grabbing' : 'pointer',
                  backgroundColor: (activeLayer === index) ? '#e5ebf3' : (isDragged || isSelected) ? '#e5ebf3' : '#f4f7fb'
                }}
                onClick={() => { setActiveLayer(index) }}
              >
                <button
                  data-movable-handle
                  style={{
                    ...buttonStyles,
                    cursor: isDragged ? 'grabbing' : 'grab',
                    marginRight: '6px'
                  }}
                  tabIndex={-1}
                >
                  <div className="studio-layer-li-handle" />
                </button>
                {elements[value]}
              </li>
            )}
          />
        </div>
      </div>
    </div>
  )
}

const Editor = ({ position, activeLayer, style, editor, setEditor }) => {
  if (!editor || editor === 'split') {
    return null
  } else if (editor === 'info') {
    // const {
    //   name, center, zoom, minzoom, maxzoom, maxLatRotation, colorBlind,
    //   zoomController, interactive, scrollZoom, canMove, canZoom, attributions
    // } = style
    const {
      name
    } = style

    return (
      <div className="studio-editor">
        <div className="studio-editor-contents">
          <div className="studio-editor-name">{name}</div>

          <div className="studio-editor-container">
            <div className="studio-editor-header">Starting Position</div>
            <div className="studio-editor-body">
            </div>
          </div>

          <div className="studio-editor-container">
            <div className="studio-editor-header">Positional Boundaries</div>
            <div className="studio-editor-body">
            </div>
          </div>

          <div className="studio-editor-container">
            <div className="studio-editor-header">Controls</div>
            <div className="studio-editor-body">
            </div>
          </div>

          <div className="studio-editor-container">
            <div className="studio-editor-header">Attributions</div>
            <div className="studio-editor-body">
            </div>
          </div>
        </div>
      </div>
    )
  } else {
    return (
      <div className="studio-editor">
      </div>
    )
  }
}

// INFO
// "name": "s2maps-streets-v2",

// "center": [-44.86586, 29.50989],
// "zoom": -0.514,

// "minzoom": -1,
// "maxzoom": 17.99,
// "maxLatRotation": 85

// "zoomController"
// "interactive"
// scrollZoom
// canMove
// canZoom
// "colorBlind": false

// attributions

const Layer = ({ name, type, color }) => {
  const style = (color) ? { background: color } : {}
  return (
    <div className="studio-layer">
      <div className={`studio-layer-color ${(!color ? 'studio-layer-color-multi' : null)}`} style={style} />
      <div className={`studio-layer-type studio-layer-type-${type}`} />
      <div className="studio-layer-name">{name}</div>
    </div>
  )
}

const Map = ({ style, before, split, setPosition }) => {
  const [s2map, setS2map] = useState()

  const divStyle = (before)
    ? { clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0% 100%)' }
    : (split)
      ? { clipPath: 'polygon(50% 0px, 100% 0px, 100% 100%, 50% 100%)' }
      : {}

  return <div
    id='sudio-map-container'
    ref={c => prepCanvas(c, style, s2map, setS2map, before, setPosition)}
    style={divStyle}
  />
  // return <div id='sudio-map-container' ref={c => prepCanvas(c, style, s2map, setS2map)} style={{ clipPath: `polygon(0 0, 50% 0, 50% 100%, 0% 100%)` }} />
}

const prepCanvas = (container, style, s2map, setS2map, before, setPosition) => {
  if (s2map) return
  if (container) {
    s2map = new S2Map({ style, container, zoomController: true })
    if (!before) {
      s2map.addEventListener('pos', (data) => {
        setPosition(data.detail)
      })
    }
    setS2map(s2map)
  }
}

function prepStyle (style = {}) {
  // layers
  if (!style.layers) style.layers = []
  style.layers = style.layers.map(prepLayer)
  // name
  if (!style.name) style.name = 's2maps-new-v1'
  // center
  if (!style.center) style.center = [0, 0]
  // zoom
  if (!style.zoom) style.zoom = 0
  // minzoom
  if (!style.minzoom) style.minzoom = -1
  // maxzoom
  if (!style.maxzoom) style.maxzoom = 18.99
  // maxLatRotation
  if (!style.maxLatRotation) style.maxLatRotation = 85
  // colorBlind
  if (!style.colorBlind) style.colorBlind = false
  // zoomController
  if (!style.zoomController) style.zoomController = true
  // interactive
  if (!style.interactive) style.interactive = true
  // scrollZoom
  if (!style.scrollZoom) style.scrollZoom = true
  // canMove
  if (!style.canMove) style.canMove = true
  // canZoom
  if (!style.canZoom) style.canZoom = true
  // attributions
  if (!style.attributions) style.attributions = []

  return style
}

function prepLayer (layer, index) {
  const { name, type, source, paint } = layer
  // setup color
  if (paint && paint.color && typeof paint.color === 'string') layer._color = paint.color
  // setup type
  if (type === 'fill' && source === 'mask') layer._type = 'mask'
  else layer._type = type
  // setup name
  layer._name = (name) ? name : `[${index}] - (${type})`

  return layer
}

// ar div = document.getElementById('cart_item');
// while(div.firstChild){
//     div.removeChild(div.firstChild);
// }

export default StudioContainer
