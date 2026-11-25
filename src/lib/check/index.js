import { parseQuantity, toSI } from './units.js'
import { checkNumeric } from './numeric.js'
import { checkChoice } from './choice.js'
import { checkOrder } from './order.js'
import { checkExpression } from './expression.js'

export { parseQuantity, toSI, checkNumeric, checkChoice, checkOrder, checkExpression }

export function checkResponse(answerType, key, response) {
  try {
    switch (answerType) {
      case 'numeric': return checkNumeric(response, key)
      case 'choice': return checkChoice(response, key)
      case 'order': return checkOrder(response, key)
      case 'expression': return checkExpression(response, key)
      default: return { correct: false, reason: 'format' }
    }
  } catch {
    return { correct: false, reason: 'format' }
  }
}

// Returns the feedback_id of the first listed wrong answer the response matches
// (numerically with units when both parse as quantities, else normalised text), or null.
export function matchWrongAnswer(response, wrong) {
  try {
    if (typeof response !== 'string' || !Array.isArray(wrong)) return null
    for (const w of wrong) {
      if (!w || typeof w.value !== 'string') continue
      const q = parseQuantity(w.value)
      if (q && toSI(q.value, q.unit)) {
        if (checkNumeric(response, { value: q.value, unit: q.unit }).correct) return w.feedback_id
      } else if (checkChoice(response, { answer: w.value }).correct) {
        return w.feedback_id
      }
    }
    return null
  } catch {
    return null
  }
}
