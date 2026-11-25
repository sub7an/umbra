// Classroom flow against the LOCAL Supabase stack (seeded by tests/e2e/global-setup.js).
import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const env = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {}
const TEACHER_EMAIL = 'teacher@example.test'

test.skip(!env.SEED_TEACHER_PASSWORD || process.env.UMBRA_SEED_SKIPPED === '1',
  'local Supabase not seeded: run `supabase start` and `node scripts/seed-local.mjs`')

test('teacher issues login cards; a student signs in with one; join codes are checked', async ({ page, browser }) => {
  test.setTimeout(120_000) // several sign-ins and a card batch against the local stack
  // The teacher signs in with the seed user
  await page.goto('/teach')
  await expect(page.getByRole('heading', { name: 'Teacher dashboard' })).toBeVisible()
  await page.getByLabel('Email').fill(TEACHER_EMAIL)
  await page.getByLabel('Password').fill(env.SEED_TEACHER_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  // Creates class 12P (AQA)
  await page.getByRole('button', { name: 'New class' }).click()
  await page.getByLabel('Class name').fill('12P')
  await page.getByLabel('Syllabus').selectOption({ label: 'AQA' })
  await page.getByRole('button', { name: 'Create class' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '12P' })).toBeVisible()
  const code = (await page.getByTestId('class-code').innerText()).replace(/\s/g, '')
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)

  // Issues cards for Amira Khan and Ben Ode
  await page.getByLabel('Student names, one per line').fill('Amira Khan\nBen Ode')
  await page.getByRole('button', { name: 'Make 2 login cards' }).click()
  const cards = page.getByRole('article')
  await expect(cards).toHaveCount(2)

  // The printable view shows 2 cards and nothing else from the page
  await page.emulateMedia({ media: 'print' })
  await expect(cards).toHaveCount(2)
  for (const card of await cards.all()) await expect(card).toBeVisible()
  await expect(page.getByLabel('Student names, one per line')).toBeHidden()
  await page.emulateMedia({ media: 'screen' })

  const amira = page.getByRole('article', { name: 'Login card for Amira Khan' })
  const username = (await amira.getByTestId('card-username').innerText()).trim()
  const passphrase = (await amira.getByTestId('card-passphrase').innerText()).trim()
  expect(username).toMatch(/^amira-\d{4}$/)

  // The roster lists both students
  await expect(page.getByRole('cell', { name: 'Amira Khan', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Ben Ode', exact: true })).toBeVisible()

  // In a new context, a student signs in with Amira's card on /join and lands on /learn
  const student = await browser.newContext()
  const sp = await student.newPage()
  await sp.goto('/join')
  await sp.getByLabel('Username').fill(username)
  await sp.getByLabel('Passphrase').fill(passphrase)
  await sp.getByRole('button', { name: 'Sign in with card' }).click()
  await expect(sp).toHaveURL(/\/learn$/)
  await expect(sp.getByRole('heading', { name: 'Your learning' })).toBeVisible()
  await expect(sp.getByText('12P')).toBeVisible()
  await student.close()

  // /join?code=<lowercase code with spaces> pre-fills the normalised code
  const messy = `${code.slice(0, 3).toLowerCase()} ${code.slice(3).toLowerCase()}`
  const anon = await browser.newContext()
  const jp = await anon.newPage()
  await jp.goto(`/join?code=${encodeURIComponent(messy)}`)
  await expect(jp.getByRole('textbox', { name: 'Class code' })).toHaveValue(code)

  // Typing O shows the alphabet hint
  await jp.getByRole('textbox', { name: 'Class code' }).fill('')
  await jp.getByRole('textbox', { name: 'Class code' }).pressSequentially('O')
  await expect(jp.getByText("codes don't use O, I, L, 0 or 1")).toBeVisible()
  await anon.close()
})
