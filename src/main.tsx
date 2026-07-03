import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Dashboard from './components/Dashboard'
import { AppThemeProvider } from './theme'
import '@xyflow/react/dist/style.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </HashRouter>
    </AppThemeProvider>
  </StrictMode>,
)
