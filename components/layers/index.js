// @flow
/* MODULES */
// import { useState, useEffect, useRef } from 'react'
// import Sortable from 'sortablejs'
import { ReactSortable } from 'react-sortablejs'
/* STYLESHEET */
import styles from '../../styles/layers.module.css'

import NewIcon from '../../public/images/studio/icons/new.svg'

export default function Layers ({ style, setStyle, s2map }) {
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
        <DraggableContainer style={style} setStyle={setStyle} s2map={s2map} group={false} />
      </div>
    </div>
  )
}

function DraggableContainer ({ style, setStyle, s2map, group }) {
  const { layers } = style
  // build elements from layers
  const elements = layers.map((layer, i) => {
    if (Array.isArray(layer)) return <DraggableContainer layers={layer} group />
    const { _color, _name, _type } = layer
    return <Layer key={i} color={_color} name={_name} type={_type} />
  })

  function setList (newLayers) {
    newLayers = newLayers.map((l, i) => { l._index = i; return l })
    setStyle({ layers: newLayers })
  }

  function onDrop () {
    let change = false
    for (const layer of layers) {
      if (layer._index !== layer._indexOld) {
        change = true
        break
      }
    }
    if (change) s2map.current.updateStyle(style)
  }

  return (
    <div className={styles.listContainer}>
      <ReactSortable
        tag='ul'
        className={styles.layerUL}
        group='group'
        animation={200}
        delayOnTouchStart
        delay={2}
        list={layers}
        setList={setList}
        onEnd={onDrop}
      >
        {elements}
      </ReactSortable>
    </div>
  )
}

const Layer = ({ name, type, color }) => {
  const colorStyle = (color) ? { background: color } : {}
  return (
    <li className={styles.layerLI}>
      <div className={styles.layer}>
        <div className={`${styles.layerColor} ${(!color ? styles.layerColorMulti : '')}`} style={colorStyle} />
        <div className={`${styles.layerType} ${styles[`layerType${type}`]}`} />
        <div className={styles.layerName}>{name}</div>
      </div>
    </li>
  )
}
