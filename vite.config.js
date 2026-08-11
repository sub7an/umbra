import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Advanced splitting auto-deduplicates shared vendor code (Three.js,
        // R3F, React) across all lazy module boundaries instead of inlining it.
        codeSplitting: 'advanced',
      },
    },
  },
})
