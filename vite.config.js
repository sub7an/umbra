import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In `npm run dev`, serve /api/ai with the same handler Vercel runs in
// production, so the AI features work locally. The key is read from .env /
// .env.local on the server side only and never reaches the client bundle.
function localAiApi(env) {
  return {
    name: 'local-ai-api',
    apply: 'serve',
    configureServer(server) {
      process.env.ANTHROPIC_API_KEY ||= env.ANTHROPIC_API_KEY
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), localAiApi(env)],
    build: {
      rolldownOptions: {
        output: {
          // Advanced splitting auto-deduplicates shared vendor code (Three.js,
          // R3F, React) across all lazy module boundaries instead of inlining it.
          codeSplitting: 'advanced',
        },
      },
    },
  }
})
