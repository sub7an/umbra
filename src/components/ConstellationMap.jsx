import { useState, useEffect, useMemo } from 'react'

const NODES = [
  { id: 'physics-sandbox',    abbr: 'Σ',  name: 'Physics Sandbox',    col: [132,204,22],  x: 50, y: 50, r: 5.0 },
  { id: 'general-relativity', abbr: 'GR', name: 'General Relativity', col: [249,115,22],  x: 50, y: 20, r: 4.2 },
  { id: 'special-relativity', abbr: 'SR', name: 'Special Relativity', col: [0,229,196],   x: 74, y: 31, r: 4.0 },
  { id: 'quantum-mechanics',  abbr: 'QM', name: 'Quantum Mechanics',  col: [245,158,11],  x: 26, y: 31, r: 4.2 },
  { id: 'frontier-physics',   abbr: 'FP', name: 'Frontier Physics',   col: [224,64,251],  x: 18, y: 17, r: 3.6 },
  { id: 'electromagnetism',   abbr: 'EM', name: 'Electromagnetism',   col: [168,85,247],  x: 82, y: 17, r: 3.6 },
  { id: 'wave-mechanics',     abbr: '≋',  name: 'Wave Mechanics',     col: [34,211,238],  x: 14, y: 50, r: 3.4 },
  { id: 'optics',             abbr: '◈',  name: 'Optics',             col: [252,211,77],  x: 86, y: 50, r: 3.4 },
  { id: 'dynamical-systems',  abbr: 'DS', name: 'Dynamical Systems',  col: [16,185,129],  x: 26, y: 69, r: 3.4 },
  { id: 'fluid-dynamics',     abbr: 'FD', name: 'Fluid Dynamics',     col: [45,212,191],  x: 74, y: 69, r: 3.4 },
  { id: 'thermodynamics',     abbr: 'TD', name: 'Thermodynamics',     col: [56,189,248],  x: 50, y: 80, r: 3.4 },
  { id: 'acoustic-physics',   abbr: '♪',  name: 'Acoustic Physics',   col: [168,85,247],  x: 86, y: 67, r: 3.2 },
]

const EDGES = [
  { a: 'quantum-mechanics',  b: 'special-relativity',  label: 'Relativistic QM' },
  { a: 'special-relativity', b: 'general-relativity',  label: 'Equivalence principle' },
  { a: 'quantum-mechanics',  b: 'general-relativity',  label: 'Quantum gravity' },
  { a: 'quantum-mechanics',  b: 'electromagnetism',    label: 'QED' },
  { a: 'electromagnetism',   b: 'special-relativity',  label: 'Lorentz covariance' },
  { a: 'electromagnetism',   b: 'optics',              label: "Maxwell's equations" },
  { a: 'quantum-mechanics',  b: 'wave-mechanics',      label: 'Wave–particle duality' },
  { a: 'wave-mechanics',     b: 'acoustic-physics',    label: 'Wave propagation' },
  { a: 'dynamical-systems',  b: 'thermodynamics',      label: 'Statistical mechanics' },
  { a: 'fluid-dynamics',     b: 'thermodynamics',      label: 'Heat & viscosity' },
  { a: 'fluid-dynamics',     b: 'dynamical-systems',   label: 'Chaotic flows' },
  { a: 'general-relativity', b: 'frontier-physics',    label: 'ΛCDM model' },
  { a: 'quantum-mechanics',  b: 'frontier-physics',    label: 'Quantum cosmology' },
  { a: 'optics',             b: 'wave-mechanics',      label: 'Diffraction' },
  { a: 'physics-sandbox',    b: 'dynamical-systems',   label: '' },
  { a: 'physics-sandbox',    b: 'fluid-dynamics',      label: '' },
  { a: 'thermodynamics',     b: 'acoustic-physics',    label: 'Sound speed' },
]

// Deterministic star field
const STARS = Array.from({ length: 160 }, (_, i) => ({
  x:  ((Math.sin(i * 2.3995) * 0.5 + 0.5) * 98 + 1).toFixed(2),
  y:  ((Math.cos(i * 1.7321) * 0.5 + 0.5) * 98 + 1).toFixed(2),
  r:  (0.18 + (i % 6) * 0.07).toFixed(2),
  o:  (0.07 + (i % 10) * 0.025).toFixed(2),
}))

export default function ConstellationMap({ onNavigate }) {
  const [hovered, setHov] = useState(null)
  const [ready,   setReady] = useState(false)

  useEffect(() => { const id = setTimeout(() => setReady(true), 60); return () => clearTimeout(id) }, [])

  const connSet = useMemo(() => {
    if (!hovered) return null
    const s = new Set()
    EDGES.forEach(({ a, b }) => { if (a === hovered || b === hovered) { s.add(a); s.add(b) } })
    return s
  }, [hovered])

  const hovNode = NODES.find(n => n.id === hovered)

  return (
    <div style={{ width: '100%', minHeight: 520, position: 'relative' }}>
      <svg
        viewBox="0 0 100 100"
        style={{ width: '100%', height: '100%', display: 'block', minHeight: 520 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="cg1" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="cg2" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="bg-grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="#0a1a22"/>
            <stop offset="100%" stopColor="#08090a"/>
          </radialGradient>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="100" height="100" fill="url(#bg-grad)"/>

        {/* Stars */}
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o}/>
        ))}

        {/* Edges */}
        {EDGES.map(({ a, b, label }, i) => {
          const fn = NODES.find(n => n.id === a)
          const tn = NODES.find(n => n.id === b)
          if (!fn || !tn) return null
          const active = hovered === a || hovered === b
          const midX = (fn.x + tn.x) / 2
          const midY = (fn.y + tn.y) / 2
          return (
            <g key={i}>
              <line
                x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y}
                stroke={active ? `rgba(${fn.col.join(',')},0.6)` : 'rgba(255,255,255,0.055)'}
                strokeWidth={active ? 0.38 : 0.14}
                strokeDasharray={active ? undefined : '0.7 0.6'}
                style={{ transition: 'stroke 0.18s, stroke-width 0.18s' }}
              />
              {active && label && (
                <text
                  x={midX} y={midY - 1.0}
                  textAnchor="middle" fontSize="1.55"
                  fill={`rgba(${fn.col.join(',')},0.95)`}
                  fontFamily="JetBrains Mono, monospace"
                  filter="url(#cg1)"
                  style={{ pointerEvents: 'none' }}
                >{label}</text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {NODES.map((node, i) => {
          const isHov  = hovered === node.id
          const isConn = connSet?.has(node.id) && !isHov
          const isDim  = hovered !== null && !isHov && !isConn
          const c = `rgb(${node.col.join(',')})`
          const delay  = i * 0.045

          return (
            <g
              key={node.id}
              style={{
                cursor: 'pointer',
                opacity: isDim ? 0.18 : 1,
                transform: ready ? 'scale(1)' : 'scale(0)',
                transformOrigin: `${node.x}px ${node.y}px`,
                transition: `transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay}s, opacity 0.2s`,
              }}
              onMouseEnter={() => setHov(node.id)}
              onMouseLeave={() => setHov(null)}
              onClick={() => onNavigate(node.id)}
            >
              {/* Outer aura */}
              <circle
                cx={node.x} cy={node.y}
                r={node.r * (isHov ? 2.2 : 1.5)}
                fill={`rgba(${node.col.join(',')},${isHov ? 0.13 : 0.04})`}
                filter="url(#cg2)"
                style={{ transition: 'r 0.2s, fill 0.2s' }}
              />
              {/* Main circle */}
              <circle
                cx={node.x} cy={node.y} r={node.r}
                fill={`rgba(${node.col.join(',')},${isHov ? 0.24 : 0.10})`}
                stroke={c}
                strokeWidth={isHov ? 0.5 : 0.22}
                filter="url(#cg1)"
                style={{ transition: 'all 0.15s' }}
              />
              {/* Abbr */}
              <text
                x={node.x} y={node.y + (node.r > 4 ? 1.15 : 0.95)}
                textAnchor="middle"
                fontSize={node.r > 4 ? 3.3 : 2.7}
                fill={c}
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="bold"
                filter={isHov ? 'url(#cg1)' : undefined}
                style={{ pointerEvents: 'none' }}
              >{node.abbr}</text>
              {/* Name */}
              <text
                x={node.x} y={node.y + node.r + 2.6}
                textAnchor="middle" fontSize="1.55"
                fill={isHov ? 'rgba(223,242,237,0.95)' : 'rgba(223,242,237,0.32)'}
                fontFamily="Chakra Petch, sans-serif"
                style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
              >{node.name}</text>
            </g>
          )
        })}
      </svg>

      {/* Hover prompt */}
      <div style={{
        position: 'absolute', bottom: 12, left: 0, right: 0,
        textAlign: 'center', pointerEvents: 'none',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9, letterSpacing: '0.16em',
        color: hovNode
          ? `rgba(${hovNode.col.join(',')},0.7)`
          : 'rgba(94,106,210,0.2)',
        transition: 'color 0.2s',
      }}>
        {hovNode ? `${hovNode.name.toUpperCase()}  ·  CLICK TO ENTER →` : 'HOVER TO EXPLORE CONNECTIONS  ·  CLICK TO ENTER'}
      </div>
    </div>
  )
}
