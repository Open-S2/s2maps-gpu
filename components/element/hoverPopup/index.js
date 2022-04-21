/* MODULES */
import { useState, useRef, useEffect } from 'react'
 
export default function HoverPopup ({ visible, children, className, id }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useRef(null)
 
  const onMovement = (e) => {
    const { clientX, clientY } = e
    const pos = setPos({ x: clientX, y: clientY })
  }
 
  useEffect(() => {
    document.addEventListener('mousemove', onMovement, true)
    return () => {
      document.removeEventListener('mousemove', onMovement, true)
    }
  }, [onMovement])

  const { x, y } = pos
 
  return (
    <div ref={ref} className={className} id={id} style={{ display: visible ? 'block' : 'none', pointerEvents: 'none', position: 'absolute', top: y, left: x }}>
      {children}
    </div>
  )
}