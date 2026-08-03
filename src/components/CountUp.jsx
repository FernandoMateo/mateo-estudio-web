import { useEffect, useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

export default function CountUp({ value, format }) {
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(format ? format(0) : '0')
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.95, ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setDisplay(format ? format(v) : Math.round(v).toLocaleString('es-AR')),
    })
    return controls.stop
  }, [value])
  return <>{display}</>
}
