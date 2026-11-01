import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Read a key straight from .env / .env.local (.env.local wins). Vite's loadEnv
// would let a stale value already in process.env override the file.
function keyFromEnvFiles(name) {
  const read = (f) => (existsSync(f) ? parseEnv(readFileSync(f, 'utf8')) : {})
  return { ...read('.env'), ...read('.env.local') }[name]
}

// In `npm run dev`, serve /api/ai with the same handler Vercel runs in
// production, so the AI features work locally. The key is read from .env /
// .env.local on the server side only and never reaches the client bundle.
function localAiApi() {
  return {
    name: 'local-ai-api',
    apply: 'serve',
    configureServer(server) {
      // Re-read on every server (re)start so a rotated key takes effect
      const key = keyFromEnvFiles('ANTHROPIC_API_KEY')
      if (key) process.env.ANTHROPIC_API_KEY = key
      server.middlewares.use('/api/ai', async (req, res) => {
        // Vercel's response helpers, which the handler uses
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
          return res
        }
        const { default: handler } = await server.ssrLoadModule('/api/ai.js')
        await handler(req, res)
      })
    },
  }
}

export default defineConfig(() => {
  return {
    plugins: [react(), localAiApi()],
  }
})
