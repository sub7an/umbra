import { test, expect } from '@playwright/test'

const share = (m) => Buffer.from(JSON.stringify({ m })).toString('base64')

test('view URL selects that view tab', async ({ page }) => {
  await page.goto('/simulations/optics/lens-ray-diagram')
  await expect(page.getByRole('tab', { name: /lens/i }).first()).toHaveAttribute('aria-selected', 'true')
})

test('/validation shows its heading', async ({ page }) => {
  await page.goto('/validation')
  await expect(page.getByRole('heading', { name: "How we know it's right" })).toBeVisible()
})

for (const [path, name] of [
  ['/teach', 'Teacher dashboard'],
  ['/learn', 'Your learning'],
  ['/join', 'Join a class'],
]) {
  test(`${path} shows its heading`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name })).toBeVisible()
  })
}

test('back from an area restores the module URL', async ({ page }) => {
  await page.goto('/simulations/optics')
  await page.evaluate(() => {
    history.pushState(null, '', '/teach')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { name: 'Teacher dashboard' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/simulations\/optics$/)
  await expect(page.getByRole('heading', { name: 'Teacher dashboard' })).toHaveCount(0)
})

test('legacy #optics hash becomes the module path', async ({ page }) => {
  await page.goto('/#optics')
  await expect(page).toHaveURL(/\/simulations\/optics$/)
})

test('?s= share param is removed after load', async ({ page }) => {
  await page.goto(`/simulations/optics?s=${encodeURIComponent(share('optics'))}`)
  await expect.poll(() => new URL(page.url()).searchParams.has('s')).toBe(false)
  expect(new URL(page.url()).pathname).toBe('/simulations/optics')
})

test('unknown module falls back to the picker', async ({ page }) => {
  await page.goto('/simulations/nope')
  await expect(page.getByText(/optics/i).first()).toBeVisible()
  await expect(page.getByRole('tab', { name: /lens/i })).toHaveCount(0)
})

test('?s= on an area URL opens the shared module, not the area', async ({ page }) => {
  await page.goto(`/teach?s=${encodeURIComponent(share('optics'))}`)
  await expect(page).toHaveURL(/\/simulations\/optics$/)
  await expect(page.getByRole('heading', { name: 'Teacher dashboard' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /lens/i }).first()).toBeVisible()
})

test('legacy #optics hash is ignored on an area URL', async ({ page }) => {
  await page.goto('/teach#optics')
  await expect(page.getByRole('heading', { name: 'Teacher dashboard' })).toBeVisible()
  await expect(page).toHaveURL(/\/teach#optics$/)
})
