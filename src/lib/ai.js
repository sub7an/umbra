// Browser side of the AI features. Every request goes through /api/ai, a
// serverless function that holds the API key and picks the model, so no key
// ever ships in the client bundle.

async function post(body) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `AI request failed (${res.status})`
    try { msg = (await res.json()).error || msg } catch { /* not JSON */ }
    throw new Error(msg)
  }
  return res
}

// One complete reply. params: { system?, messages, max_tokens? } → reply text
export async function askAI(params) {
  const res = await post({ ...params, stream: false })
  const { text } = await res.json()
  return (text || '').trim()
}

// Streamed reply. onText receives the text so far after each chunk.
// Resolves with the full text.
export async function streamAI(params, onText) {
  const res = await post({ ...params, stream: true })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onText?.(full)
  }
  full += decoder.decode()
  return full
}

// One-shot short completion. Returns '' on any failure.
export async function quickAI(prompt, maxTokens = 220) {
  try {
    return await askAI({ max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  } catch {
    return ''
  }
}
