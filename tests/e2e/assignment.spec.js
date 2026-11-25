// The core classroom loop against the LOCAL Supabase stack: a teacher assigns
// questions, a student answers them (graded server-side by /api/check), and the
// teacher's dashboard updates. Needs the pilot items synced from ../umbra-content
// (tests/e2e/global-setup.js does that when the repo is next to this one).
//
// The correct answer for one part is read at run time from the local item_keys with
// the service role. No answer is ever written into this repository.
import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const env = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {}
const TEACHER_EMAIL = 'teacher@example.test'
const ITEM_1 = 'waves-youngs-001'
const ITEM_2 = 'optics-tir-001'
const ITEM_3 = 'thermo-kettle-001'
const WRONG = '12.5' // far from the critical angle of glass

test.skip(!env.SEED_TEACHER_PASSWORD || !env.SUPABASE_SERVICE_ROLE_KEY || process.env.UMBRA_SEED_SKIPPED === '1'
  || process.env.UMBRA_ITEMS_MISSING === '1',
'local Supabase not seeded or pilot items not synced: run `supabase start`, `node scripts/seed-local.mjs` and the umbra-content sync')

// UMBRA_SHOTS=<dir> saves full-page screenshots of each screen for review.
// The areas scroll inside their own container, so the viewport is made tall instead.
async function shot(p, name) {
  if (!process.env.UMBRA_SHOTS) return
  const size = p.viewportSize()
  const h = await p.evaluate(() => document.querySelector('.umbra-area')?.scrollHeight ?? 720)
  await p.setViewportSize({ width: size.width, height: Math.min(h, 4000) })
  await p.screenshot({ path: `${process.env.UMBRA_SHOTS}/${name}.png` })
  await p.setViewportSize(size)
}

const admin = () => createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// A response the server marks correct for a numeric part, built from the local key.
async function correctNumeric(itemId, partId) {
  const { data, error } = await admin().from('item_keys').select('private').eq('item_id', itemId).single()
  if (error) throw error
  const k = data.private.key[partId]
  return k.unit ? `${k.value} ${k.unit}` : String(k.value)
}

test('teacher assigns, student answers, dashboard updates; a lost response is recorded once', async ({ page, browser }) => {
  test.setTimeout(180_000)
  page.on('dialog', (d) => d.accept())

  // ---- Teacher: sign in, class 12P, a login card for Amira
  await page.goto('/teach')
  await page.getByLabel('Email').fill(TEACHER_EMAIL)
  await page.getByLabel('Password').fill(env.SEED_TEACHER_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'New class' }).click()
  await page.getByLabel('Class name').fill('12P')
  await page.getByLabel('Syllabus').selectOption({ label: 'AQA' })
  await page.getByRole('button', { name: 'Create class' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '12P' })).toBeVisible()

  await page.getByLabel('Student names, one per line').fill('Amira Khan')
  await page.getByRole('button', { name: 'Make 1 login card' }).click()
  const card = page.getByRole('article', { name: 'Login card for Amira Khan' })
  const username = (await card.getByTestId('card-username').innerText()).trim()
  const passphrase = (await card.getByTestId('card-passphrase').innerText()).trim()
  await page.getByRole('button', { name: 'Done' }).click()
  const classUrl = page.url()

  // ---- Teacher assigns 3 seed items to 12P (one picked through the topic filter)
  await page.getByRole('button', { name: 'New assignment' }).click()
  await page.getByLabel('Title').fill('Waves and light')
  await page.getByRole('checkbox', { name: /Young's double-slit experiment/ }).check()
  await page.getByLabel('Topic').selectOption({ label: 'Optics' })
  await expect(page.getByRole('checkbox', { name: /double-slit/ })).toHaveCount(0)
  await page.getByRole('checkbox', { name: /glass block of refractive index/ }).check()
  await page.getByLabel('Topic').selectOption({ label: 'All topics' })
  await page.getByRole('checkbox', { name: /electric kettle/ }).check()
  await shot(page, '1-assignment-editor')
  await page.getByRole('button', { name: 'Set assignment (3 questions)' }).click()
  await expect(page.getByText('Waves and light', { exact: true })).toBeVisible()

  const { data: rows } = await admin().from('assignments').select('id, item_ids').eq('title', 'Waves and light')
    .order('opens_at', { ascending: false }).limit(1)
  expect(rows[0].item_ids).toEqual([ITEM_1, ITEM_2, ITEM_3])

  // An assignment nobody has answered can still be deleted
  await expect(page.getByRole('button', { name: 'Delete Waves and light' })).toBeVisible()
  await shot(page, '2-class-page')

  // ---- Dashboard before: Amira's topic cells are empty, nothing missed yet
  await page.getByRole('link', { name: 'Class progress' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '12P progress' })).toBeVisible()
  const amiraRow = page.getByRole('row', { name: /Amira Khan/ }).first()
  await expect(amiraRow.locator('[data-topic="waves"]')).toHaveAttribute('data-level', 'none')
  await expect(amiraRow.locator('[data-topic="optics"]')).toHaveAttribute('data-level', 'none')
  await expect(page.getByRole('region', { name: 'Most missed' }).or(page.locator('section[aria-labelledby="missed-title"]')))
    .toContainText('Nothing missed yet')

  // ---- Amira signs in with her card and opens the assignment
  const student = await browser.newContext()
  const sp = await student.newPage()
  await sp.goto('/join')
  await sp.getByLabel('Username').fill(username)
  await sp.getByLabel('Passphrase').fill(passphrase)
  await sp.getByRole('button', { name: 'Sign in with card' }).click()
  await expect(sp).toHaveURL(/\/learn$/)
  await sp.getByRole('link', { name: 'Waves and light' }).click()
  await expect(sp.getByRole('heading', { name: 'Question 1 of 3' })).toBeVisible()
  // KaTeX renders the stem; the sim link points at the matching simulation view
  await expect(sp.locator('.ip-stem .katex').first()).toBeVisible()
  await expect(sp.getByRole('link', { name: /Open in simulation/ })).toHaveAttribute('href', '/simulations/wave-mechanics/youngs-double-slit')

  // Item 1, part a: correct
  await sp.getByRole('textbox', { name: 'Your answer to part a' }).fill(await correctNumeric(ITEM_1, 'a'))
  await sp.getByRole('button', { name: 'Check part a' }).click()
  await expect(sp.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible()
  // One part of three attempted: the worked solution (all parts) stays locked
  await expect(sp.getByText('Show the worked solution')).toHaveCount(0)
  await shot(sp, '3-item-player-correct')

  // Item 2, part a: wrong
  await sp.getByRole('button', { name: 'Next question' }).click()
  await expect(sp.getByRole('heading', { name: 'Question 2 of 3' })).toBeVisible()
  await expect(sp.getByText('Number only: leave the unit off.').first()).toBeVisible()
  await sp.getByRole('textbox', { name: 'Your answer to part a' }).fill(WRONG)
  await sp.getByRole('button', { name: 'Check part a' }).click()
  await expect(sp.getByRole('button', { name: 'Try part a again' })).toBeVisible()
  await shot(sp, '4-item-player-wrong')

  // ---- Dashboard after: Amira's cells changed from empty; item 2 is most missed with her answer
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(amiraRow.locator('[data-topic="waves"]')).not.toHaveAttribute('data-level', 'none')
  await expect(amiraRow.locator('[data-topic="optics"]')).not.toHaveAttribute('data-level', 'none')
  await expect(amiraRow.locator('[data-topic="waves"]')).toContainText('%')
  const missed = page.locator('section[aria-labelledby="missed-title"]')
  await expect(missed.locator(`[data-item="${ITEM_2}"]`)).toContainText('glass block')
  await expect(missed.locator(`[data-item="${ITEM_2}"]`)).toContainText(WRONG)
  await expect(missed.locator(`[data-item="${ITEM_1}"]`)).toHaveCount(0)

  // ---- The network dies mid-submit: the server records the attempt, the response is
  // lost, the client retries with the same attempt id and gets the stored verdict.
  const bodies = []
  let killed = false
  await sp.route('**/api/check', async (route) => {
    bodies.push(JSON.parse(route.request().postData()))
    if (!killed) {
      killed = true
      await route.fetch() // reaches the server, which records the attempt
      return route.abort('connectionreset') // ...but the browser never sees the reply
    }
    return route.continue()
  })
  await sp.getByRole('button', { name: 'Previous question' }).click()
  await expect(sp.getByRole('heading', { name: 'Question 1 of 3' })).toBeVisible()
  await sp.getByRole('textbox', { name: 'Your answer to part b' }).fill(await correctNumeric(ITEM_1, 'b'))
  await sp.getByRole('button', { name: 'Check part b' }).click()
  await expect(sp.getByRole('status').filter({ hasText: 'Correct' })).toHaveCount(2)
  expect(killed).toBe(true)
  expect(bodies.length).toBeGreaterThanOrEqual(2)
  expect(new Set(bodies.map((b) => b.attempt_id)).size).toBe(1)

  const { data: amira } = await admin().from('students').select('user_id').eq('username', username).single()
  const { count: partB } = await admin().from('attempts').select('id', { count: 'exact', head: true })
    .eq('student_id', amira.user_id).eq('item_id', ITEM_1).eq('part_id', 'b')
  expect(partB).toBe(1)
  const { count: all } = await admin().from('attempts').select('id', { count: 'exact', head: true })
    .eq('student_id', amira.user_id)
  expect(all).toBe(3)

  // ---- A gateway error after the insert (502 from the proxy): retried with the same
  // id, recorded once.
  bodies.length = 0
  let gateway = false
  await sp.unroute('**/api/check')
  await sp.route('**/api/check', async (route) => {
    bodies.push(JSON.parse(route.request().postData()))
    if (!gateway) {
      gateway = true
      await route.fetch()
      return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"bad_gateway"}' })
    }
    return route.continue()
  })
  await sp.getByRole('button', { name: 'Question 3' }).click()
  await expect(sp.getByRole('heading', { name: 'Question 3 of 3' })).toBeVisible()
  await sp.getByRole('textbox', { name: 'Your answer to part a' }).fill('1 J')
  await sp.getByRole('button', { name: 'Check part a' }).click()
  await expect(sp.getByRole('button', { name: 'Try part a again' })).toBeVisible()
  expect(gateway).toBe(true)
  expect(new Set(bodies.map((b) => b.attempt_id)).size).toBe(1)
  const { count: kettle } = await admin().from('attempts').select('id', { count: 'exact', head: true })
    .eq('student_id', amira.user_id).eq('item_id', ITEM_3)
  expect(kettle).toBe(1)

  // The dashboard agrees: 4 of the assignment's 9 parts answered, 2 right first time
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.locator('section[aria-labelledby="done-title"]').getByRole('row', { name: /Amira Khan/ }))
    .toContainText('4/9')
  await expect(page.locator('section[aria-labelledby="done-title"]').getByRole('row', { name: /Amira Khan/ }))
    .toContainText('2 right first time')
  await shot(page, '5-dashboard')

  // ---- Answered assignments can't be deleted: the editor no longer offers it
  await page.goto(classUrl)
  await expect(page.getByText('Waves and light', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Waves and light' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Change due date for Waves and light' })).toBeVisible()

  await student.close()
})

test('a failed role check on /learn offers a retry, not an empty page', async ({ page, browser }) => {
  test.setTimeout(90_000)
  // A student account to sign in with: issue a card through the teacher UI
  await page.goto('/teach')
  await page.getByLabel('Email').fill(TEACHER_EMAIL)
  await page.getByLabel('Password').fill(env.SEED_TEACHER_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: '13Q' }).click()
  await page.getByLabel('Student names, one per line').fill('Retry Test')
  await page.getByRole('button', { name: 'Make 1 login card' }).click()
  const card = page.getByRole('article', { name: 'Login card for Retry Test' })
  const username = (await card.getByTestId('card-username').innerText()).trim()
  const passphrase = (await card.getByTestId('card-passphrase').innerText()).trim()

  const ctx = await browser.newContext()
  const sp = await ctx.newPage()
  await sp.route('**/rest/v1/students*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }))
  await sp.goto('/join')
  await sp.getByLabel('Username').fill(username)
  await sp.getByLabel('Passphrase').fill(passphrase)
  await sp.getByRole('button', { name: 'Sign in with card' }).click()
  await expect(sp.getByRole('button', { name: 'Try again' })).toBeVisible()
  await sp.unroute('**/rest/v1/students*')
  await sp.getByRole('button', { name: 'Try again' }).click()
  await expect(sp.getByRole('heading', { name: 'Assignments' })).toBeVisible()
  await ctx.close()
})
