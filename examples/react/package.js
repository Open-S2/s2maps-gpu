import React from 'react'
import { Map } from 's2maps-gl-react'
import style from './style.json'

export default function App () {
  return (
    <div className='App'>
      <Map style={style} options={{ dark: true }} />
    </div>
  )
}
