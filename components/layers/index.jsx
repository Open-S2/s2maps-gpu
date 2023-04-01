// @flow
/* MODULES */
import { useRef, useEffect } from 'react'
import Sortable from 'sortablejs'
/* STYLESHEET */
import styles from '../../styles/layers.module.css'

import NewIcon from '../../public/images/studio/icons/new.svg'

export default function Layers ({ style, setEditor, s2map }) {
  style = style.current
  return (
    <div id={styles.layers}>
      <div id={styles.header}>
        <div id={styles.headerText}>Layers</div>
        <div id={styles.headerRight}>
          <div id={styles.headerNew}>
            <NewIcon />
          </div>
          <div id={styles.headerTextCount}>{style.layers.length}</div>
        </div>
      </div>

      <div id={styles.body}>
        <DraggableContainer style={style} setEditor={setEditor} s2map={s2map} />
      </div>
    </div>
  )
}

function DraggableContainer ({ style, setEditor, s2map, group }) {
  const sortableRef = useRef(null)
  const { layers } = style
  // style is not ready
  if (!Array.isArray(layers)) return null
  // build elements from layers
  const elements = layers.map((layer, i) => {
    // if (Array.isArray(layer)) return <DraggableContainer style={{ layers: layer }} setEditor={setEditor} s2map={s2map} group />
    return <Layer key={i} layer={layer} setEditor={setEditor} />
  })

  const onUpdate = ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) return
    // 1) move element from old to new index
    const movedLayer = layers.splice(oldIndex, 1)[0]
    layers.splice(newIndex, 0, movedLayer)
    // update their index positions for future s2maps reorder
    layers.forEach((l, i) => { l._index = i })

    const layerOrder = {}
    for (const layer of layers) {
      layerOrder[layer._indexOld] = layer._index
      layer._indexOld = layer._index
    }
    s2map.current.reorderLayers(layerOrder)
  }

  useEffect(() => {
    if (!sortableRef.current) return
    Sortable.create(sortableRef.current, {
      group: 'group',
      animation: 200,
      onUpdate,
      delay: 2
    })
  }, [])

  return (
    <div className={styles.listContainer}>
      <div className={styles.layerUL} ref={sortableRef}>{elements}</div>
    </div>
  )
}

const Layer = ({ layer, setEditor }) => {
  const { _color, _name, _type } = layer
  const colorStyle = (_color) ? { background: _color } : {}
  const layerClick = () => { setEditor({ page: 'layer', layerIndex: layer._index }) }
  return (
    <li className={styles.layerLI} onClick={layerClick}>
      <div className={styles.layer}>
        <div className={`${styles.layerColor} ${(!_color ? styles.layerColorMulti : '')}`} style={colorStyle} />
        <div className={`${styles.layerType} ${styles[`layerType${_type}`]}`} />
        <div className={styles.layerName}>{_name}</div>
      </div>
    </li>
  )
}
