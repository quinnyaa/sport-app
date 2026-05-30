import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { installDevMock } from './devMock.ts'
import App from './App.tsx'

installDevMock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
