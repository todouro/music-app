import { motion } from 'framer-motion'
import { VolumeX } from 'lucide-react'
import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { VolumeFilled } from './icons'
import './ElasticSlider.css'

type ElasticSliderProps = { value: number; onChange: (volume: number) => void }
const MAX_OVERFLOW = 45

/** Controlled, keyboard-accessible adaptation of React Bits Elastic Slider:
 * https://reactbits.dev/components/elastic-slider
 */
export default function ElasticSlider({ value, onChange }: ElasticSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [overflow, setOverflow] = useState(0)
  const [region, setRegion] = useState<'left' | 'middle' | 'right'>('middle')
  const [hovered, setHovered] = useState(false)

  const pointerValue = (clientX: number) => {
    if (!sliderRef.current) return value
    const { left, right } = sliderRef.current.getBoundingClientRect()
    const width = right - left
    const relative = width <= 0 ? 0 : (clientX - left) / width
    return Math.max(0, Math.min(1, relative))
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return
    const { left, right } = sliderRef.current.getBoundingClientRect()
    const outside = event.clientX < left ? left - event.clientX :
      event.clientX > right ? event.clientX - right : 0
    setRegion(event.clientX < left ? 'left' : event.clientX > right ? 'right' : 'middle')
    setOverflow(MAX_OVERFLOW * (2 / (1 + Math.exp(-outside / MAX_OVERFLOW)) - 1))
    if (!dragging.current) return
    onChange(pointerValue(event.clientX))
  }
  const release = () => {
    dragging.current = false
    setOverflow(0)
    setRegion('middle')
  }
  const percent = Math.round(Math.max(0, Math.min(value, 1)) * 100)
  return (
    <div className="elastic-volume" onPointerMove={move}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <motion.div className="elastic-volume-icon" aria-hidden="true"
        animate={{ x: region === 'left' ? -overflow : 0, scale: region === 'left' ? 1.25 : 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 20 }}>
        <VolumeX size={17} />
      </motion.div>
      <div ref={sliderRef} className="elastic-volume-control">
        <motion.div className="elastic-volume-rail"
          animate={{ scaleX: 1 + overflow / 160, scaleY: overflow ? 0.82 : hovered || dragging.current ? 1.6 : 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 21 }}>
          <span className="elastic-volume-fill" style={{ width: `${percent}%` }} />
        </motion.div>
        <input type="range" min="0" max="1" step="0.005" value={value}
          aria-label="Volume" aria-valuetext={`${percent} percent`}
          onChange={event => onChange(Math.max(0, Math.min(1, Number(event.target.value))))}
          onPointerDown={(event) => {
            dragging.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            onChange(pointerValue(event.clientX))
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId)
            release()
          }}
          onPointerCancel={release} />
      </div>
      <motion.div className="elastic-volume-icon" aria-hidden="true"
        animate={{ x: region === 'right' ? overflow : 0, scale: region === 'right' ? 1.25 : 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 20 }}>
        <VolumeFilled size={17} />
      </motion.div>
      <output className="elastic-volume-value" aria-live="off">{percent}%</output>
    </div>
  )
}
