import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.jsx'
import { initTheme } from './lib/theme'

inject()
initTheme()
createRoot(document.getElementById('root')).render(<App />)
