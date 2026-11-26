import { defineConfig } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// The dev server reads .env.local itself; passing the VITE_ keys explicitly makes
// sure they win over anything stale in the shell (Vite gives process.env priority).
const local = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {}
const viteEnv = Object.fromEntries(
  ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => local[k]).map((k) => [k, local[k]]),
)

export default defineConfig({
  testDir: 'tests/e2e',
  // Seeds the local teacher (scripts/seed-local.mjs); the classroom spec skips without it
  globalSetup: './tests/e2e/global-setup.js',
  use: { baseURL: 'http://localhost:5199' },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: true,
    env: viteEnv,
  },
})
