import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Read a key straight from .env / .env.local (.env.local wins). Vite's loadEnv
// would let a stale value already in process.env override the file.
function keyFromEnvFiles(name) {
  const read = (f) => (existsSync(f) ? parseEnv(readFileSync(f, 'utf8')) : {})
  return { ...read('.env'), ...read('.env.local') }[name]
}

// In `npm run dev`, serve the /api/* functions with the same handlers Vercel runs
// in production, so they work locally. Secrets are read from .env / .env.local on
// the server side only and never reach the client bundle (no VITE_ prefix).
const LOCAL_API_ROUTES = ['/api/ai', '/api/class-cards', '/api/check']
const SERVER_ENV_KEYS = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']

function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      // Re-read on every server (re)start so a rotated key takes effect
      for (const name of SERVER_ENV_KEYS) {
        const value = keyFromEnvFiles(name)
        if (value) process.env[name] = value
      }
      for (const route of LOCAL_API_ROUTES) {
        server.middlewares.use(route, async (req, res) => {
          // Vercel's response helpers, which the handlers use
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
            return res
          }
          // /api/check arrives in a later task: 404 until its file exists.
          const file = `${server.config.root}${route}.js`
          if (!existsSync(file)) return res.status(404).json({ error: 'not_found' })
          const { default: handler } = await server.ssrLoadModule(`${route}.js`)
          await handler(req, res)
        })
      }
    },
  }
}

export default defineConfig(() => {
  return {
    plugins: [react(), localApi()],
    // Playwright specs live in tests/e2e and run via `npm run test:e2e`
    test: { exclude: [...configDefaults.exclude, 'tests/e2e/**'] },
  }
})
