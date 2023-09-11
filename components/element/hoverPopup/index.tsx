/* MODULES */
import React, { useEffect, useRef, useState } from 'react'

export default function HoverPopup ({ visible, children, className, id }: {
  visible: boolean
  children: React.ReactNode
  className?: string
  id?: string
}): any {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useRef(null)

  const onMovement = (e: MouseEvent): void => {
    const { clientX, clientY } = e
    setPos({ x: clientX, y: clientY })
  }

  useEffect(() => {
    document.addEventListener('mousemove', onMovement, true)
    return () => {
      document.removeEventListener('mousemove', onMovement, true)
    }
  }, [onMovement])

  const { x, y } = pos

  return (
    <div
      ref={ref}
      className={className}
      id={id}
      style={{ display: visible ? 'block' : 'none', pointerEvents: 'none', position: 'absolute', top: y, left: x }}
    >
      {children}
    </div>
  )
}
