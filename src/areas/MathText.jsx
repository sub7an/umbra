import { useMemo } from 'react'
import katex from 'katex'
import { splitMath } from '../lib/mathText'

// Renders item text with inline $…$ maths. Only trusted catalogue/server text goes
// in here (item stems, choices, worked solutions), never student input.
// Plain-text segments are React text nodes; only KaTeX's own output (with trust off,
// so no \href / \url / html extensions) is set as HTML.
function Tex({ tex }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, trust: false, strict: 'ignore' }), [tex])
  return <span className="cr-math" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function MathText({ text, as: Tag = 'span', ...rest }) {
  const parts = useMemo(() => splitMath(text), [text])
  return <Tag {...rest}>{parts.map((p, i) => (p.math ? <Tex key={i} tex={p.text} /> : <span key={i}>{p.text}</span>))}</Tag>
}
