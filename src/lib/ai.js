import Anthropic from '@anthropic-ai/sdk'

// Shared browser Anthropic client (publishable pattern already used app-wide).
// null when no key is configured so callers can degrade gracefully.
export const ai = import.meta.env.VITE_ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true })
  : null

// One-shot short completion with the fast model. Returns '' on any failure.
export async function quickAI(prompt, maxTokens = 220) {
  if (!ai) return ''
  try {
    const msg = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })
    return msg.content?.[0]?.text?.trim() || ''
  } catch {
    return ''
  }
}
